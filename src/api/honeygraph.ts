/**
 * HoneygraphClient - Client for interacting with Honeygraph API
 * Provides access to SPK Network data through Dgraph-based read replication
 */

export interface HoneygraphOptions {
  baseUrl?: string;
  timeout?: number;
  enableCache?: boolean;
  cacheTTL?: number; // in milliseconds
}

export interface UserProfileOptions {
  include?: string[] | 'all';
}

export interface FileSearchOptions {
  q?: string;
  tags?: string;
  owner?: string;
  limit?: number;
}

interface CacheEntry {
  data: any;
  timestamp: number;
}

export class HoneygraphClient {
  public baseUrl: string;
  public timeout: number;
  private enableCache: boolean;
  private cacheTTL: number;
  private cache: Map<string, CacheEntry>;

  constructor(options: HoneygraphOptions = {}) {
    this.baseUrl = options.baseUrl || 'https://honeygraph.dlux.io';
    this.timeout = options.timeout || 30000;
    this.enableCache = options.enableCache || false;
    this.cacheTTL = options.cacheTTL || 60000; // 1 minute default
    this.cache = new Map();
  }

  /**
   * Make HTTP request to Honeygraph API
   */
  private async request(
    method: string,
    endpoint: string,
    data?: any,
    params?: Record<string, any>
  ): Promise<any> {
    let url = `${this.baseUrl}${endpoint}`;

    // Add query parameters
    if (params && Object.keys(params).length > 0) {
      const queryString = new URLSearchParams(params).toString();
      url += `?${queryString}`;
    }

    // Check cache for GET requests
    if (method === 'GET' && this.enableCache) {
      const cached = this.getFromCache(url);
      if (cached !== null) {
        return cached;
      }
    }

    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    };

    if (data && method !== 'GET') {
      options.body = JSON.stringify(data);
    }

    try {
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorBody: string;
        try {
          errorBody = JSON.stringify(await response.json());
        } catch {
          errorBody = await response.text();
        }
        throw new Error(
          `Honeygraph API Error: ${response.status} ${response.statusText} - ${errorBody}`
        );
      }

      let result;
      try {
        result = await response.json();
      } catch (e) {
        throw new Error('Invalid JSON response');
      }

      // Cache successful GET requests
      if (method === 'GET' && this.enableCache) {
        this.setCache(url, result);
      }

      return result;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    }
  }

  /**
   * Get data from cache if available and not expired
   */
  private getFromCache(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const isExpired = Date.now() - entry.timestamp > this.cacheTTL;
    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Store data in cache
   */
  private setCache(key: string, data: any): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * HTTP GET request
   */
  async get(endpoint: string, params?: Record<string, any>): Promise<any> {
    return this.request('GET', endpoint, null, params);
  }

  /**
   * HTTP POST request
   */
  async post(endpoint: string, data: any): Promise<any> {
    return this.request('POST', endpoint, data);
  }

  /**
   * Get complete user profile with related data
   */
  async getUserProfile(username: string, options?: UserProfileOptions): Promise<any> {
    const params: any = {};

    if (options?.include) {
      if (Array.isArray(options.include)) {
        params.include = options.include.join(',');
      } else {
        params.include = options.include;
      }
    } else {
      params.include = 'all';
    }

    return this.get(`/api/spk/user/${username}`, params);
  }

  /**
   * Search files across the network
   */
  async searchFiles(options: FileSearchOptions): Promise<any> {
    return this.get('/api/spk/files/search', options);
  }

  /**
   * Get storage network statistics
   */
  async getStorageStats(): Promise<any> {
    return this.get('/api/spk/storage/stats');
  }

  /**
   * Get DEX market depth for a trading pair
   */
  async getMarketDepth(pair: string, depth?: number): Promise<any> {
    const params: any = {};
    if (depth) params.depth = depth;

    return this.get(`/api/spk/dex/${pair}`, params);
  }

  /**
   * Get rich list for a specific token
   */
  async getRichList(token: string, limit?: number): Promise<any> {
    const params: any = {};
    if (limit) params.limit = limit;

    return this.get(`/api/spk/richlist/${token}`, params);
  }

  /**
   * Get network topology data
   */
  async getNetworkTopology(): Promise<any> {
    return this.get('/api/spk/network/topology');
  }

  /**
   * Browse user's file system
   */
  async getFileSystem(username: string, path: string = '/'): Promise<any> {
    // Clean the path
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    return this.get(`/fs/${username}/${cleanPath}`);
  }

  /**
   * Get files shared with a user
   */
  async getSharedWithUser(username: string, path: string = '/'): Promise<any> {
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    return this.get(`/fse/${username}/${cleanPath}`);
  }

  /**
   * Get files shared by a user
   */
  async getSharedByUser(username: string, path: string = '/'): Promise<any> {
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    return this.get(`/fss/${username}/${cleanPath}`);
  }

  /**
   * Get service providers by type
   */
  async getServiceProviders(type: string): Promise<any> {
    return this.get(`/api/spk/services/${type}/providers`);
  }

  /**
   * Get who stores files for a specific owner
   */
  async getStorageProviders(owner: string): Promise<any> {
    return this.get(`/api/spk/storage-providers/${owner}`);
  }

  /**
   * Get network-wide statistics
   */
  async getNetworkStats(): Promise<any> {
    return this.get('/api/spk/network/stats');
  }

  /**
   * Get governance proposals
   */
  async getProposals(status?: string): Promise<any> {
    const params: any = {};
    if (status) params.status = status;

    return this.get('/api/spk/governance/proposals', params);
  }

  /**
   * Find who stores a specific file by CID
   */
  async getFileProviders(cid: string): Promise<any> {
    return this.get(`/api/spk/file/${cid}/providers`);
  }

  /**
   * Get contracts stored by a specific node
   */
  async getContractsByNode(nodeId: string): Promise<any> {
    return this.get(`/spk/contracts/stored-by/${nodeId}`);
  }

  /**
   * Get understored contracts (nodeTotal < power)
   */
  async getUnderstoredContracts(): Promise<any> {
    return this.get('/spk/contracts/understored');
  }
}
