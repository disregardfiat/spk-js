const { expect } = require('chai');
const sinon = require('sinon');
const { SPKContractCreator } = require('../../src/storage/contract-creator');
const { StorageProviderSelector } = require('../../src/storage/provider-selector');

describe('SPKContractCreator', () => {
  let creator;
  let mockSPK;
  let fetchStub;
  let selectorStub;

  beforeEach(() => {
    // Mock SPK instance
    mockSPK = {
      username: 'testuser',
      account: {
        calculateBroca: sinon.stub().resolves(1000)
      },
      keychain: {
        requestBroadcast: sinon.stub()
      }
    };

    creator = new SPKContractCreator(mockSPK, 'https://spktest.dlux.io');
    fetchStub = sinon.stub(global, 'fetch');
    
    // Stub the selector methods
    selectorStub = sinon.stub(creator.selector, 'selectBestProvider');
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('createStorageContract', () => {
    it('should create a storage contract with selected provider', async () => {
      const mockProvider = {
        nodeId: 'bestnode',
        api: 'https://bestnode.com',
        freeSpace: 1000000000000
      };

      // Mock network stats
      fetchStub.resolves({
        ok: true,
        json: async () => ({
          result: {
            channel_bytes: 1024,
            channel_min: 100
          }
        })
      });

      // Mock provider selection
      selectorStub.resolves(mockProvider);

      // Mock broadcast success
      mockSPK.keychain.requestBroadcast.callsFake((username, ops, key, callback) => {
        callback({
          success: true,
          result: { id: 'abc123' }
        });
      });

      const result = await creator.createStorageContract(102400, {
        duration: 30
      });

      expect(result).to.include({
        success: true,
        transactionId: 'abc123',
        brocaCost: 100,
        size: 102400,
        duration: 30
      });

      expect(result.provider).to.deep.equal({
        nodeId: 'bestnode',
        api: 'https://bestnode.com'
      });

      expect(result.contractId).to.match(/testuser_\d+_[a-z0-9]+/);

      // Verify broadcast was called with correct params
      const broadcastCall = mockSPK.keychain.requestBroadcast.getCall(0);
      const customJson = broadcastCall.args[1][0][1];
      const jsonData = JSON.parse(customJson.json);

      expect(jsonData).to.deep.equal({
        to: 'testuser',
        broca: 100,
        broker: 'bestnode',
        contract: '0'
      });

      expect(customJson.id).to.equal('spkccT_channel_open');
    });

    it('should include beneficiary when specified', async () => {
      fetchStub.resolves({
        ok: true,
        json: async () => ({ result: { channel_bytes: 1024, channel_min: 100 } })
      });

      selectorStub.resolves({
        nodeId: 'node1',
        api: 'https://node1.com',
        freeSpace: 1000000000
      });

      mockSPK.keychain.requestBroadcast.callsFake((username, ops, key, callback) => {
        callback({ success: true, result: { id: 'tx123' } });
      });

      await creator.createStorageContract(100000, {
        beneficiary: {
          account: 'alice',
          weight: 0.1 // 10%
        }
      });

      const broadcastCall = mockSPK.keychain.requestBroadcast.getCall(0);
      const jsonData = JSON.parse(broadcastCall.args[1][0][1].json);

      expect(jsonData.contract).to.equal('1');
      expect(jsonData.slots).to.equal('alice,10');
    });

    it('should throw error when insufficient BROCA', async () => {
      mockSPK.account.calculateBroca.resolves(50); // Only 50 BROCA available

      fetchStub.resolves({
        ok: true,
        json: async () => ({ result: { channel_bytes: 1024, channel_min: 100 } })
      });

      await expect(creator.createStorageContract(200000))
        .to.be.rejectedWith('Insufficient BROCA. Required: 196, Available: 50');
    });

    it('should throw error when no providers available', async () => {
      fetchStub.resolves({
        ok: true,
        json: async () => ({ result: { channel_bytes: 1024, channel_min: 100 } })
      });

      selectorStub.rejects(new Error('No healthy storage providers with sufficient space'));

      await expect(creator.createStorageContract(100000))
        .to.be.rejectedWith('No healthy storage providers');
    });

    it('should handle broadcast failure', async () => {
      fetchStub.resolves({
        ok: true,
        json: async () => ({ result: { channel_bytes: 1024, channel_min: 100 } })
      });

      selectorStub.resolves({
        nodeId: 'node1',
        api: 'https://node1.com',
        freeSpace: 1000000000
      });

      mockSPK.keychain.requestBroadcast.callsFake((username, ops, key, callback) => {
        callback({ success: false, error: 'Transaction failed' });
      });

      await expect(creator.createStorageContract(100000))
        .to.be.rejectedWith('Transaction failed');
    });
  });

  describe('calculateBrocaCost', () => {
    it('should calculate cost based on network stats', async () => {
      fetchStub.resolves({
        ok: true,
        json: async () => ({
          result: {
            channel_bytes: 1024,
            channel_min: 100
          }
        })
      });

      const cost = await creator.calculateBrocaCost(102400); // 100KB
      expect(cost).to.equal(100); // 100KB / 1024 = 100 BROCA
    });

    it('should apply minimum channel cost', async () => {
      fetchStub.resolves({
        ok: true,
        json: async () => ({
          result: {
            channel_bytes: 1024,
            channel_min: 100
          }
        })
      });

      const cost = await creator.calculateBrocaCost(1024); // 1KB
      expect(cost).to.equal(100); // Minimum 100 BROCA
    });

    it('should apply duration multiplier', async () => {
      fetchStub.resolves({
        ok: true,
        json: async () => ({
          result: {
            channel_bytes: 1024,
            channel_min: 100
          }
        })
      });

      const cost = await creator.calculateBrocaCost(102400, 60); // 100KB for 60 days
      expect(cost).to.equal(200); // 100 BROCA * (60/30) = 200
    });

    it('should use fallback calculation when network stats fail', async () => {
      fetchStub.rejects(new Error('Network error'));

      const cost = await creator.calculateBrocaCost(102400); // 100KB
      expect(cost).to.equal(100); // Fallback: 100KB / 1024 = 100, min 100
    });
  });

  describe('generateContractId', () => {
    it('should generate unique contract IDs', () => {
      const id1 = creator.generateContractId('tx1');
      const id2 = creator.generateContractId('tx2');

      expect(id1).to.match(/testuser_\d+_[a-z0-9]+/);
      expect(id2).to.match(/testuser_\d+_[a-z0-9]+/);
      expect(id1).to.not.equal(id2);
    });
  });

  describe('getContractDetails', () => {
    it('should fetch contract details from API', async () => {
      const mockContract = {
        id: 'testuser_123_abc',
        broker: 'node1',
        broca: 100,
        files: []
      };

      fetchStub.resolves({
        ok: true,
        json: async () => mockContract
      });

      const details = await creator.getContractDetails('testuser_123_abc');
      
      expect(details).to.deep.equal(mockContract);
      expect(fetchStub).to.have.been.calledWith(
        'https://spktest.dlux.io/api/fileContract/testuser_123_abc'
      );
    });

    it('should throw error when contract not found', async () => {
      fetchStub.resolves({
        ok: false,
        status: 404
      });

      await expect(creator.getContractDetails('invalid'))
        .to.be.rejectedWith('Contract not found: invalid');
    });
  });

  describe('createDirectUploadContract', () => {
    it('should create contract and broadcast direct upload', async () => {
      const files = [
        { name: 'file1.txt', size: 1000, cid: 'Qm123' },
        { name: 'file2.txt', size: 2000, cid: 'Qm456' }
      ];

      // Mock network stats
      fetchStub.resolves({
        ok: true,
        json: async () => ({ result: { channel_bytes: 1024, channel_min: 100 } })
      });

      // Mock provider selection
      selectorStub.resolves({
        nodeId: 'node1',
        api: 'https://node1.com',
        freeSpace: 1000000000
      });

      // Mock both broadcasts
      let callCount = 0;
      mockSPK.keychain.requestBroadcast.callsFake((username, ops, key, callback) => {
        callCount++;
        callback({
          success: true,
          result: { id: callCount === 1 ? 'tx1' : 'tx2' }
        });
      });

      const result = await creator.createDirectUploadContract(files, {
        metadata: { title: 'Test upload' }
      });

      expect(result).to.include({
        success: true,
        transactionId: 'tx1',
        uploadTransactionId: 'tx2',
        directUpload: true,
        brocaCost: 100,
        size: 3000
      });

      // Verify second broadcast for direct upload
      const secondCall = mockSPK.keychain.requestBroadcast.getCall(1);
      const directUploadJson = JSON.parse(secondCall.args[1][0][1].json);

      expect(directUploadJson).to.include({
        op: 'direct_upload',
        c: 'Qm123,Qm456',
        s: '1000,2000'
      });

      expect(directUploadJson.m).to.exist; // Base64 encoded metadata
      
      // Decode and verify metadata
      const decodedMeta = JSON.parse(Buffer.from(directUploadJson.m, 'base64').toString());
      expect(decodedMeta).to.deep.equal({ title: 'Test upload' });
    });
  });
});