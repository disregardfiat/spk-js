import { SPKContractCreator } from '../../src/storage/contract-creator';

describe('SPKContractCreator', () => {
  let creator: SPKContractCreator;
  let mockSPK: any;
  let fetchMock: jest.MockedFunction<typeof fetch>;
  let selectBestProviderSpy: jest.SpyInstance;

  beforeEach(() => {
    // Mock SPK instance
    mockSPK = {
      username: 'testuser',
      account: {
        calculateBroca: jest.fn().mockResolvedValue(1000)
      },
      keychain: {
        requestBroadcast: jest.fn()
      }
    };

    creator = new SPKContractCreator(mockSPK, 'https://spktest.dlux.io');
    fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;
    
    // Spy on the selector method
    selectBestProviderSpy = jest.spyOn(creator.selector, 'selectBestProvider');
    
    jest.clearAllMocks();
  });

  describe('createStorageContract', () => {
    it('should create a storage contract with selected provider', async () => {
      const mockProvider = {
        nodeId: 'bestnode',
        api: 'https://bestnode.com',
        freeSpace: 1000000000000,
        totalSpace: 2000000000000,
        usedSpace: 1000000000000,
        freeSpaceRatio: 0.5,
        stats: {}
      };

      // Mock network stats
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: {
            channel_bytes: 1024,
            channel_min: 100
          }
        })
      } as Response);

      // Mock provider selection
      selectBestProviderSpy.mockResolvedValueOnce(mockProvider);

      // Mock broadcast success
      mockSPK.keychain.requestBroadcast.mockImplementationOnce(
        (_username: string, _ops: any, _key: string, callback: Function) => {
          callback({
            success: true,
            result: { id: 'abc123' }
          });
        }
      );

      const result = await creator.createStorageContract(102400, {
        duration: 30
      });

      expect(result).toMatchObject({
        success: true,
        transactionId: 'abc123',
        brocaCost: 100,
        size: 102400,
        duration: 30
      });

      expect(result.provider).toEqual({
        nodeId: 'bestnode',
        api: 'https://bestnode.com'
      });

      expect(result.contractId).toMatch(/testuser_\d+_[a-z0-9]+/);

      // Verify broadcast was called with correct params
      const broadcastCall = mockSPK.keychain.requestBroadcast.mock.calls[0];
      const customJson = broadcastCall[1][0][1];
      const jsonData = JSON.parse(customJson.json);

      expect(jsonData).toEqual({
        to: 'testuser',
        broca: 100,
        broker: 'bestnode',
        contract: '0'
      });

      expect(customJson.id).toBe('spkccT_channel_open');
    });

    it('should include beneficiary when specified', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: { channel_bytes: 1024, channel_min: 100 } })
      } as Response);

      selectBestProviderSpy.mockResolvedValueOnce({
        nodeId: 'node1',
        api: 'https://node1.com',
        freeSpace: 1000000000,
        totalSpace: 2000000000,
        usedSpace: 1000000000,
        freeSpaceRatio: 0.5,
        stats: {}
      });

      mockSPK.keychain.requestBroadcast.mockImplementationOnce(
        (_username: string, _ops: any, _key: string, callback: Function) => {
          callback({ success: true, result: { id: 'tx123' } });
        }
      );

      await creator.createStorageContract(100000, {
        beneficiary: {
          account: 'alice',
          weight: 0.1 // 10%
        }
      });

      const broadcastCall = mockSPK.keychain.requestBroadcast.mock.calls[0];
      const jsonData = JSON.parse(broadcastCall[1][0][1].json);

      expect(jsonData.contract).toBe('1');
      expect(jsonData.slots).toBe('alice,10');
    });

    it('should throw error when insufficient BROCA', async () => {
      mockSPK.account.calculateBroca.mockResolvedValueOnce(50); // Only 50 BROCA available

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: { channel_bytes: 1024, channel_min: 100 } })
      } as Response);

      await expect(creator.createStorageContract(200000))
        .rejects.toThrow('Insufficient BROCA. Required: 196, Available: 50');
    });

    it('should throw error when no providers available', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: { channel_bytes: 1024, channel_min: 100 } })
      } as Response);

      selectBestProviderSpy.mockRejectedValueOnce(
        new Error('No healthy storage providers with sufficient space available')
      );

      await expect(creator.createStorageContract(100000))
        .rejects.toThrow('No healthy storage providers');
    });

    it('should handle broadcast failure', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: { channel_bytes: 1024, channel_min: 100 } })
      } as Response);

      selectBestProviderSpy.mockResolvedValueOnce({
        nodeId: 'node1',
        api: 'https://node1.com',
        freeSpace: 1000000000,
        totalSpace: 2000000000,
        usedSpace: 1000000000,
        freeSpaceRatio: 0.5,
        stats: {}
      });

      mockSPK.keychain.requestBroadcast.mockImplementationOnce(
        (_username: string, _ops: any, _key: string, callback: Function) => {
          callback({ success: false, error: 'Transaction failed' });
        }
      );

      await expect(creator.createStorageContract(100000))
        .rejects.toThrow('Transaction failed');
    });
  });

  describe('calculateBrocaCost', () => {
    it('should calculate cost based on network stats', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: {
            channel_bytes: 1024,
            channel_min: 100
          }
        })
      } as Response);

      const cost = await creator.calculateBrocaCost(102400); // 100KB
      expect(cost).toBe(100); // 100KB / 1024 = 100 BROCA
    });

    it('should apply minimum channel cost', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: {
            channel_bytes: 1024,
            channel_min: 100
          }
        })
      } as Response);

      const cost = await creator.calculateBrocaCost(1024); // 1KB
      expect(cost).toBe(100); // Minimum 100 BROCA
    });

    it('should apply duration multiplier', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: {
            channel_bytes: 1024,
            channel_min: 100
          }
        })
      } as Response);

      const cost = await creator.calculateBrocaCost(102400, 60); // 100KB for 60 days
      expect(cost).toBe(200); // 100 BROCA * (60/30) = 200
    });

    it('should use fallback calculation when network stats fail', async () => {
      fetchMock.mockRejectedValueOnce(new Error('Network error'));

      const cost = await creator.calculateBrocaCost(102400); // 100KB
      expect(cost).toBe(100); // Fallback: 100KB / 1024 = 100, min 100
    });
  });

  describe('generateContractId', () => {
    it('should generate unique contract IDs', () => {
      const id1 = creator.generateContractId('tx1');
      const id2 = creator.generateContractId('tx2');

      expect(id1).toMatch(/testuser_\d+_[a-z0-9]+/);
      expect(id2).toMatch(/testuser_\d+_[a-z0-9]+/);
      expect(id1).not.toBe(id2);
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

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => mockContract
      } as Response);

      const details = await creator.getContractDetails('testuser_123_abc');
      
      expect(details).toEqual(mockContract);
      expect(fetchMock).toHaveBeenCalledWith(
        'https://spktest.dlux.io/api/fileContract/testuser_123_abc'
      );
    });

    it('should throw error when contract not found', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 404
      } as Response);

      await expect(creator.getContractDetails('invalid'))
        .rejects.toThrow('Contract not found: invalid');
    });
  });

  describe('createDirectUploadContract', () => {
    it('should create contract and broadcast direct upload', async () => {
      const files = [
        { name: 'file1.txt', size: 1000, cid: 'Qm123' },
        { name: 'file2.txt', size: 2000, cid: 'Qm456' }
      ];

      // Mock network stats
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: { channel_bytes: 1024, channel_min: 100 } })
      } as Response);

      // Mock provider selection
      selectBestProviderSpy.mockResolvedValueOnce({
        nodeId: 'node1',
        api: 'https://node1.com',
        freeSpace: 1000000000,
        totalSpace: 2000000000,
        usedSpace: 1000000000,
        freeSpaceRatio: 0.5,
        stats: {}
      });

      // Mock both broadcasts
      let callCount = 0;
      mockSPK.keychain.requestBroadcast.mockImplementation(
        (_username: string, _ops: any, _key: string, callback: Function) => {
          callCount++;
          callback({
            success: true,
            result: { id: callCount === 1 ? 'tx1' : 'tx2' }
          });
        }
      );

      const result = await creator.createDirectUploadContract(files, {
        metadata: { title: 'Test upload' }
      });

      expect(result).toMatchObject({
        success: true,
        transactionId: 'tx1',
        uploadTransactionId: 'tx2',
        directUpload: true,
        brocaCost: 100,
        size: 3000
      });

      // Verify second broadcast for direct upload
      const secondCall = mockSPK.keychain.requestBroadcast.mock.calls[1];
      const directUploadJson = JSON.parse(secondCall[1][0][1].json);

      expect(directUploadJson).toMatchObject({
        op: 'direct_upload',
        c: 'Qm123,Qm456',
        s: '1000,2000'
      });

      expect(directUploadJson.m).toBeTruthy(); // Base64 encoded metadata
      
      // Decode and verify metadata
      const decodedMeta = JSON.parse(Buffer.from(directUploadJson.m, 'base64').toString());
      expect(decodedMeta).toEqual({ title: 'Test upload' });
    });
  });
});