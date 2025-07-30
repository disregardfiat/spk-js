import { NetworkAPI } from '../../../src/api/network';
import { HoneygraphClient } from '../../../src/api/honeygraph';

// Mock the HoneygraphClient
jest.mock('../../../src/api/honeygraph');

describe('NetworkAPI', () => {
  let networkAPI: NetworkAPI;
  let mockClient: jest.Mocked<HoneygraphClient>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = new HoneygraphClient() as jest.Mocked<HoneygraphClient>;
    networkAPI = new NetworkAPI(mockClient);
  });

  describe('getNetworkTopology', () => {
    it('should get network topology data', async () => {
      const mockTopology = {
        nodes: [
          {
            id: 'node1',
            username: 'alice',
            type: 'storage',
            connections: ['node2', 'node3'],
            metrics: {
              contracts: 150,
              reliability: 99.5
            }
          }
        ],
        edges: [
          {
            source: 'node1',
            target: 'node2',
            type: 'storage',
            weight: 15
          }
        ],
        clusters: [
          {
            id: 'cluster1',
            nodes: ['node1', 'node2', 'node3'],
            centralNode: 'node1'
          }
        ]
      };

      mockClient.getNetworkTopology.mockResolvedValueOnce(mockTopology);

      const result = await networkAPI.getNetworkTopology();

      expect(mockClient.getNetworkTopology).toHaveBeenCalled();
      expect(result).toEqual(mockTopology);
    });
  });

  describe('getServiceProviders', () => {
    it('should get providers for a specific service type', async () => {
      const mockProviders = [
        {
          username: 'node1',
          nodeId: 'node1-ipfs',
          service: {
            type: 'IPFS',
            endpoint: 'https://ipfs.node1.com',
            active: true,
            cost: 500,
            uptime: 99.8
          },
          lastGood: 98000000,
          reliability: 99.5
        }
      ];

      mockClient.getServiceProviders.mockResolvedValueOnce(mockProviders);

      const result = await networkAPI.getServiceProviders('IPFS');

      expect(mockClient.getServiceProviders).toHaveBeenCalledWith('IPFS');
      expect(result).toEqual(mockProviders);
    });
  });

  describe('getNetworkStats', () => {
    it('should get overall network statistics', async () => {
      const mockStats = {
        totalNodes: 150,
        activeNodes: 142,
        services: {
          IPFS: 120,
          POA: 80,
          STUN: 30
        },
        networkHealth: 95.5,
        totalTransactions24h: 45000,
        totalVolume24h: 1500000,
        averageBlockTime: 3.0,
        currentBlock: 98000000
      };

      mockClient.getNetworkStats.mockResolvedValueOnce(mockStats);

      const result = await networkAPI.getNetworkStats();

      expect(mockClient.getNetworkStats).toHaveBeenCalled();
      expect(result).toEqual(mockStats);
    });
  });

  describe('getNodeInfo', () => {
    it('should get detailed information about a node', async () => {
      const mockNodeInfo = {
        username: 'node1',
        nodeId: 'node1-main',
        services: [
          {
            type: 'IPFS',
            endpoint: 'https://ipfs.node1.com',
            active: true
          }
        ],
        metrics: {
          uptime: 99.8,
          reliability: 99.5,
          responseTime: 145,
          totalRequests24h: 12500
        },
        reputation: {
          score: 950,
          rank: 5,
          history: []
        }
      };

      mockClient.get = jest.fn().mockResolvedValueOnce(mockNodeInfo);

      const result = await networkAPI.getNodeInfo('node1');

      expect(mockClient.get).toHaveBeenCalledWith('/api/spk/network/node/node1');
      expect(result).toEqual(mockNodeInfo);
    });
  });

  describe('getNetworkHealth', () => {
    it('should get network health metrics', async () => {
      const mockHealth = {
        overall: 95.5,
        components: {
          consensus: 98.0,
          storage: 94.5,
          services: 96.0,
          market: 93.0
        },
        alerts: [
          {
            level: 'warning',
            component: 'storage',
            message: 'Low replication on 5% of files'
          }
        ],
        lastCheck: '2024-01-01T00:00:00Z'
      };

      mockClient.get = jest.fn().mockResolvedValueOnce(mockHealth);

      const result = await networkAPI.getNetworkHealth();

      expect(mockClient.get).toHaveBeenCalledWith('/api/spk/network/health');
      expect(result).toEqual(mockHealth);
    });
  });

  describe('getServiceHealth', () => {
    it('should get health status for a specific service type', async () => {
      const mockServiceHealth = {
        service: 'IPFS',
        healthy: 115,
        unhealthy: 5,
        totalProviders: 120,
        healthPercentage: 95.8,
        topProviders: [
          {
            username: 'node1',
            uptime: 99.9,
            responseTime: 120
          }
        ]
      };

      mockClient.get = jest.fn().mockResolvedValueOnce(mockServiceHealth);

      const result = await networkAPI.getServiceHealth('IPFS');

      expect(mockClient.get).toHaveBeenCalledWith('/api/spk/network/service/IPFS/health');
      expect(result).toEqual(mockServiceHealth);
    });
  });

  describe('getNetworkActivity', () => {
    it('should get recent network activity', async () => {
      const mockActivity = {
        recentBlocks: [
          {
            block: 98000000,
            timestamp: '2024-01-01T00:00:00Z',
            transactions: 150,
            operations: 300
          }
        ],
        activeUsers24h: 1250,
        newUsers24h: 45,
        topOperations: [
          {
            type: 'transfer',
            count: 5000
          }
        ]
      };

      mockClient.get = jest.fn().mockResolvedValueOnce(mockActivity);

      const result = await networkAPI.getNetworkActivity(24);

      expect(mockClient.get).toHaveBeenCalledWith('/api/spk/network/activity', { hours: 24 });
      expect(result).toEqual(mockActivity);
    });
  });

  describe('getPeerConnections', () => {
    it('should get peer connection information', async () => {
      const mockConnections = {
        node: 'node1',
        peers: [
          {
            nodeId: 'node2',
            latency: 45,
            quality: 98.5,
            dataTransferred: 1073741824,
            connectedSince: '2024-01-01T00:00:00Z'
          }
        ],
        totalPeers: 25,
        averageLatency: 52
      };

      mockClient.get = jest.fn().mockResolvedValueOnce(mockConnections);

      const result = await networkAPI.getPeerConnections('node1');

      expect(mockClient.get).toHaveBeenCalledWith('/api/spk/network/node/node1/peers');
      expect(result).toEqual(mockConnections);
    });
  });

  describe('getNetworkGrowth', () => {
    it('should get network growth metrics', async () => {
      const mockGrowth = {
        period: '30d',
        metrics: {
          newNodes: 45,
          newUsers: 1250,
          storageGrowth: 1099511627776, // 1TB
          transactionGrowth: 25.5
        },
        charts: {
          dailyNewUsers: [],
          dailyTransactions: []
        }
      };

      mockClient.get = jest.fn().mockResolvedValueOnce(mockGrowth);

      const result = await networkAPI.getNetworkGrowth(30);

      expect(mockClient.get).toHaveBeenCalledWith('/api/spk/network/growth', { days: 30 });
      expect(result).toEqual(mockGrowth);
    });
  });

  describe('getServiceDiscovery', () => {
    it('should discover available services', async () => {
      const mockServices = {
        services: [
          {
            type: 'IPFS',
            providers: 120,
            endpoints: []
          },
          {
            type: 'POA',
            providers: 80,
            endpoints: []
          }
        ],
        totalServices: 5,
        lastUpdate: '2024-01-01T00:00:00Z'
      };

      mockClient.get = jest.fn().mockResolvedValueOnce(mockServices);

      const result = await networkAPI.getServiceDiscovery();

      expect(mockClient.get).toHaveBeenCalledWith('/api/spk/network/services/discovery');
      expect(result).toEqual(mockServices);
    });
  });

  describe('getNetworkLatency', () => {
    it('should get network latency matrix', async () => {
      const mockLatency = {
        measurements: [
          {
            from: 'node1',
            to: 'node2',
            latency: 45,
            jitter: 5,
            packetLoss: 0.1
          }
        ],
        averageLatency: 52,
        p95Latency: 85,
        timestamp: '2024-01-01T00:00:00Z'
      };

      mockClient.get = jest.fn().mockResolvedValueOnce(mockLatency);

      const result = await networkAPI.getNetworkLatency();

      expect(mockClient.get).toHaveBeenCalledWith('/api/spk/network/latency');
      expect(result).toEqual(mockLatency);
    });
  });
});