import { SPKAccount } from './core/account';
import { SPKFile, UploadOptions, UploadResult } from './storage/file';
import { SPKFileUpload, BatchUploadResult } from './storage/file-upload';
import { BrocaCalculator } from './tokens/broca';
import { SPKConfig } from './core/config';
import { SPKDrive } from './drive';
import { ProtocolManager } from './core/protocol';
import { TokenOperations } from './tokens/operations';
import { FileSystem } from './filesystem';
import { HoneygraphClient, UserAPI, FileSearchAPI, StorageAPI, MarketAPI, NetworkAPI, GovernanceAPI } from './api';

export * from './core/account';
export * from './core/api';
export * from './core/config';
export * from './core/keychain-adapter';
export * from './core/protocol';
export * from './tokens/operations';
export { 
  UploadOptions, 
  UploadResult, 
  FileData,
  FileMetadataItem
} from './storage/file';
export { BatchUploadResult } from './storage/file-upload';
export * from './storage/metadata';
export * from './storage/file-metadata';
export * from './tokens/broca';
export { 
  SPKDrive,
  SPKFile as DriveFile,
  SPKFolder as DriveFolder,
  SPKContract,
  FileMetadata as DriveFileMetadata 
} from './drive';

// Re-export specific classes for easier access
export { BrocaCalculator } from './tokens/broca';
export { SPKAccount } from './core/account';
export { SPKAPI } from './core/api';

// Export wallet calculation methods
export * as walletCalculations from './wallet/calculations';
export * as precision from './utils/precision';

// Export UI utilities
export * from './ui/icons';

// Export filesystem functionality
export * from './filesystem';

// Export Honeygraph APIs - be selective to avoid conflicts
export { 
  HoneygraphClient, 
  UserAPI, 
  FileSearchAPI,
  HiveAPI
} from './api';
export type {
  HoneygraphOptions,
  UserProfileOptions,
  FileSearchOptions as HoneygraphFileSearchOptions,
  UserBalances,
  UserContract,
  StoringContract,
  UserService,
  Delegation,
  NodeMarket,
  DexOrder,
  UserFile,
  UserFilesOptions,
  UserSummary,
  FileSearchResult,
  FileProvider,
  FileProvidersResult,
  FileMetadata as HoneygraphFileMetadata,
  FileStats,
  SimilarFile
} from './api';

/**
 * Main SPK Network interface
 */
export default class SPK {
  public account: SPKAccount;
  private file: SPKFile;
  public fileUpload: SPKFileUpload;
  public drive: SPKDrive;
  private protocol: ProtocolManager;
  private tokens: TokenOperations;
  public filesystem: FileSystem;
  public honeygraph: HoneygraphClient;
  public users: UserAPI;
  public files: FileSearchAPI;
  public storage: StorageAPI;
  public market: MarketAPI;
  public network: NetworkAPI;
  public governance: GovernanceAPI;

  constructor(username: string, options: Partial<SPKConfig> = {}) {
    this.account = new SPKAccount(username, options);
    this.file = new SPKFile(this.account);
    this.fileUpload = new SPKFileUpload(this.account);
    this.drive = new SPKDrive(this.account);
    this.protocol = new ProtocolManager(this.account.node);
    this.tokens = new TokenOperations(
      username,
      this.account.keychainAdapter,
      this.account.api,
      this.protocol
    );
    
    // Initialize Honeygraph with configurable baseUrl
    const honeygraphUrl = options.honeygraphUrl || 'https://honeygraph.dlux.io';
    this.honeygraph = new HoneygraphClient({ 
      baseUrl: honeygraphUrl,
      enableCache: options.enableHoneygraphCache ?? true,
      cacheTTL: options.honeygraphCacheTTL ?? 60000 // 1 minute default
    });
    
    // Initialize API modules
    this.users = new UserAPI(this.honeygraph);
    this.files = new FileSearchAPI(this.honeygraph);
    this.storage = new StorageAPI(this.honeygraph);
    this.market = new MarketAPI(this.honeygraph);
    this.network = new NetworkAPI(this.honeygraph);
    this.governance = new GovernanceAPI(this.honeygraph);
    
    // Keep filesystem for backward compatibility
    this.filesystem = new FileSystem(this.account.api, {
      baseUrl: honeygraphUrl
    });
    
    // Set global SPK instance for contract creator
    (global as any).currentSPKInstance = this;
  }

