import { HoneygraphClient } from './honeygraph';

export interface StorageStats {
  totalFiles: number;
  totalContracts: number;
  activeContracts: number;
  expiredContracts: number;
  totalNodes: number;
  activeNodes: number;
  totalStorageSize: number;
  averageReplicationFactor: number;
  topStorageNodes: StorageNodeInfo[];
  recentActivity: {
    last24h: {
      newFiles: number;
      newContracts: number;
      expiredContracts: number;
    };
  };
}

export interface StorageNodeInfo {
  username: string;
  contractsStoring: number;
  reliability: number;
  uptime: number;
  totalStorage: number;
  nodeId?: string;
  lastGood?: number;
}

export interface StorageProvider {
  username: string;
  nodeId: string;
  contractsStoring: number;
  totalSize: number;
  reliability: number;
  lastGood: number;
}

export interface UnderstoredContract {
  id: string;
  owner: string;
  power: number;
  nodeTotal: number;
  needed: number;
  expiresBlock: number;
  fileCount: number;
  totalSize: number;
}

export interface ContractDetails {
  id: string;
  purchaser: string;
  owner: string;
  power: number;
  nodeTotal: number;
  storageNodes: string[];
  expiresBlock: number;
  status: string;
  fileCount: number;
  utilized: number;
  metadata: {
    autoRenew: boolean;
    encrypted: boolean;
  };
  files?: Array<{
    cid: string;
    name: string;
    size: number;
  }>;
  history?: Array<{
    event: string;
    block: number;
    details: string;
  }>;
}

export interface StorageOpportunity {
  contract: {
    id: string;
    power: number;
    nodeTotal: number;
    needed: number;
    bidRate: number;
  };
  potentialEarnings: number;
  competitionLevel: string;
  recommendedBid: number;
}

export interface StorageMarketStats {
  averageBidRate: number;
  medianBidRate: number;
  totalBidVolume: number;
  activeNodes: number;
  averageContractSize: number;
  averageContractDuration: number;
  topBidders: Array<{
    username: string;
    bidRate: number;
    wins: number;
    successRate: number;
  }>;
  priceHistory: {
    '24h': { avg: number; min: number; max: number };
    '7d': { avg: number; min: number; max: number };
  };
}

export interface StorageROI {
  monthlyRevenue: number;
  monthlyRevenueUSD: number;
  storageRequired: number;
  roiPercentage: number;
  breakEvenDays: number;
  assumptions: {
    averageBidRate: number;
    winRate: number;
    tokenPriceUSD: number;
  };
}

export interface ExpiringContract {
  id: string;
  owner: string;
  expiresBlock: number;
  expiresIn: string;
  autoRenew: boolean;
  fileCount: number;
  storageNodes: string[];
}

export class StorageAPI {
  private client: HoneygraphClient;

  constructor(client: HoneygraphClient) {
    this.client = client;
  }

  /**
   * Get network-wide storage statistics
   */
  async getStorageStats(): Promise<StorageStats> {
    return this.client.getStorageStats();
  }

  /**
   * Get storage providers for a specific owner
   */
  async getStorageProviders(owner: string): Promise<any> {
    return this.client.getStorageProviders(owner);
  }

  /**
   * Get all storage providers
   */
  async getAllStorageProviders(): Promise<StorageProvider[]> {
    const result = await this.client.get('/api/spk/storage/providers');
    return result.providers || [];
  }

  /**
   * Get contracts that need more storage nodes
   */
  async getUnderstoredContracts(): Promise<UnderstoredContract[]> {
    return this.client.getUnderstoredContracts();
  }

  /**
   * Get contracts stored by a specific node
   */
  async getContractsByNode(nodeId: string): Promise<any[]> {
    return this.client.getContractsByNode(nodeId);
  }

  /**
   * Get detailed statistics for a storage node
   */
  async getNodeStats(nodeId: string): Promise<any> {
    return this.client.get(`/api/spk/storage/node/${nodeId}/stats`);
  }

  /**
   * Get detailed contract information
   */
  async getContractDetails(contractId: string): Promise<ContractDetails> {
    return this.client.get(`/api/spk/storage/contract/${contractId}`);
  }

  /**
   * Find profitable storage opportunities
   */
  async findStorageOpportunities(filters?: {
    minPower?: number;
    maxCompetition?: number;
    minBidRate?: number;
  }): Promise<StorageOpportunity[]> {
    const result = await this.client.get('/api/spk/storage/opportunities', filters);
    return result.opportunities || [];
  }

  /**
   * Get storage market statistics
   */
  async getStorageMarketStats(): Promise<StorageMarketStats> {
    return this.client.get('/api/spk/storage/market/stats');
  }

  /**
   * Calculate ROI for storage provision
   */
  async calculateStorageROI(params: {
    storageCapacity: number;
    bidRate: number;
    electricityCostPerKwh?: number;
  }): Promise<StorageROI> {
    return this.client.get('/api/spk/storage/calculate-roi', params);
  }

  /**
   * Get contracts expiring soon
   */
  async getExpiringContracts(days: number = 7): Promise<ExpiringContract[]> {
    const result = await this.client.get('/api/spk/storage/contracts/expiring', { days });
    return result.contracts || [];
  }

  /**
   * Get storage node rankings
   */
  async getStorageNodeRankings(metric: 'reliability' | 'capacity' | 'earnings' = 'reliability', limit: number = 50): Promise<any[]> {
    const result = await this.client.get('/api/spk/storage/nodes/rankings', { metric, limit });
    return result.nodes || [];
  }

  /**
   * Analyze storage demand by file type
   */
  async getStorageDemandAnalysis(): Promise<any> {
    return this.client.get('/api/spk/storage/demand-analysis');
  }

  /**
   * Get recommended bid rate for a node
   */
  async getRecommendedBidRate(nodeCapacity: number, targetWinRate: number = 80): Promise<{
    recommendedBid: number;
    estimatedWins: number;
    competitionLevel: string;
  }> {
    return this.client.get('/api/spk/storage/recommend-bid', {
      capacity: nodeCapacity,
      targetWinRate
    });
  }

  /**
   * Get storage health metrics
   */
  async getStorageHealth(): Promise<{
    overallHealth: number;
    replicationHealth: number;
    nodeAvailability: number;
    dataIntegrity: number;
    alerts: string[];
  }> {
    return this.client.get('/api/spk/storage/health');
  }
}