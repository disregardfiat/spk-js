import { StorageAPI } from '../../../src/api/storage';
import { HoneygraphClient } from '../../../src/api/honeygraph';

// Mock the HoneygraphClient
jest.mock('../../../src/api/honeygraph');

describe('StorageAPI', () => {
  let storageAPI: StorageAPI;
  let mockClient: jest.Mocked<HoneygraphClient>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = new HoneygraphClient() as jest.Mocked<HoneygraphClient>;
    storageAPI = new StorageAPI(mockClient);
  });

  describe('getStorageStats', () => {
    it('should get network-wide storage statistics', async () => {
      const mockStats = {
        totalFiles: 125000,
        totalContracts: 45000,
        activeContracts: 38000,
        expiredContracts: 7000,
        totalNodes: 150,
        activeNodes: 142,
        totalStorageSize: 1099511627776, // 1TB
        averageReplicationFactor: 3.2,
        topStorageNodes: [
          {
            username: 'node1',
            contractsStoring: 1200,
            reliability: 99.9,
            uptime: 99.8,
            totalStorage: 54975581388 // ~50GB
          }
        ],
        recentActivity: {
          last24h: {
            newFiles: 450,
            newContracts: 380,
            expiredContracts: 45
          }
        }
      };

      mockClient.getStorageStats.mockResolvedValueOnce(mockStats);

      const result = await storageAPI.getStorageStats();

      expect(mockClient.getStorageStats).toHaveBeenCalled();
      expect(result).toEqual(mockStats);
    });
  });

  describe('getStorageProviders', () => {
    it('should get storage providers for a specific owner', async () => {
      const mockProviders = {
        owner: 'alice',
        providers: [
          {
            username: 'node1',
            nodeId: 'node1-ipfs',
            contractsStoring: 15,
            totalSize: 1073741824, // 1GB
            reliability: 99.5,
            lastGood: 98000000
          }
        ],
        totalProviders: 1
      };

      mockClient.getStorageProviders.mockResolvedValueOnce(mockProviders);

      const result = await storageAPI.getStorageProviders('alice');

      expect(mockClient.getStorageProviders).toHaveBeenCalledWith('alice');
      expect(result).toEqual(mockProviders);
    });

    it('should get all storage providers when no owner specified', async () => {
      mockClient.get = jest.fn().mockResolvedValueOnce({
        providers: [{}, {}, {}]
      });

      const result = await storageAPI.getAllStorageProviders();

      expect(mockClient.get).toHaveBeenCalledWith('/api/spk/storage/providers');
      expect(result).toHaveLength(3);
    });
  });

  describe('getUnderstoredContracts', () => {
    it('should get contracts that need more storage nodes', async () => {
      const mockContracts = [
        {
          id: 'alice:0:12345-abc',
          owner: 'alice',
          power: 5,
          nodeTotal: 2,
          needed: 3,
          expiresBlock: 98000000,
          fileCount: 10,
          totalSize: 104857600
        }
      ];

      mockClient.getUnderstoredContracts.mockResolvedValueOnce(mockContracts);

      const result = await storageAPI.getUnderstoredContracts();

      expect(mockClient.getUnderstoredContracts).toHaveBeenCalled();
      expect(result).toEqual(mockContracts);
      expect(result[0].needed).toBe(3);
    });
  });

  describe('getContractsByNode', () => {
    it('should get contracts stored by a specific node', async () => {
      const mockContracts = [
        {
          id: 'alice:0:12345-abc',
          owner: { username: 'alice' },
          status: 'ACTIVE',
          expiresBlock: 98000000,
          fileCount: 5,
          power: 3
        }
      ];

      mockClient.getContractsByNode.mockResolvedValueOnce(mockContracts);

      const result = await storageAPI.getContractsByNode('node1');

      expect(mockClient.getContractsByNode).toHaveBeenCalledWith('node1');
      expect(result).toEqual(mockContracts);
    });
  });

  describe('getNodeStats', () => {
    it('should get detailed statistics for a storage node', async () => {
      const mockStats = {
        username: 'node1',
        nodeId: 'node1-ipfs',
        services: {
          IPFS: {
            endpoint: 'https://ipfs.node1.com',
            active: true,
            lastCheck: '2024-01-01T00:00:00Z'
          }
        },
        stats: {
          contractsStoring: 1200,
          totalStorage: 54975581388,
          reliability: 99.9,
          uptime: 99.8,
          lastGood: 98000000,
          wins: 450,
          attempts: 455,
          bidRate: 500
        },
        recentActivity: {
          newContracts24h: 45,
          expiredContracts24h: 3,
          validations24h: 1440
        }
      };

      mockClient.get = jest.fn().mockResolvedValueOnce(mockStats);

      const result = await storageAPI.getNodeStats('node1');

      expect(mockClient.get).toHaveBeenCalledWith('/api/spk/storage/node/node1/stats');
      expect(result).toEqual(mockStats);
    });
  });

  describe('getContractDetails', () => {
    it('should get detailed contract information', async () => {
      const mockContract = {
        id: 'alice:0:12345-abc',
        purchaser: 'alice',
        owner: 'alice',
        power: 3,
        nodeTotal: 3,
        storageNodes: ['node1', 'node2', 'node3'],
        expiresBlock: 98000000,
        status: 'ACTIVE',
        fileCount: 5,
        utilized: 52428800,
        metadata: {
          autoRenew: true,
          encrypted: false
        },
        files: [
          {
            cid: 'QmTest1',
            name: 'file1.txt',
            size: 10485760
          }
        ],
        history: [
          {
            event: 'created',
            block: 97000000,
            details: 'Contract created'
          }
        ]
      };

      mockClient.get = jest.fn().mockResolvedValueOnce(mockContract);

      const result = await storageAPI.getContractDetails('alice:0:12345-abc');

      expect(mockClient.get).toHaveBeenCalledWith('/api/spk/storage/contract/alice:0:12345-abc');
      expect(result).toEqual(mockContract);
    });
  });

  describe('findStorageOpportunities', () => {
    it('should find profitable storage opportunities', async () => {
      const mockOpportunities = [
        {
          contract: {
            id: 'bob:0:12346-def',
            power: 5,
            nodeTotal: 1,
            needed: 4,
            bidRate: 600
          },
          potentialEarnings: 2400,
          competitionLevel: 'low',
          recommendedBid: 550
        }
      ];

      mockClient.get = jest.fn().mockResolvedValueOnce({ opportunities: mockOpportunities });

      const result = await storageAPI.findStorageOpportunities({
        minPower: 3,
        maxCompetition: 5
      });

      expect(mockClient.get).toHaveBeenCalledWith('/api/spk/storage/opportunities', {
        minPower: 3,
        maxCompetition: 5
      });
      expect(result).toEqual(mockOpportunities);
    });
  });

  describe('getStorageMarketStats', () => {
    it('should get storage market statistics', async () => {
      const mockMarketStats = {
        averageBidRate: 500,
        medianBidRate: 480,
        totalBidVolume: 5000000,
        activeNodes: 142,
        averageContractSize: 10485760,
        averageContractDuration: 30,
        topBidders: [
          {
            username: 'node1',
            bidRate: 450,
            wins: 450,
            successRate: 98.9
          }
        ],
        priceHistory: {
          '24h': { avg: 495, min: 450, max: 550 },
          '7d': { avg: 500, min: 440, max: 580 }
        }
      };

      mockClient.get = jest.fn().mockResolvedValueOnce(mockMarketStats);

      const result = await storageAPI.getStorageMarketStats();

      expect(mockClient.get).toHaveBeenCalledWith('/api/spk/storage/market/stats');
      expect(result).toEqual(mockMarketStats);
    });
  });

  describe('calculateStorageROI', () => {
    it('should calculate ROI for storage provision', async () => {
      const mockROI = {
        monthlyRevenue: 150000, // millitokens
        monthlyRevenueUSD: 15.0,
        storageRequired: 107374182400, // 100GB
        roiPercentage: 25.5,
        breakEvenDays: 120,
        assumptions: {
          averageBidRate: 500,
          winRate: 90,
          tokenPriceUSD: 0.0001
        }
      };

      mockClient.get = jest.fn().mockResolvedValueOnce(mockROI);

      const result = await storageAPI.calculateStorageROI({
        storageCapacity: 107374182400,
        bidRate: 500
      });

      expect(mockClient.get).toHaveBeenCalledWith('/api/spk/storage/calculate-roi', {
        storageCapacity: 107374182400,
        bidRate: 500
      });
      expect(result).toEqual(mockROI);
    });
  });

  describe('getExpiringContracts', () => {
    it('should get contracts expiring soon', async () => {
      const mockExpiring = [
        {
          id: 'alice:0:12345-abc',
          owner: 'alice',
          expiresBlock: 97500000,
          expiresIn: '2 days',
          autoRenew: false,
          fileCount: 5,
          storageNodes: ['node1', 'node2']
        }
      ];

      mockClient.get = jest.fn().mockResolvedValueOnce({ contracts: mockExpiring });

      const result = await storageAPI.getExpiringContracts(7);

      expect(mockClient.get).toHaveBeenCalledWith('/api/spk/storage/contracts/expiring', {
        days: 7
      });
      expect(result).toEqual(mockExpiring);
    });
  });
});