  /**
   * Initialize the SPK instance
   */
  async init(): Promise<void> {
    await this.account.init();
    await this.protocol.updateProtocols();
  }

  /**
   * Upload single or multiple files to SPK Network
   * Supports batch uploads with individual metadata
   */
  async upload(files: File | File[], options?: UploadOptions): Promise<UploadResult | BatchUploadResult> {
    return this.fileUpload.upload(files, options);
  }

  /**
   * Get current token balances
   */
  async getBalances(refresh = false): Promise<{
    larynx: number;
    spk: number;
    broca: number;
    ClaimableLARYNX?: number;
    ClaimableSPK?: number;
    LP?: number;
    SP?: number;
    BP?: number;
    BRC?: string;
  }> {
    const balances = await this.account.getBalances(refresh);
    
    // Get network stats for BROCA storage calculation
    let brocaStorageSize = '0MB';
    try {
      const stats = await this.account.api.get('/stats');
      if (stats && stats.channel_bytes) {
        brocaStorageSize = await this.calculateBrocaStorage(balances.broca, stats.channel_bytes);
      }
    } catch (error) {
      console.warn('Failed to calculate BROCA storage size:', error);
    }
    
    // Extended balance info from account data
    return {
      ...balances,
      ClaimableLARYNX: this.account.claim || 0,
      ClaimableSPK: this.account.drop?.availible?.amount || 0,
      LP: this.account.poweredUp || 0,
      SP: this.account.spk_power || 0,
      BP: this.account.pow_broca || 0,
      BRC: brocaStorageSize
    };
  }

  /**
   * Calculate BROCA storage capacity
   */
  private async calculateBrocaStorage(brocaCredits: number, channelBytes: number): Promise<string> {
    // BROCA credits * channel_bytes = total bytes available
    const totalBytes = brocaCredits * channelBytes;
    
    // Format as human-readable size
    if (totalBytes < 1024) {
      return `${totalBytes}B`;
    } else if (totalBytes < 1024 * 1024) {
      const kb = totalBytes / 1024;
      return `${kb.toFixed(2)}KB`;
    } else if (totalBytes < 1024 * 1024 * 1024) {
      const mb = totalBytes / (1024 * 1024);
      return `${mb.toFixed(2)}MB`;
    } else {
      const gb = totalBytes / (1024 * 1024 * 1024);
      return `${gb.toFixed(2)}GB`;
    }
  }

  /**
   * Send tokens using amount string (e.g., "50.000 BROCA")
   */
  async send(amountStr: string, to: string, memo = ''): Promise<any> {
    return this.tokens.send(amountStr, to, memo);
  }

  /**
   * Send LARYNX tokens (in millitokens)
   */
  async sendLarynx(amount: number, to: string, memo = ''): Promise<any> {
    return this.tokens.sendLarynx(amount, to, memo);
  }

  /**
   * Send SPK tokens (in millitokens)
   */
  async sendSpk(amount: number, to: string, memo = ''): Promise<any> {
    return this.tokens.sendSpk(amount, to, memo);
  }

  /**
   * Send BROCA tokens
   */
  async sendBroca(amount: number, to: string, memo = ''): Promise<any> {
    return this.tokens.sendBroca(amount, to, memo);
  }

  /**
   * Power up BROCA tokens
   */
  async brocaPowerUp(amount: number): Promise<any> {
    return this.tokens.powerUp('BROCA', amount);
  }

  /**
   * Power down SPK tokens
   */
  async spkPowerDown(amount: number): Promise<any> {
    return this.tokens.powerDown('SPK', amount);
  }

