import { HoneygraphClient } from './honeygraph';

export interface NetworkNode {
  id: string;
  username: string;
  type: string;
  connections: string[];
  metrics: {
    contracts?: number;
    reliability?: number;
    uptime?: number;
  };
}

export interface NetworkEdge {
  source: string;
  target: string;
  type: string;
  weight: number;
}

export interface NetworkCluster {
  id: string;
  nodes: string[];
  centralNode: string;
}

export interface NetworkTopology {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  clusters: NetworkCluster[];
}

export interface ServiceProvider {
  username: string;
  nodeId: string;
  service: {
    type: string;
    endpoint: string;
    active: boolean;
    cost: number;
    uptime: number;
  };
  lastGood: number;
  reliability: number;
}

export interface NetworkStats {
  totalNodes: number;
  activeNodes: number;
  services: Record<string, number>;
  networkHealth: number;
  totalTransactions24h: number;
  totalVolume24h: number;
  averageBlockTime: number;
  currentBlock: number;
}

export interface NodeInfo {
  username: string;
  nodeId: string;
  services: Array<{
    type: string;
    endpoint: string;
    active: boolean;
  }>;
  metrics: {
    uptime: number;
    reliability: number;
    responseTime: number;
    totalRequests24h: number;
  };
  reputation: {
    score: number;
    rank: number;
    history: any[];
  };
}

export interface NetworkHealth {
  overall: number;
  components: {
    consensus: number;
    storage: number;
    services: number;
    market: number;
  };
  alerts: Array<{
    level: string;
    component: string;
    message: string;
  }>;
  lastCheck: string;
}

export interface ServiceHealth {
  service: string;
  healthy: number;
  unhealthy: number;
  totalProviders: number;
  healthPercentage: number;
  topProviders: Array<{
    username: string;
    uptime: number;
    responseTime: number;
  }>;
}

export interface NetworkActivity {
  recentBlocks: Array<{
    block: number;
    timestamp: string;
    transactions: number;
    operations: number;
  }>;
  activeUsers24h: number;
  newUsers24h: number;
  topOperations: Array<{
    type: string;
    count: number;
  }>;
}

export interface PeerConnection {
  nodeId: string;
  latency: number;
  quality: number;
  dataTransferred: number;
  connectedSince: string;
}

export interface NetworkGrowth {
  period: string;
  metrics: {
    newNodes: number;
    newUsers: number;
    storageGrowth: number;
    transactionGrowth: number;
  };
  charts: {
    dailyNewUsers: any[];
    dailyTransactions: any[];
  };
}

export interface NetworkLatency {
  measurements: Array<{
    from: string;
    to: string;
    latency: number;
    jitter: number;
    packetLoss: number;
  }>;
  averageLatency: number;
  p95Latency: number;
  timestamp: string;
}

export class NetworkAPI {
  private client: HoneygraphClient;

  constructor(client: HoneygraphClient) {
    this.client = client;
  }

  /**
   * Get network topology visualization data
   */
  async getNetworkTopology(): Promise<NetworkTopology> {
    return this.client.getNetworkTopology();
  }

  /**
   * Get service providers by type
   */
  async getServiceProviders(type: string): Promise<ServiceProvider[]> {
    return this.client.getServiceProviders(type);
  }

  /**
   * Get overall network statistics
   */
  async getNetworkStats(): Promise<NetworkStats> {
    return this.client.getNetworkStats();
  }

  /**
   * Get detailed information about a specific node
   */
  async getNodeInfo(nodeId: string): Promise<NodeInfo> {
    return this.client.get(`/api/spk/network/node/${nodeId}`);
  }

  /**
   * Get network health metrics
   */
  async getNetworkHealth(): Promise<NetworkHealth> {
    return this.client.get('/api/spk/network/health');
  }

  /**
   * Get health status for a specific service type
   */
  async getServiceHealth(serviceType: string): Promise<ServiceHealth> {
    return this.client.get(`/api/spk/network/service/${serviceType}/health`);
  }

  /**
   * Get recent network activity
   */
  async getNetworkActivity(hours: number = 24): Promise<NetworkActivity> {
    return this.client.get('/api/spk/network/activity', { hours });
  }

  /**
   * Get peer connections for a node
   */
  async getPeerConnections(nodeId: string): Promise<{
    node: string;
    peers: PeerConnection[];
    totalPeers: number;
    averageLatency: number;
  }> {
    return this.client.get(`/api/spk/network/node/${nodeId}/peers`);
  }

  /**
   * Get network growth metrics
   */
  async getNetworkGrowth(days: number = 30): Promise<NetworkGrowth> {
    return this.client.get('/api/spk/network/growth', { days });
  }

  /**
   * Discover available services
   */
  async getServiceDiscovery(): Promise<{
    services: Array<{
      type: string;
      providers: number;
      endpoints: string[];
    }>;
    totalServices: number;
    lastUpdate: string;
  }> {
    return this.client.get('/api/spk/network/services/discovery');
  }

  /**
   * Get network latency matrix
   */
  async getNetworkLatency(): Promise<NetworkLatency> {
    return this.client.get('/api/spk/network/latency');
  }

  /**
   * Get node rankings by various metrics
   */
  async getNodeRankings(metric: 'reliability' | 'uptime' | 'capacity' | 'reputation' = 'reliability', limit: number = 50): Promise<Array<{
    rank: number;
    username: string;
    nodeId: string;
    score: number;
    metrics: any;
  }>> {
    const result = await this.client.get('/api/spk/network/nodes/rankings', { metric, limit });
    return result.rankings || [];
  }

  /**
   * Get network consensus status
   */
  async getConsensusStatus(): Promise<{
    consensusReached: boolean;
    participatingNodes: number;
    consensusPercentage: number;
    lastConsensusBlock: number;
    nextConsensusEstimate: string;
  }> {
    return this.client.get('/api/spk/network/consensus/status');
  }

  /**
   * Get network bandwidth utilization
   */
  async getBandwidthStats(): Promise<{
    totalBandwidth: number;
    utilized: number;
    utilizationPercent: number;
    topConsumers: Array<{
      nodeId: string;
      bandwidth: number;
      percentage: number;
    }>;
  }> {
    return this.client.get('/api/spk/network/bandwidth/stats');
  }

  /**
   * Get service pricing comparison
   */
  async getServicePricing(serviceType: string): Promise<{
    service: string;
    providers: Array<{
      username: string;
      cost: number;
      uptime: number;
      reliability: number;
      endpoint: string;
    }>;
    averageCost: number;
    medianCost: number;
  }> {
    return this.client.get(`/api/spk/network/service/${serviceType}/pricing`);
  }
}