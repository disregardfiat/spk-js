import { HoneygraphClient } from './honeygraph';

export interface FileSearchOptions {
  q?: string;              // Query string for name search
  tags?: string[];         // Tags to filter by
  owner?: string;          // Owner username
  limit?: number;          // Result limit
  tagLogic?: 'AND' | 'OR'; // How to combine tags
}

export interface FileSearchResult {
  cid: string;
  name: string;
  size: number;
  path: string;
  tags?: string[];
  owner: {
    username: string;
  };
  contract?: {
    expiresBlock: number;
    status: string;
  };
  uploadedAt?: string;
  mimeType?: string;
}

export interface FileProvider {
  username: string;
  nodeId: string;
  status: string;
  lastValidation: string;
  reliability: number;
}

export interface FileProvidersResult {
  cid: string;
  providers: FileProvider[];
  totalProviders: number;
  minRequired: number;
}

export interface FileMetadata {
  cid: string;
  name: string;
  size: number;
  mimeType?: string;
  uploadedAt: string;
  owner: {
    username: string;
  };
  contract: {
    id: string;
    expiresBlock: number;
    status: string;
    autoRenew: boolean;
  };
  tags?: string[];
  labels?: string[];
  license?: string;
  metadata?: Record<string, any>;
  versions?: Array<{
    cid: string;
    uploadedAt: string;
    contractId: string;
  }>;
}

export interface FileStats {
  cid: string;
  totalDownloads: number;
  uniqueDownloads: number;
  bandwidth: number;
  lastAccessed: string;
  popularityScore: number;
  storageNodes: number;
  replicationFactor: number;
}

export interface SimilarFile {
  cid: string;
  name: string;
  similarity: number;
  reason: string;
}

export class FileSearchAPI {
  private client: HoneygraphClient;

  constructor(client: HoneygraphClient) {
    this.client = client;
  }

  /**
   * Search files across the network
   */
  async searchFiles(options: FileSearchOptions): Promise<FileSearchResult[]> {
    const params: any = {};
    
    if (options.q) params.q = options.q;
    if (options.owner) params.owner = options.owner;
    if (options.limit) params.limit = options.limit;
    
    if (options.tags && options.tags.length > 0) {
      params.tags = options.tags.join(',');
    }
    
    if (options.tagLogic) {
      params.tagLogic = options.tagLogic;
    }

    const result = await this.client.searchFiles(params);
    return result.files || [];
  }

  /**
   * Get storage providers for a specific file
   */
  async getFileProviders(cid: string): Promise<FileProvidersResult> {
    return this.client.getFileProviders(cid);
  }

  /**
   * Get detailed metadata for a file
   */
  async getFileMetadata(cid: string): Promise<FileMetadata> {
    return this.client.get(`/api/spk/file/${cid}`);
  }

  /**
   * Get recently uploaded files
   */
  async getRecentUploads(limit: number = 50): Promise<FileSearchResult[]> {
    const result = await this.client.get('/api/spk/files/recent', { limit });
    return result.files || [];
  }

  /**
   * Search files by tags
   */
  async searchByTags(tags: string[], logic: 'AND' | 'OR' = 'OR'): Promise<FileSearchResult[]> {
    return this.searchFiles({ tags, tagLogic: logic });
  }

  /**
   * Get files in a specific path for a user
   */
  async getFilesByPath(owner: string, path: string): Promise<FileSearchResult[]> {
    const result = await this.client.get('/api/spk/files/by-path', {
      owner,
      path
    });
    return result.files || [];
  }

  /**
   * Get file statistics
   */
  async getFileStats(cid: string): Promise<FileStats> {
    return this.client.get(`/api/spk/file/${cid}/stats`);
  }

  /**
   * Find files similar to a given file
   */
  async searchSimilarFiles(cid: string): Promise<SimilarFile[]> {
    const result = await this.client.get(`/api/spk/file/${cid}/similar`);
    return result.similar || [];
  }

  /**
   * Search files by MIME type
   */
  async searchByMimeType(mimeType: string, limit: number = 50): Promise<FileSearchResult[]> {
    const result = await this.client.get('/api/spk/files/by-type', {
      mimeType,
      limit
    });
    return result.files || [];
  }

  /**
   * Get files expiring soon
   */
  async getExpiringFiles(days: number = 7, owner?: string): Promise<FileSearchResult[]> {
    const params: any = { days };
    if (owner) params.owner = owner;
    
    const result = await this.client.get('/api/spk/files/expiring', params);
    return result.files || [];
  }

  /**
   * Get popular files
   */
  async getPopularFiles(timeframe: '24h' | '7d' | '30d' = '7d', limit: number = 50): Promise<FileSearchResult[]> {
    const result = await this.client.get('/api/spk/files/popular', {
      timeframe,
      limit
    });
    return result.files || [];
  }

  /**
   * Get file versions/history
   */
  async getFileVersions(path: string, owner: string): Promise<Array<{
    cid: string;
    uploadedAt: string;
    size: number;
    contractId: string;
  }>> {
    const result = await this.client.get('/api/spk/file/versions', {
      path,
      owner
    });
    return result.versions || [];
  }
}