  /**
   * Power up LARYNX tokens
   */
  async powerUp(amount: number): Promise<any> {
    return this.tokens.powerUp('LARYNX', amount);
  }

  /**
   * Power down LARYNX tokens
   */
  async powerDown(amount: number): Promise<any> {
    return this.tokens.powerDown('LARYNX', amount);
  }

  /**
   * Claim token rewards
   */
  async claim(token: 'LARYNX' | 'SPK' = 'LARYNX'): Promise<any> {
    return this.tokens.claim(token);
  }

  /**
   * Register as SPK Network node
   */
  async registerNode(
    ipfsId: string,
    domain: string,
    bidRate: number = 500,
    decayMargin: number = 100
  ): Promise<any> {
    return this.tokens.registerNode(ipfsId, domain, bidRate, decayMargin);
  }

  /**
   * Calculate storage cost in BROCA
   */
  async calculateStorageCost(
    fileSize: number,
    days: number
  ): Promise<{
    broca: number;
    canAfford: boolean;
    currentBroca: number;
  }> {
    const cost = BrocaCalculator.cost(fileSize, days);
    const available = await this.account.calculateBroca();

    return {
      broca: cost,
      canAfford: available >= cost,
      currentBroca: available,
    };
  }

  /**
   * Calculate BROCA cost with network stats
   * Compatible with SPK desktop API
   */
  async calculateBrocaCost(sizeInBytes: number, options: any = {}): Promise<{
    cost: number;
    baseCost: number;
    minCost: number;
    refundableBroca: number;
    sizeInBytes: number;
    sizeInKB: number;
    sizeInMB: number;
    brocaCapacity: number;
    bytesPerBroca: number;
    contractDays: number;
  }> {
    try {
      // Use provided stats or fetch fresh ones
      const stats = options.stats || await this.getNetworkStats();
      
      if (!stats || !stats.result) {
        throw new Error('Invalid network stats');
      }
      
      const { channel_bytes = 1024, channel_min = 100 } = stats.result;
      
      // Calculate base cost: 1 BROCA per channel_bytes (typically 1024 bytes)
      const baseCost = Math.ceil(sizeInBytes / channel_bytes);
      
      // For contracts, there's a minimum cost
      const minCost = options.includeContractMin ? channel_min : 0;
      const actualCost = Math.max(baseCost, minCost);
      
      // Calculate how much data this BROCA can store
      const brocaCapacity = actualCost * channel_bytes;
      const refundableBroca = options.includeContractMin ? Math.max(0, minCost - baseCost) : 0;
      
      return {
        cost: actualCost,
        baseCost,
        minCost,
        refundableBroca,
        sizeInBytes,
        sizeInKB: sizeInBytes / 1024,
        sizeInMB: sizeInBytes / (1024 * 1024),
        brocaCapacity,
        bytesPerBroca: channel_bytes,
        contractDays: 30
      };
    } catch (error) {
      console.error('Failed to calculate BROCA cost:', error);
      // Return default calculation
      const baseCost = Math.ceil(sizeInBytes / 1024);
      return {
        cost: baseCost,
        baseCost,
        minCost: 100,
        refundableBroca: 0,
        sizeInBytes,
        sizeInKB: sizeInBytes / 1024,
        sizeInMB: sizeInBytes / (1024 * 1024),
        brocaCapacity: baseCost * 1024,
        bytesPerBroca: 1024,
        contractDays: 30
      };
    }
  }

  /**
   * Get file information by CID
   */
  async getFile(cid: string): Promise<any> {
    return this.account.api.getFileByCID(cid);
  }

  /**
   * List user's files
   */
  async listFiles(filters?: {
    folder?: string;
    tags?: string[];
  }): Promise<any[]> {
    const contracts = await this.listContracts();
    let files = contracts;

    if (filters?.folder) {
      files = files.filter(f => f.metadata?.folder === filters.folder);
    }

    if (filters?.tags && filters.tags.length > 0) {
      files = files.filter(f => 
        filters.tags!.some(tag => f.metadata?.tags?.includes(tag))
      );
    }

    return files;
  }

