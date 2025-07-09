/**
 * Storage Provider Selector
 * Finds healthy SPK storage providers with sufficient space
 */

export interface Provider {
  nodeId: string;
  api: string;
  enabled?: boolean;
}

export interface ProviderStats {
  node?: string;
  StorageMax: string;
  RepoSize: string;
  NumObjects?: number;
  api?: string;
  nodeId?: string;
}

export interface HealthyProvider {
  nodeId: string;
  api: string;
  freeSpace: number;
  totalSpace: number;
  usedSpace: number;
  freeSpaceRatio: number;
  stats: ProviderStats;
}

export class StorageProviderSelector {
  private apiUrl: string;
  public providers: Record<string, string[]> = {};
  public services: any[] = [];
  public providerStats: Record<string, ProviderStats> = {};
  public skipNodes: Set<string>;

  constructor(apiUrl: string = 'https://spktest.dlux.io') {
    this.apiUrl = apiUrl;
    
    // Known problematic nodes to skip
    this.skipNodes = new Set([
      'nathansenn.spk.tv',
      'blurtopian.com',
      'actifit.io'
    ]);
  }

  /**
   * Get IPFS providers from SPK network
   */
  async fetchProviders(): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiUrl}/services/IPFS`);
      const data = await response.json();
      
      // Process provider list
      if (data.providers) {
        for (const [node, idString] of Object.entries(data.providers)) {
          const ids = (idString as string).split(',');
          this.providers[node] = ids;
        }
      }
      
      // Process services
      if (data.services) {
        this.services = data.services;
      }
      
      console.log(`Found ${Object.keys(this.providers).length} IPFS providers`);
      return true;
    } catch (error) {
      console.error('Failed to fetch IPFS providers:', error);
      throw error;
    }
  }

  /**
   * Check if provider should be skipped
   */
  shouldSkipProvider(providerUrl: string): boolean {
    return Array.from(this.skipNodes).some(badNode => 
      providerUrl.includes(badNode)
    );
  }

  /**
   * Fetch stats for all providers
   */
  async fetchAllProviderStats(): Promise<void> {
    const statsPromises: Promise<any>[] = [];
    
    for (const serviceGroup of this.services) {
      for (const [nodeId, service] of Object.entries(serviceGroup)) {
        const providerUrl = (service as any).a || (service as any).api;
        
        if (!providerUrl) continue;
        
        // Skip known problematic nodes
        if (this.shouldSkipProvider(providerUrl)) {
          console.log(`Skipping known problematic provider: ${providerUrl}`);
          continue;
        }
        
        // Fetch stats with timeout
        const statsPromise = this.fetchProviderStats(nodeId, providerUrl)
          .catch(error => {
            console.debug(`Provider ${nodeId} stats fetch failed:`, error.message);
            return null;
          });
        
        statsPromises.push(statsPromise);
      }
    }
    
    await Promise.all(statsPromises);
    console.log(`Fetched stats for ${Object.keys(this.providerStats).length} providers`);
  }

  /**
   * Fetch stats for a single provider
   */
  async fetchProviderStats(nodeId: string, providerUrl: string): Promise<ProviderStats | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    try {
      const response = await fetch(`${providerUrl}/upload-stats`, { 
        signal: controller.signal,
        headers: {
          'Accept': 'application/json'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data && (data.node || nodeId)) {
        this.providerStats[data.node || nodeId] = {
          ...data,
          api: providerUrl,
          nodeId: nodeId
        };
        return data;
      }
      return null;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Get providers with sufficient space for the required size
   * @param requiredSize - Size in bytes
   * @param safetyMultiplier - Require this many times the space (default 2x)
   */
  getHealthyProviders(requiredSize: number, safetyMultiplier: number = 2): HealthyProvider[] {
    const healthyProviders: HealthyProvider[] = [];
    
    for (const [nodeId, stats] of Object.entries(this.providerStats)) {
      try {
        const maxStorage = BigInt(stats.StorageMax || 0);
        const repoSize = BigInt(stats.RepoSize || 0);
        const freeSpace = maxStorage - repoSize;
        const requiredSpace = BigInt(requiredSize) * BigInt(safetyMultiplier);
        
        if (freeSpace >= requiredSpace) {
          healthyProviders.push({
            nodeId,
            api: stats.api!,
            freeSpace: Number(freeSpace),
            totalSpace: Number(maxStorage),
            usedSpace: Number(repoSize),
            freeSpaceRatio: Number(freeSpace) / Number(maxStorage),
            stats
          });
        }
      } catch (error) {
        console.debug(`Error processing stats for ${nodeId}:`, error);
      }
    }
    
    // Sort by free space ratio (most free space percentage first)
    healthyProviders.sort((a, b) => b.freeSpaceRatio - a.freeSpaceRatio);
    
    return healthyProviders;
  }

  /**
   * Select the best provider for the given size
   */
  async selectBestProvider(requiredSize: number): Promise<HealthyProvider> {
    // Fetch providers if not already done
    if (Object.keys(this.providers).length === 0) {
      await this.fetchProviders();
      await this.fetchAllProviderStats();
    }
    
    const healthyProviders = this.getHealthyProviders(requiredSize);
    
    if (healthyProviders.length === 0) {
      throw new Error('No healthy storage providers with sufficient space available');
    }
    
    // Return the best provider (most free space ratio)
    return healthyProviders[0];
  }

  /**
   * Get provider status icon
   */
  getProviderIcon(nodeId: string, requiredSize: number): string {
    const stats = this.providerStats[nodeId];
    if (!stats) return '❓';
    
    try {
      const maxStorage = BigInt(stats.StorageMax || 0);
      const repoSize = BigInt(stats.RepoSize || 0);
      const freeSpace = maxStorage - repoSize;
      const ratio = Number(freeSpace) / requiredSize;
      
      if (ratio >= 100) return '✅';
      if (ratio >= 2) return '⚠️';
      return '❌';
    } catch (error) {
      return '❓';
    }
  }

  /**
   * Format bytes to human readable
   */
  formatBytes(bytes: number, decimals: number = 2): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }
}