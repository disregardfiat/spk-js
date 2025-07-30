import { NodeOperations } from '../../../src/storage/node-operations';
import { SPKAccount } from '../../../src/core/account';
import { SPKAPI } from '../../../src/core/api';
import { KeychainAdapter } from '../../../src/core/keychain-adapter';

// Mock dependencies
jest.mock('../../../src/core/account');
jest.mock('../../../src/core/api');
jest.mock('../../../src/core/keychain-adapter');

describe('NodeOperations', () => {
  let nodeOps: NodeOperations;
  let mockAccount: jest.Mocked<SPKAccount>;
  let mockApi: jest.Mocked<SPKAPI>;
  let mockKeychainAdapter: jest.Mocked<KeychainAdapter>;

  beforeEach(() => {
    mockAccount = {
      username: 'testuser',
      sign: jest.fn()
    } as any;

    mockApi = {
      get: jest.fn(),
      post: jest.fn()
    } as any;

    mockKeychainAdapter = {
      isAvailable: jest.fn().mockReturnValue(true),
      broadcastCustomJson: jest.fn()
    } as any;

    nodeOps = new NodeOperations(mockAccount, mockApi, mockKeychainAdapter);
  });

  // Note: registerNode tests removed as it's now handled by TokenOperations

  describe('registerAuthority', () => {
    it('should register a public key authority', async () => {
      const pubKey = 'STM12345678901234567890123456789012345678901234567890'; // 53 chars total
      
      mockKeychainAdapter.broadcastCustomJson.mockResolvedValueOnce({
        id: 'tx456'
      });

      const result = await nodeOps.registerAuthority(pubKey);

      expect(mockKeychainAdapter.broadcastCustomJson).toHaveBeenCalledWith(
        'testuser',
        'spk-register-authority',
        'Active',
        {
          pubKey,
          from: 'testuser'
        },
        'Register SPK Authority'
      );

      expect(result).toEqual({
        success: true,
        id: 'tx456'
      });
    });

    it('should throw error for invalid public key format', async () => {
      await expect(nodeOps.registerAuthority('invalid-key'))
        .rejects.toThrow('Invalid public key format');
    });

    it('should throw error for wrong key length', async () => {
      await expect(nodeOps.registerAuthority('STM123'))
        .rejects.toThrow('Invalid public key format');
    });

    it('should throw error when keychain is not available', async () => {
      const pubKey = 'STM12345678901234567890123456789012345678901234567890'; // 53 chars total
      mockKeychainAdapter.isAvailable.mockReturnValue(false);
      
      await expect(nodeOps.registerAuthority(pubKey))
        .rejects.toThrow('Keychain/Signer not available');
    });
  });

  describe('storeFiles', () => {
    it('should store single file on the network', async () => {
      const contractId = 'contract123';
      
      // Mock node status check - node is registered
      mockApi.get
        .mockResolvedValueOnce({
          IPFS: {
            a: 'https://my-node.com',
            b: 500,
            t: 1234567890
          }
        })
        .mockResolvedValueOnce({
          contract123: 'Qmpointer123'
        });

      mockKeychainAdapter.broadcastCustomJson.mockResolvedValueOnce({
        id: 'tx789'
      });

      const result = await nodeOps.storeFiles([contractId]);

      expect(mockApi.get).toHaveBeenCalledWith(`/services/testuser/IPFS`);
      expect(mockApi.get).toHaveBeenCalledWith('/api/cPointers/contract123');
      
      expect(mockKeychainAdapter.broadcastCustomJson).toHaveBeenCalledWith(
        'testuser',
        'spk-store',
        'Active',
        {
          items: ['contract123'],
          from: 'testuser'
        },
        'Store 1 contracts'
      );

      expect(result).toEqual({
        success: true,
        stored: ['contract123'],
        id: 'tx789'
      });
    });

    it('should store multiple files', async () => {
      const contractIds = ['contract1', 'contract2', 'contract3'];
      
      mockApi.get
        .mockResolvedValueOnce({ // Node status check
          IPFS: {
            a: 'https://my-node.com',
            b: 500,
            t: 1234567890
          }
        })
        .mockResolvedValueOnce({ contract1: 'Qm1' })
        .mockResolvedValueOnce({ contract2: 'Qm2' })
        .mockResolvedValueOnce({ contract3: 'Qm3' });

      mockKeychainAdapter.broadcastCustomJson.mockResolvedValueOnce({
        id: 'tx999'
      });

      const result = await nodeOps.storeFiles(contractIds);

      expect(mockApi.get).toHaveBeenCalledTimes(4); // 1 for node status + 3 for contracts
      expect(result.stored).toEqual(contractIds);
    });

    it('should handle non-existent contracts', async () => {
      mockApi.get
        .mockResolvedValueOnce({ // Node status check
          IPFS: {
            a: 'https://my-node.com',
            b: 500,
            t: 1234567890
          }
        })
        .mockResolvedValueOnce(null); // Contract doesn't exist

      await expect(nodeOps.storeFiles(['nonexistent']))
        .rejects.toThrow('Contract not found: nonexistent');
    });

    it('should validate node registration before storing', async () => {
      // First mock returns null for services check
      mockApi.get
        .mockResolvedValueOnce(null) // getNodeStatus returns no services
        .mockResolvedValueOnce({ contract123: 'Qm123' }); // contract exists

      await expect(nodeOps.storeFiles(['contract123']))
        .rejects.toThrow('Node not registered. Please register your node first.');
    });
  });

  describe('removeFiles', () => {
    it('should remove stored files', async () => {
      const contractIds = ['contract1', 'contract2'];
      
      mockApi.get
        .mockResolvedValueOnce({ contract1: 'Qm1' })
        .mockResolvedValueOnce({ contract2: 'Qm2' });

      mockKeychainAdapter.broadcastCustomJson.mockResolvedValueOnce({
        id: 'tx111'
      });

      const result = await nodeOps.removeFiles(contractIds);

      expect(mockKeychainAdapter.broadcastCustomJson).toHaveBeenCalledWith(
        'testuser',
        'spk-remove',
        'Active',
        {
          items: contractIds,
          from: 'testuser'
        },
        'Remove 2 contracts from storage'
      );

      expect(result).toEqual({
        success: true,
        removed: contractIds,
        id: 'tx111'
      });
    });

    it('should handle empty array', async () => {
      await expect(nodeOps.removeFiles([]))
        .rejects.toThrow('No files to remove');
    });
  });

  describe('extendContract', () => {
    it('should extend a storage contract', async () => {
      const contractId = 'contract123';
      const fileOwner = 'alice';
      const brocaAmount = 1000;
      const power = 1;

      mockApi.get.mockResolvedValueOnce({
        t: fileOwner,
        i: contractId,
        c: 3, // Active contract
        u: 1024 * 1024, // 1MB
        p: 3, // 3 providers
        e: '100000:0' // Expiry block
      });

      mockKeychainAdapter.broadcastCustomJson.mockResolvedValueOnce({
        id: 'tx222'
      });

      const result = await nodeOps.extendContract(contractId, fileOwner, brocaAmount, power);

      expect(mockKeychainAdapter.broadcastCustomJson).toHaveBeenCalledWith(
        'testuser',
        'spk-extend',
        'Active',
        {
          id: contractId,
          file_owner: fileOwner,
          broca: brocaAmount,
          power,
          from: 'testuser'
        },
        'Extend contract contract123 with 1000 BROCA'
      );

      expect(result).toEqual({
        success: true,
        id: 'tx222',
        contractId,
        extendedBy: expect.any(Number) // blocks
      });
    });

    it('should calculate extension blocks correctly', async () => {
      mockApi.get
        .mockResolvedValueOnce({
          t: 'alice',
          i: 'contract123',
          c: 3,
          u: 1024 * 1024 * 10, // 10MB
          p: 3,
          e: '100000:0'
        })
        .mockResolvedValueOnce({
          channel_bytes: 1024
        });

      mockKeychainAdapter.broadcastCustomJson.mockResolvedValueOnce({
        id: 'tx333'
      });

      const result = await nodeOps.extendContract('contract123', 'alice', 10000);

      // Verify extension calculation
      // broca_per_term = (10MB * 3 providers) / (1024 * 3) ≈ 10
      // blocks = (10000 / 10) * 28800 * 30 = 864,000,000 blocks
      expect(result.extendedBy).toBeGreaterThan(0);
    });

    it('should throw error for inactive contract', async () => {
      mockApi.get.mockResolvedValueOnce({
        c: 1 // Not active
      });

      await expect(nodeOps.extendContract('contract123', 'alice', 1000))
        .rejects.toThrow('Contract is not active');
    });
  });

  describe('getNodeStatus', () => {
    it('should get node registration status', async () => {
      mockApi.get.mockResolvedValueOnce({
        IPFS: {
          a: 'https://my-node.com',
          b: 500,
          t: 1234567890
        }
      });

      const status = await nodeOps.getNodeStatus();

      expect(mockApi.get).toHaveBeenCalledWith(`/services/testuser/IPFS`);
      expect(status).toEqual({
        registered: true,
        service: 'IPFS',
        domain: 'https://my-node.com',
        bidRate: 500,
        timestamp: 1234567890
      });
    });

    it('should return not registered when no services found', async () => {
      mockApi.get.mockResolvedValueOnce(null);

      const status = await nodeOps.getNodeStatus();

      expect(status).toEqual({
        registered: false
      });
    });
  });

  describe('getStoredContracts', () => {
    it('should get contracts being stored by the node', async () => {
      mockApi.get.mockResolvedValueOnce({
        contract1: {
          t: 'alice',
          i: 'contract1',
          n: {
            '1': 'testuser',
            '2': 'bob'
          },
          u: 1024 * 1024,
          e: '100000:0'
        },
        contract2: {
          t: 'bob',
          i: 'contract2',
          n: {
            '1': 'charlie',
            '2': 'testuser'
          },
          u: 2048 * 1024,
          e: '110000:0'
        }
      });

      const contracts = await nodeOps.getStoredContracts();

      expect(mockApi.get).toHaveBeenCalledWith(`/@testuser/storing`);
      expect(contracts).toHaveLength(2);
      expect(contracts[0]).toMatchObject({
        id: 'contract1',
        owner: 'alice',
        size: 1024 * 1024,
        isStoring: true
      });
    });
  });
});