  /**
   * Delete file (stop renewal)
   */
  async deleteFile(cid: string): Promise<any> {
    const contract = await this.getFile(cid);
    if (!contract) {
      throw new Error('File not found');
    }

    const auth = await this.account.sign(`cancel_contract:${contract.id}`);
    return this.account.api.post(
      `/api/fileContract/${contract.id}/cancel`,
      {},
      auth
    );
  }

  /**
   * Renew storage contract
   */
  async renewContract(
    contractId: string,
    options: { duration?: number } = {}
  ): Promise<any> {
    const auth = await this.account.sign(`renew_contract:${contractId}`);
    return this.account.api.post(
      `/api/fileContract/${contractId}/renew`,
      { duration: options.duration || 30 },
      auth
    );
  }

  /**
   * List user's contracts
   */
  async listContracts(): Promise<any[]> {
    return this.account.api.get(`/@${this.account.username}/contracts`);
  }

  /**
   * Get contract details
   */
  async getContract(contractId: string): Promise<any> {
    return this.account.api.getFileContract(contractId);
  }

  /**
   * Cancel ongoing upload
   */
  cancelUpload(): void {
    this.file.cancelUpload();
  }

  /**
   * Decrypt an encrypted file
   */
  async decrypt(_cid: string): Promise<Blob> {
    // This would implement decryption logic
    throw new Error('Decryption not yet implemented');
  }

  /**
   * Get network statistics
   */
  async getNetworkStats(): Promise<any> {
    return this.account.api.get('/stats');
  }

  /**
   * Get storage providers
   */
  async getStorageProviders(): Promise<any> {
    try {
      // Fetch from the services endpoint
      const response = await fetch(`${this.account.node}/services/IPFS`);
      if (!response.ok) {
        throw new Error('Failed to fetch storage providers');
      }
      
      const data = await response.json();
      const services: any[] = [];

      // Process the services data  
      if (data.services) {
        for (let i = 0; i < data.services.length; i++) {
          const serviceGroup = data.services[i];
          for (const [id, service] of Object.entries(serviceGroup)) {
            services.push({
              id,
              api: (service as any).a,
              account: (service as any).b
            });
          }
        }
      }
      
      return { providers: data.providers || {}, services, raw: data };
    } catch (error) {
      console.error('Failed to get storage providers:', error);
      throw error;
    }
  }

  /**
   * Get healthy storage providers that can handle the required size
   * @param requiredSize - Required storage size in bytes
   * @returns Array of healthy providers
   */
  async getHealthyStorageProviders(requiredSize: number): Promise<any[]> {
    const { services } = await this.getStorageProviders();
    
    // Known problematic nodes to skip
    const skipNodes = new Set([]);
    
    // Check each provider's health and capacity
    const checkPromises = services.map(async (service: any) => {
      // Skip known problematic nodes
      if (service.api && Array.from(skipNodes).some(badNode => service.api.includes(badNode))) {
        return null;
      }
      
      try {
        // Set a timeout for the health check
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1000);
        
        const statsResponse = await fetch(`${service.api}/upload-stats`, {
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!statsResponse.ok) {
          return null;
        }
        
        const stats = await statsResponse.json();
        
        // Check if provider has enough space (2x required size for safety)
        const maxStorage = BigInt(stats.StorageMax || 0);
        const repoSize = BigInt(stats.RepoSize || 0);
        const freeSpace = maxStorage - repoSize;
        const requiredSpace = BigInt(requiredSize) * BigInt(2);
        
        if (freeSpace >= requiredSpace) {
          return {
            ...service,
            stats,
            freeSpace: Number(freeSpace),
            healthy: true
          };
        }
      } catch (error) {
        // Provider is not healthy/reachable
        return null;
      }
      
      return null;
    });
    
    const results = await Promise.all(checkPromises);
    return results.filter(provider => provider !== null);
  }

