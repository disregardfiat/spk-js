import { UserAPI } from '../../../src/api/user';
import { HoneygraphClient } from '../../../src/api/honeygraph';

// Mock the HoneygraphClient
jest.mock('../../../src/api/honeygraph');

describe('UserAPI', () => {
  let userAPI: UserAPI;
  let mockClient: jest.Mocked<HoneygraphClient>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = new HoneygraphClient() as jest.Mocked<HoneygraphClient>;
    userAPI = new UserAPI(mockClient);
  });

  describe('getUserProfile', () => {
    it('should fetch complete user profile with all data', async () => {
      const mockUserData = {
        username: 'alice',
        larynxBalance: 1000000,
        spkBalance: 500000,
        brocaBalance: 250000,
        liquidBroca: 200000,
        power: 150000,
        powerGranted: 50000,
        contracts: [
          {
            id: 'alice:0:12345-abc',
            status: 'ACTIVE',
            expiresBlock: 98000000,
            fileCount: 5,
            utilized: 1048576,
            power: 1000
          }
        ],
        services: [
          {
            id: 'alice-ipfs-1',
            type: 'IPFS',
            endpoint: 'https://ipfs.alice.com',
            active: true,
            uptime: 99.9
          }
        ],
        files: [
          {
            cid: 'QmTest123',
            name: 'document.pdf',
            size: 1024000,
            path: '/Documents/document.pdf',
            tags: ['important', 'work']
          }
        ],
        nodeMarket: {
          bidRate: 500,
          bidAmount: 10000,
          wins: 45,
          attempts: 50
        },
        dexOrders: [
          {
            id: 'order-123',
            pair: 'LARYNX:HIVE',
            type: 'BUY',
            rate: 0.1,
            amount: 1000,
            filled: 0,
            status: 'OPEN'
          }
        ],
        delegationsOut: [
          {
            to: { username: 'bob' },
            amount: 50000,
            vestsPerDay: 100
          }
        ],
        delegationsIn: [
          {
            from: { username: 'charlie' },
            amount: 25000,
            vestsPerDay: 50
          }
        ]
      };

      mockClient.getUserProfile.mockResolvedValueOnce(mockUserData);

      const result = await userAPI.getUserProfile('alice');

      expect(mockClient.getUserProfile).toHaveBeenCalledWith('alice', undefined);
      expect(result).toEqual(mockUserData);
    });

    it('should support custom include options', async () => {
      const mockData = { username: 'alice', larynxBalance: 1000000 };
      mockClient.getUserProfile.mockResolvedValueOnce(mockData);

      await userAPI.getUserProfile('alice', { include: ['balances', 'contracts'] });

      expect(mockClient.getUserProfile).toHaveBeenCalledWith('alice', { include: ['balances', 'contracts'] });
    });

    it('should handle user not found', async () => {
      mockClient.getUserProfile.mockRejectedValueOnce(new Error('User not found'));

      await expect(userAPI.getUserProfile('nonexistent')).rejects.toThrow('User not found');
    });
  });

  describe('getUserBalances', () => {
    it('should fetch only balance information', async () => {
      const mockBalances = {
        larynxBalance: 1000000,
        spkBalance: 500000,
        brocaBalance: 250000,
        liquidBroca: 200000,
        power: 150000,
        powerGranted: 50000
      };

      mockClient.getUserProfile.mockResolvedValueOnce(mockBalances);

      const result = await userAPI.getUserBalances('alice');

      expect(mockClient.getUserProfile).toHaveBeenCalledWith('alice', { include: ['balances'] });
      expect(result).toEqual({
        larynx: 1000,      // Converted from millitokens
        spk: 500,          // Converted from millitokens
        broca: 250000,     // BROCA is not in millitokens
        liquidBroca: 200000,
        power: 150,        // Converted from millitokens
        powerGranted: 50   // Converted from millitokens
      });
    });

    it('should convert balance values to numbers in tokens (not millitokens)', async () => {
      const mockBalances = {
        larynxBalance: 1000000, // 1000 LARYNX
        spkBalance: 500000,     // 500 SPK
        brocaBalance: 250000,   // 250000 BROCA (no conversion)
        liquidBroca: 200000,
        power: 150000,
        powerGranted: 50000
      };

      mockClient.getUserProfile.mockResolvedValueOnce(mockBalances);

      const result = await userAPI.getUserBalances('alice');

      expect(result).toEqual({
        larynx: 1000,      // Converted to tokens
        spk: 500,          // Converted to tokens
        broca: 250000,     // No conversion for BROCA
        liquidBroca: 200000,
        power: 150,        // Converted to tokens
        powerGranted: 50    // Converted to tokens
      });
    });
  });

  describe('getUserContracts', () => {
    it('should fetch user storage contracts', async () => {
      const mockContracts = {
        contracts: [
          {
            id: 'alice:0:12345-abc',
            status: 'ACTIVE',
            expiresBlock: 98000000,
            fileCount: 5,
            utilized: 1048576,
            power: 1000,
            metadata: {
              autoRenew: true,
              encrypted: false
            }
          },
          {
            id: 'alice:0:12346-def',
            status: 'EXPIRED',
            expiresBlock: 97000000,
            fileCount: 2,
            utilized: 524288,
            power: 500
          }
        ],
        contractsStoring: [
          {
            id: 'bob:0:12347-ghi',
            owner: { username: 'bob' },
            status: 'ACTIVE',
            expiresBlock: 98500000
          }
        ]
      };

      mockClient.getUserProfile.mockResolvedValueOnce(mockContracts);

      const result = await userAPI.getUserContracts('alice');

      expect(mockClient.getUserProfile).toHaveBeenCalledWith('alice', { include: ['contracts'] });
      expect(result).toEqual({
        owned: mockContracts.contracts,
        storing: mockContracts.contractsStoring
      });
    });

    it('should handle users with no contracts', async () => {
      mockClient.getUserProfile.mockResolvedValueOnce({});

      const result = await userAPI.getUserContracts('alice');

      expect(result).toEqual({
        owned: [],
        storing: []
      });
    });
  });

  describe('getUserServices', () => {
    it('should fetch user registered services', async () => {
      const mockServices = {
        services: [
          {
            id: 'alice-ipfs-1',
            type: 'IPFS',
            endpoint: 'https://ipfs.alice.com',
            active: true,
            uptime: 99.9
          },
          {
            id: 'alice-poa-1',
            type: 'POA',
            endpoint: 'https://poa.alice.com',
            active: true,
            uptime: 98.5
          }
        ],
        serviceEndpoints: [
          {
            url: 'https://ipfs.alice.com',
            healthy: true,
            lastCheck: '2024-01-01T00:00:00Z'
          }
        ]
      };

      mockClient.getUserProfile.mockResolvedValueOnce(mockServices);

      const result = await userAPI.getUserServices('alice');

      expect(mockClient.getUserProfile).toHaveBeenCalledWith('alice', { include: ['services'] });
      expect(result).toEqual(mockServices.services);
    });
  });

  describe('getUserDelegations', () => {
    it('should fetch delegation information', async () => {
      const mockDelegations = {
        delegationsOut: [
          {
            to: { username: 'bob' },
            amount: 50000,
            vestsPerDay: 100
          }
        ],
        delegationsIn: [
          {
            from: { username: 'charlie' },
            amount: 25000,
            vestsPerDay: 50
          }
        ]
      };

      mockClient.getUserProfile.mockResolvedValueOnce(mockDelegations);

      const result = await userAPI.getUserDelegations('alice');

      expect(mockClient.getUserProfile).toHaveBeenCalledWith('alice', { include: ['delegations'] });
      expect(result).toEqual({
        outgoing: mockDelegations.delegationsOut,
        incoming: mockDelegations.delegationsIn
      });
    });
  });

  describe('getUserMarketActivity', () => {
    it('should fetch user market activity', async () => {
      const mockMarketData = {
        nodeMarket: {
          bidRate: 500,
          bidAmount: 10000,
          wins: 45,
          attempts: 50
        },
        dexOrders: [
          {
            id: 'order-123',
            pair: 'LARYNX:HIVE',
            type: 'BUY',
            rate: 0.1,
            amount: 1000,
            filled: 0,
            status: 'OPEN'
          }
        ]
      };

      mockClient.getUserProfile.mockResolvedValueOnce(mockMarketData);

      const result = await userAPI.getUserMarketActivity('alice');

      expect(mockClient.getUserProfile).toHaveBeenCalledWith('alice', { include: ['market'] });
      expect(result).toEqual({
        nodeMarket: mockMarketData.nodeMarket,
        dexOrders: mockMarketData.dexOrders
      });
    });
  });

  describe('getUserFiles', () => {
    it('should fetch user files', async () => {
      const mockFiles = {
        files: [
          {
            cid: 'QmTest123',
            name: 'document.pdf',
            size: 1024000,
            path: '/Documents/document.pdf',
            tags: ['important', 'work'],
            uploadedAt: '2024-01-01T00:00:00Z'
          },
          {
            cid: 'QmTest456',
            name: 'image.jpg',
            size: 2048000,
            path: '/Images/image.jpg',
            tags: ['photo'],
            uploadedAt: '2024-01-02T00:00:00Z'
          }
        ]
      };

      mockClient.getUserProfile.mockResolvedValueOnce(mockFiles);

      const result = await userAPI.getUserFiles('alice', { limit: 100 });

      expect(mockClient.getUserProfile).toHaveBeenCalledWith('alice', { include: ['files'] });
      expect(result).toEqual(mockFiles.files);
    });

    it('should support filtering by path', async () => {
      const mockFiles = {
        files: [
          {
            cid: 'QmTest123',
            name: 'document.pdf',
            path: '/Documents/document.pdf'
          }
        ]
      };

      mockClient.getUserProfile.mockResolvedValueOnce(mockFiles);

      const result = await userAPI.getUserFiles('alice', { path: '/Documents' });

      // Should filter client-side
      expect(result).toHaveLength(1);
      expect(result[0].path).toBe('/Documents/document.pdf');
    });
  });

  describe('getUserSummary', () => {
    it('should return a summary of user data', async () => {
      const mockUserData = {
        username: 'alice',
        larynxBalance: 1000000,
        spkBalance: 500000,
        brocaBalance: 250000,
        power: 150000,
        contracts: [
          { status: 'ACTIVE' },
          { status: 'ACTIVE' },
          { status: 'EXPIRED' }
        ],
        services: [
          { type: 'IPFS', active: true },
          { type: 'POA', active: true }
        ],
        files: new Array(25)
      };

      mockClient.getUserProfile.mockResolvedValueOnce(mockUserData);

      const result = await userAPI.getUserSummary('alice');

      expect(result).toEqual({
        username: 'alice',
        balances: {
          larynx: 1000,
          spk: 500,
          broca: 250000,
          power: 150
        },
        stats: {
          totalContracts: 3,
          activeContracts: 2,
          totalFiles: 25,
          activeServices: 2
        }
      });
    });
  });
});