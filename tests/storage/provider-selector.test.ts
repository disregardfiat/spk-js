import { StorageProviderSelector } from '../../src/storage/provider-selector';

describe('StorageProviderSelector', () => {
  let selector: StorageProviderSelector;
  let fetchMock: jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    selector = new StorageProviderSelector('https://spktest.dlux.io');
    fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;
    jest.clearAllMocks();
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

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response);

      await selector.fetchProviders();

      expect(selector.providers).toEqual({
        'node1': ['id1', 'id2'],
        'node2': ['id3']
      });
      expect(selector.services).toEqual(mockResponse.services);
      expect(fetchMock).toHaveBeenCalledWith('https://spktest.dlux.io/services/IPFS');
    });

    it('should throw error when fetch fails', async () => {
      fetchMock.mockRejectedValueOnce(new Error('Network error'));

      await expect(selector.fetchProviders()).rejects.toThrow('Network error');
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

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => mockStats
      } as Response);

      const stats = await selector.fetchProviderStats('node1', 'https://provider1.com');

      expect(stats).toEqual(mockStats);
      expect(selector.providerStats['node1']).toMatchObject({
        StorageMax: '1000000000000',
        RepoSize: '250000000000',
        api: 'https://provider1.com'
      });
    });

    it('should timeout after 5 seconds', async () => {
      // Mock fetch to simulate an aborted request
      fetchMock.mockImplementationOnce(() => {
        return Promise.reject(new Error('The operation was aborted'));
      });
      
      // Spy on setTimeout to verify timeout is set
      const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
      
      // Call fetchProviderStats and expect it to reject
      await expect(selector.fetchProviderStats('node1', 'https://provider1.com'))
        .rejects.toThrow('The operation was aborted');
      
      // Verify setTimeout was called with 5000ms
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 5000);
      
      // Clean up
      setTimeoutSpy.mockRestore();
    });

    it('should skip known problematic nodes', () => {
      selector.skipNodes = new Set(['problematic.com']);
      
      const shouldSkip = selector.shouldSkipProvider('https://problematic.com/api');
      expect(shouldSkip).toBe(true);

      const shouldNotSkip = selector.shouldSkipProvider('https://good-provider.com/api');
      expect(shouldNotSkip).toBe(false);
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

      // All three providers should be included since they all have sufficient space
      // node1: 750GB free > 100GB required (50GB * 2)
      // node2: 100GB free = 100GB required (50GB * 2) - just meets requirement
      // node3: 400GB free > 100GB required (50GB * 2)
      expect(providers).toHaveLength(3);
      expect(providers[0].nodeId).toBe('node3'); // 80% free space ratio
      expect(providers[1].nodeId).toBe('node1'); // 75% free space ratio
      expect(providers[2].nodeId).toBe('node2'); // 5% free space ratio
    });

    it('should apply custom safety multiplier', () => {
      const requiredSize = 200000000000; // 200GB
      const providers = selector.getHealthyProviders(requiredSize, 1); // No safety multiplier

      expect(providers).toHaveLength(2);
      // Now node1 (750GB free) and node3 (400GB free) qualify
    });

    it('should sort by free space ratio', () => {
      const providers = selector.getHealthyProviders(1000000); // 1MB

      expect(providers[0].nodeId).toBe('node3'); // 80% free
      expect(providers[1].nodeId).toBe('node1'); // 75% free
      expect(providers[2].nodeId).toBe('node2'); // 5% free
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
      expect(providers).toHaveLength(1);
      expect(providers[0].freeSpace).toEqual(expect.any(Number));
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

      expect(provider.nodeId).toBe('node2'); // 80% free vs 75% free
      expect(provider.api).toBe('https://provider2.com');
    });

    it('should fetch providers if not already loaded', async () => {
      const mockResponse = {
        providers: { 'node1': 'id1' },
        services: [{ 'node1': { a: 'https://provider1.com' } }]
      };

      fetchMock
        .mockResolvedValueOnce({ ok: true, json: async () => mockResponse } as Response)
        .mockResolvedValueOnce({ 
          ok: true, 
          json: async () => ({ 
            node: 'node1',
            StorageMax: '1000000000000',
            RepoSize: '250000000000'
          })
        } as Response);

      const provider = await selector.selectBestProvider(1000000);

      expect(provider).toBeTruthy();
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('should throw error when no providers have sufficient space', async () => {
      selector.providers = { 'node1': ['id1'] };
      selector.providerStats = {
        'node1': {
          StorageMax: '1000000',
          RepoSize: '900000',
          api: 'https://provider1.com'
        }
      };

      await expect(selector.selectBestProvider(1000000000))
        .rejects.toThrow('No healthy storage providers with sufficient space');
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
      expect(icon).toBe('✅');
    });

    it('should return ⚠️ for providers with 2x-100x space', () => {
      const icon = selector.getProviderIcon('node1', 100000000); // 100MB needed, 900MB free
      expect(icon).toBe('⚠️');
    });

    it('should return ❌ for providers with less than 2x space', () => {
      const icon = selector.getProviderIcon('node1', 500000000); // 500MB needed, 900MB free
      expect(icon).toBe('❌');
    });

    it('should return ❓ for unknown providers', () => {
      const icon = selector.getProviderIcon('unknown', 1000000);
      expect(icon).toBe('❓');
    });
  });

  describe('formatBytes', () => {
    it('should format bytes to human readable strings', () => {
      expect(selector.formatBytes(0)).toBe('0 Bytes');
      expect(selector.formatBytes(1024)).toBe('1 KB');
      expect(selector.formatBytes(1048576)).toBe('1 MB');
      expect(selector.formatBytes(1073741824)).toBe('1 GB');
      expect(selector.formatBytes(1099511627776)).toBe('1 TB');
    });

    it('should handle decimal places', () => {
      expect(selector.formatBytes(1536, 0)).toBe('2 KB');
      expect(selector.formatBytes(1536, 2)).toBe('1.5 KB');
      expect(selector.formatBytes(1536, 3)).toBe('1.5 KB');
    });
  });
});