  /**
   * Create storage contract
   */
  async createContract(contractData: any): Promise<any> {
    const auth = await this.account.sign(`create_contract:${Date.now()}`);
    return this.account.api.post('/api/new_contract', contractData, auth);
  }

  /**
   * Create storage contract (compatible with SPK desktop API)
   */
  async createStorageContract(contractData: any, _options: any = {}): Promise<{
    success: boolean;
    contract?: any;
    error?: string;
  }> {
    try {
      const result = await this.createContract(contractData);
      return { success: true, contract: result };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get existing contract for a broker
   */
  async getExistingContract(broker: string): Promise<any> {
    const contracts = await this.listContracts();
    return contracts.find(c => 
      c.broker === broker && 
      c.status === 'active' &&
      c.broca_remaining > 0
    );
  }

  /**
   * Direct upload (public node)
   * Always returns array of UploadResult, even for batch uploads
   */
  async directUpload(files: File[], options: UploadOptions = {}): Promise<UploadResult[]> {
    // Use batch upload functionality
    const result = await this.upload(files, options);
    
    // If it's a BatchUploadResult, extract the results array
    if ('results' in result) {
      return result.results;
    }
    
    // If it's a single UploadResult (shouldn't happen with array input)
    return [result];
  }

  // ========== Honeygraph API Convenience Methods ==========

  /**
   * Get enhanced user profile from Honeygraph
   */
  async getUserProfile(username?: string, options?: any): Promise<any> {
    const targetUser = username || this.account.username;
    return this.users.getUserProfile(targetUser, options);
  }

  /**
   * Get user balances from Honeygraph (more accurate than SPK node)
   */
  async getEnhancedBalances(username?: string): Promise<any> {
    const targetUser = username || this.account.username;
    return this.users.getUserBalances(targetUser);
  }

  /**
   * Search files across the network
   */
  async searchFiles(options: any): Promise<any[]> {
    return this.files.searchFiles(options);
  }

  /**
   * Get files by tags
   */
  async getFilesByTags(tags: string[], logic: 'AND' | 'OR' = 'OR'): Promise<any[]> {
    return this.files.searchByTags(tags, logic);
  }

  /**
   * Get storage providers for a file
   */
  async getFileStorageProviders(cid: string): Promise<any> {
    return this.files.getFileProviders(cid);
  }

  /**
   * Get recently uploaded files
   */
  async getRecentFiles(limit: number = 50): Promise<any[]> {
    return this.files.getRecentUploads(limit);
  }

  /**
   * Get user's contracts from Honeygraph
   */
  async getUserContracts(username?: string): Promise<any> {
    const targetUser = username || this.account.username;
    return this.users.getUserContracts(targetUser);
  }

  /**
   * Get market depth for a trading pair
   */
  async getMarketDepth(pair: string, depth?: number): Promise<any> {
    return this.honeygraph.getMarketDepth(pair, depth);
  }

  /**
   * Get rich list for a token
   */
  async getRichList(token: 'larynx' | 'spk' | 'power', limit?: number): Promise<any> {
    return this.honeygraph.getRichList(token, limit);
  }

  /**
   * Get network topology
   */
  async getNetworkTopology(): Promise<any> {
    return this.honeygraph.getNetworkTopology();
  }

  /**
   * Get storage network statistics
   */
  async getStorageNetworkStats(): Promise<any> {
    return this.honeygraph.getStorageStats();
  }

  // ========== Storage API Convenience Methods ==========

  /**
   * Find understored contracts that need storage nodes
   */
  async findStorageOpportunities(filters?: any): Promise<any[]> {
    return this.storage.findStorageOpportunities(filters);
  }

  /**
   * Get storage node statistics
   */
  async getStorageNodeStats(nodeId?: string): Promise<any> {
    const node = nodeId || this.account.username;
    return this.storage.getNodeStats(node);
  }

  /**
   * Get expiring contracts
   */
  async getExpiringContracts(days: number = 7): Promise<any[]> {
    return this.storage.getExpiringContracts(days);
  }

  /**
   * Calculate storage ROI
   */
  async calculateStorageROI(storageCapacity: number, bidRate: number): Promise<any> {
    return this.storage.calculateStorageROI({ storageCapacity, bidRate });
  }

  // ========== Market API Convenience Methods ==========

  /**
   * Get user's open orders
   */
  async getUserOrders(username?: string, status: 'OPEN' | 'ALL' = 'OPEN'): Promise<any[]> {
    const user = username || this.account.username;
    return this.market.getUserOrders(user, status);
  }

  /**
   * Get recent trades for a pair
   */
  async getRecentTrades(pair: string, limit: number = 50): Promise<any[]> {
    return this.market.getRecentTrades(pair, limit);
  }

  /**
   * Get OHLCV candlestick data
   */
  async getMarketCandles(pair: string, interval: string = '1h', options?: any): Promise<any[]> {
    return this.market.getOHLCV(pair, interval as any, options);
  }

  /**
   * Get liquidity pool information
   */
  async getLiquidityPools(pair?: string): Promise<any[]> {
    return this.market.getLiquidityPools(pair);
  }

  /**
   * Find arbitrage opportunities
   */
  async findArbitrageOpportunities(minProfit: number = 1): Promise<any[]> {
    return this.market.getArbitrageOpportunities(minProfit);
  }

  /**
   * Calculate trade slippage
   */
  async calculateSlippage(pair: string, amount: number, side: 'BUY' | 'SELL'): Promise<any> {
    return this.market.calculateSlippage(pair, amount, side);
  }

  // ========== Network API Convenience Methods ==========

  /**
   * Get network health status
   */
  async getNetworkHealth(): Promise<any> {
    return this.network.getNetworkHealth();
  }

  /**
   * Get service health for a specific type
   */
  async getServiceHealth(serviceType: string): Promise<any> {
    return this.network.getServiceHealth(serviceType);
  }

  /**
   * Get node information
   */
  async getNodeInfo(nodeId?: string): Promise<any> {
    const node = nodeId || this.account.username;
    return this.network.getNodeInfo(node);
  }

  /**
   * Get network activity
   */
  async getNetworkActivity(hours: number = 24): Promise<any> {
    return this.network.getNetworkActivity(hours);
  }

  /**
   * Get service pricing comparison
   */
  async getServicePricing(serviceType: string): Promise<any> {
    return this.network.getServicePricing(serviceType);
  }

  /**
   * Get node rankings
   */
  async getNodeRankings(metric?: string, limit?: number): Promise<any[]> {
    return this.network.getNodeRankings(metric as any, limit);
  }

  // ========== Governance API Convenience Methods ==========

  /**
   * Get active governance proposals
   */
  async getActiveProposals(): Promise<any[]> {
    return this.governance.getProposals('active');
  }

  /**
   * Get voting power for a user
   */
  async getVotingPower(username?: string): Promise<any> {
    const user = username || this.account.username;
    return this.governance.getVotingPower(user);
  }

  /**
   * Get proposal details
   */
  async getProposal(proposalId: string): Promise<any> {
    return this.governance.getProposalDetails(proposalId);
  }

  /**
   * Get governance statistics
   */
  async getGovernanceStats(): Promise<any> {
    return this.governance.getGovernanceStats();
  }

  /**
   * Get upcoming votes
   */
  async getUpcomingVotes(days: number = 7): Promise<any[]> {
    return this.governance.getUpcomingVotes(days);
  }

  /**
   * Get voter history
   */
  async getVoterHistory(username?: string): Promise<any> {
    const user = username || this.account.username;
    return this.governance.getVoterHistory(user);
  }
}

// Export the new storage provider selector and contract creator
export { StorageProviderSelector } from './storage/provider-selector';
export { SPKContractCreator } from './storage/contract-creator';