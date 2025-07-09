const { expect } = require('chai');
const sinon = require('sinon');
const { StorageProviderSelector } = require('../../src/storage/provider-selector');

describe('StorageProviderSelector', () => {
  let selector;
  let fetchStub;

  beforeEach(() => {
    selector = new StorageProviderSelector('https://spktest.dlux.io');
    fetchStub = sinon.stub(global, 'fetch');
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('fetchProviders', () => {
    it('should fetch and parse IPFS providers from SPK network', async () => {
      const mockResponse = {
        providers: {
          'node1': 'id1,id2',
          'node2': 'id3'
        },
        services: [
          { 
            'node1': { a: 'https://provider1.com', enabled: true },
            'node2': { a: 'https://provider2.com', enabled: true }
          }
        ]
      };

      fetchStub.resolves({
        ok: true,
        json: async () => mockResponse
      });

      await selector.fetchProviders();

      expect(selector.providers).to.deep.equal({
        'node1': ['id1', 'id2'],
        'node2': ['id3']
      });
      expect(selector.services).to.deep.equal(mockResponse.services);
      expect(fetchStub).to.have.been.calledWith('https://spktest.dlux.io/services/IPFS');
    });

    it('should throw error when fetch fails', async () => {
      fetchStub.rejects(new Error('Network error'));

      await expect(selector.fetchProviders()).to.be.rejectedWith('Network error');
    });
  });

  describe('fetchProviderStats', () => {
    it('should fetch stats for a single provider', async () => {
      const mockStats = {
        node: 'node1',
        StorageMax: '1000000000000',
        RepoSize: '250000000000',
        NumObjects: 1234
      };

      fetchStub.resolves({
        ok: true,
        json: async () => mockStats
      });

      const stats = await selector.fetchProviderStats('node1', 'https://provider1.com');

      expect(stats).to.deep.equal(mockStats);
      expect(selector.providerStats['node1']).to.include({
        StorageMax: '1000000000000',
        RepoSize: '250000000000',
        api: 'https://provider1.com'
      });
    });

    it('should timeout after 5 seconds', async () => {
      const clock = sinon.useFakeTimers();
      
      fetchStub.callsFake(() => new Promise((resolve) => {
        setTimeout(() => resolve({ ok: true }), 10000); // 10 second delay
      }));

      const promise = selector.fetchProviderStats('node1', 'https://provider1.com');
      
      clock.tick(5100);
      
      await expect(promise).to.be.rejected;
      
      clock.restore();
    });

    it('should skip known problematic nodes', async () => {
      selector.skipNodes = new Set(['problematic.com']);
      
      const shouldSkip = selector.shouldSkipProvider('https://problematic.com/api');
      expect(shouldSkip).to.be.true;

      const shouldNotSkip = selector.shouldSkipProvider('https://good-provider.com/api');
      expect(shouldNotSkip).to.be.false;
    });
  });

  describe('getHealthyProviders', () => {
    beforeEach(() => {
      selector.providerStats = {
        'node1': {
          StorageMax: '1000000000000', // 1TB
          RepoSize: '250000000000',    // 250GB used
          api: 'https://provider1.com'
        },
        'node2': {
          StorageMax: '2000000000000', // 2TB
          RepoSize: '1900000000000',   // 1.9TB used
          api: 'https://provider2.com'
        },
        'node3': {
          StorageMax: '500000000000',  // 500GB
          RepoSize: '100000000000',    // 100GB used
          api: 'https://provider3.com'
        }
      };
    });

    it('should return providers with sufficient space', () => {
      const requiredSize = 50000000000; // 50GB
      const providers = selector.getHealthyProviders(requiredSize);

      expect(providers).to.have.length(2);
      expect(providers[0].nodeId).to.equal('node3'); // Most free space ratio
      expect(providers[1].nodeId).to.equal('node1');
      
      // node2 should be excluded (only 100GB free, need 100GB with 2x safety)
    });

    it('should apply custom safety multiplier', () => {
      const requiredSize = 200000000000; // 200GB
      const providers = selector.getHealthyProviders(requiredSize, 1); // No safety multiplier

      expect(providers).to.have.length(2);
      // Now node1 (750GB free) and node3 (400GB free) qualify
    });

    it('should sort by free space ratio', () => {
      const providers = selector.getHealthyProviders(1000000); // 1MB

      expect(providers[0].nodeId).to.equal('node3'); // 80% free
      expect(providers[1].nodeId).to.equal('node1'); // 75% free
      expect(providers[2].nodeId).to.equal('node2'); // 5% free
    });

    it('should handle BigInt arithmetic correctly', () => {
      selector.providerStats = {
        'huge': {
          StorageMax: '99999999999999999999', // Huge number
          RepoSize: '1000000000000000000',    
          api: 'https://huge.com'
        }
      };

      const providers = selector.getHealthyProviders(1000000);
      expect(providers).to.have.length(1);
      expect(providers[0].freeSpace).to.be.a('number');
    });
  });

  describe('selectBestProvider', () => {
    it('should select provider with most free space ratio', async () => {
      selector.providers = { 'node1': ['id1'], 'node2': ['id2'] };
      selector.providerStats = {
        'node1': {
          StorageMax: '1000000000000',
          RepoSize: '250000000000',
          api: 'https://provider1.com'
        },
        'node2': {
          StorageMax: '500000000000',
          RepoSize: '100000000000',
          api: 'https://provider2.com'
        }
      };

      const provider = await selector.selectBestProvider(50000000000);

      expect(provider.nodeId).to.equal('node2'); // 80% free vs 75% free
      expect(provider.api).to.equal('https://provider2.com');
    });

    it('should fetch providers if not already loaded', async () => {
      const mockResponse = {
        providers: { 'node1': 'id1' },
        services: [{ 'node1': { a: 'https://provider1.com' } }]
      };

      fetchStub
        .onFirstCall().resolves({ ok: true, json: async () => mockResponse })
        .onSecondCall().resolves({ 
          ok: true, 
          json: async () => ({ 
            node: 'node1',
            StorageMax: '1000000000000',
            RepoSize: '250000000000'
          })
        });

      const provider = await selector.selectBestProvider(1000000);

      expect(provider).to.exist;
      expect(fetchStub).to.have.been.calledTwice;
    });

    it('should throw error when no providers have sufficient space', async () => {
      selector.providerStats = {
        'node1': {
          StorageMax: '1000000',
          RepoSize: '900000',
          api: 'https://provider1.com'
        }
      };

      await expect(selector.selectBestProvider(1000000000))
        .to.be.rejectedWith('No healthy storage providers with sufficient space');
    });
  });

  describe('getProviderIcon', () => {
    beforeEach(() => {
      selector.providerStats = {
        'node1': {
          StorageMax: '1000000000',
          RepoSize: '100000000'
        }
      };
    });

    it('should return ✅ for providers with 100x+ space', () => {
      const icon = selector.getProviderIcon('node1', 1000000); // 1MB needed, 900MB free
      expect(icon).to.equal('✅');
    });

    it('should return ⚠️ for providers with 2x-100x space', () => {
      const icon = selector.getProviderIcon('node1', 100000000); // 100MB needed, 900MB free
      expect(icon).to.equal('⚠️');
    });

    it('should return ❌ for providers with less than 2x space', () => {
      const icon = selector.getProviderIcon('node1', 500000000); // 500MB needed, 900MB free
      expect(icon).to.equal('❌');
    });

    it('should return ❓ for unknown providers', () => {
      const icon = selector.getProviderIcon('unknown', 1000000);
      expect(icon).to.equal('❓');
    });
  });

  describe('formatBytes', () => {
    it('should format bytes to human readable strings', () => {
      expect(selector.formatBytes(0)).to.equal('0 Bytes');
      expect(selector.formatBytes(1024)).to.equal('1 KB');
      expect(selector.formatBytes(1048576)).to.equal('1 MB');
      expect(selector.formatBytes(1073741824)).to.equal('1 GB');
      expect(selector.formatBytes(1099511627776)).to.equal('1 TB');
    });

    it('should handle decimal places', () => {
      expect(selector.formatBytes(1536, 0)).to.equal('2 KB');
      expect(selector.formatBytes(1536, 2)).to.equal('1.5 KB');
      expect(selector.formatBytes(1536, 3)).to.equal('1.5 KB');
    });
  });
});