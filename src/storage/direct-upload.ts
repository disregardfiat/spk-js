import { SPKAccount } from '../core/account';
import { SPKAPI } from '../core/api';
import { KeychainAdapter } from '../core/keychain-adapter';

export interface DirectUploadOptions {
  cids: string[];      // Array of IPFS CIDs
  sizes: number[];     // Array of file sizes in bytes
  id: string;          // Unique identifier for this upload
  metadata?: string;   // Optional metadata string
}

export interface DirectUploadResult {
  success: boolean;
  id: string;
  transactionId?: string;
  filesUploaded: number;
  totalSize: number;
  error?: string;
}

/**
 * Direct Upload - Insert files directly into the SPK Network
 * Bypasses normal upload and contract creation pipelines
 */
export class DirectUpload {
  constructor(
    private account: SPKAccount,
    private api: SPKAPI,
    private keychainAdapter: KeychainAdapter | null
  ) {}

  /**
   * Direct upload files to the network
   * @param options - Upload options including CIDs and sizes
   */
  async upload(options: DirectUploadOptions): Promise<DirectUploadResult> {
    // Validate inputs
    const validation = this.validateInputs(options);
    if (!validation.valid) {
      return {
        success: false,
        id: options.id,
        filesUploaded: 0,
        totalSize: 0,
        error: validation.error
      };
    }

    // Check keychain availability
    if (!this.keychainAdapter || !this.keychainAdapter.isAvailable()) {
      throw new Error('Keychain/Signer not available');
    }

    // Calculate total size
    const totalSize = options.sizes.reduce((sum, size) => sum + size, 0);

    // Check BROCA balance
    const brocaAvailable = await this.account.calculateBroca();
    if (brocaAvailable < totalSize) {
      return {
        success: false,
        id: options.id,
        filesUploaded: 0,
        totalSize,
        error: `Insufficient BROCA. Need ${totalSize}, have ${brocaAvailable}`
      };
    }

    // Build transaction
    const customJsonId = 'spk-direct-upload';
    const json = {
      c: options.cids.join(','),
      s: options.sizes.join(','),
      id: options.id,
      m: options.metadata,
      from: this.account.username
    };

    try {
      const result = await this.keychainAdapter.broadcastCustomJson(
        this.account.username,
        customJsonId,
        'Active',
        json,
        `Direct upload ${options.cids.length} files (${this.formatBytes(totalSize)})`
      );

      return {
        success: true,
        id: options.id,
        transactionId: result.id,
        filesUploaded: options.cids.length,
        totalSize
      };
    } catch (error: any) {
      return {
        success: false,
        id: options.id,
        filesUploaded: 0,
        totalSize,
        error: `Direct upload failed: ${error.message}`
      };
    }
  }

  /**
   * Batch direct upload multiple file sets
   */
  async batchUpload(uploads: DirectUploadOptions[]): Promise<DirectUploadResult[]> {
    const results: DirectUploadResult[] = [];
    
    for (const upload of uploads) {
      try {
        const result = await this.upload(upload);
        results.push(result);
        
        // Add small delay between uploads to avoid rate limiting
        if (uploads.indexOf(upload) < uploads.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (error: any) {
        results.push({
          success: false,
          id: upload.id,
          filesUploaded: 0,
          totalSize: 0,
          error: error.message
        });
      }
    }
    
    return results;
  }

  /**
   * Create metadata string for direct upload
   * @param fileCount - Number of files
   * @param tags - Optional tags (max 8)
   */
  static createMetadata(fileCount: number, tags: number[] = []): string {
    // Metadata format: "tag1,tag2,...,tag8" (8 tags max)
    // For multiple files, metadata size must be (fileCount * 4 + 1)
    
    const metadataSize = fileCount * 4 + 1;
    const metadata: string[] = [];
    
    // Add tags (convert to string)
    for (let i = 0; i < Math.min(tags.length, 8); i++) {
      metadata.push(tags[i].toString());
    }
    
    // Pad with "1" to reach required size
    while (metadata.length < metadataSize) {
      metadata.push('1');
    }
    
    return metadata.slice(0, metadataSize).join(',');
  }

  /**
   * Validate direct upload inputs
   */
  private validateInputs(options: DirectUploadOptions): { valid: boolean; error?: string } {
    // Check required fields
    if (!options.cids || !options.sizes || !options.id) {
      return { valid: false, error: 'Missing required fields: cids, sizes, or id' };
    }

    // Check arrays have same length
    if (options.cids.length !== options.sizes.length) {
      return { valid: false, error: 'CIDs and sizes arrays must have same length' };
    }

    // Check for empty arrays
    if (options.cids.length === 0) {
      return { valid: false, error: 'No files to upload' };
    }

    // Validate CIDs
    for (const cid of options.cids) {
      if (!cid || typeof cid !== 'string' || cid.length < 10) {
        return { valid: false, error: `Invalid CID: ${cid}` };
      }
    }

    // Validate sizes
    for (const size of options.sizes) {
      if (typeof size !== 'number' || size <= 0) {
        return { valid: false, error: `Invalid size: ${size}` };
      }
    }

    // Validate metadata if provided
    if (options.metadata) {
      const expectedSize = options.cids.length * 4 + 1;
      const actualSize = options.metadata.split(',').length;
      
      if (actualSize !== expectedSize) {
        return { 
          valid: false, 
          error: `Invalid metadata size. Expected ${expectedSize}, got ${actualSize}` 
        };
      }
    }

    return { valid: true };
  }

  /**
   * Check if files already exist on network
   */
  async checkExistingFiles(cids: string[]): Promise<Map<string, boolean>> {
    const exists = new Map<string, boolean>();
    
    for (const cid of cids) {
      try {
        // Check if CID is already registered
        const reversed = cid.split('').reverse().join('');
        const existing = await this.api.get(`/IPFS/${reversed}`);
        exists.set(cid, !!existing);
      } catch (error) {
        exists.set(cid, false);
      }
    }
    
    return exists;
  }

  /**
   * Calculate BROCA cost for direct upload
   */
  calculateCost(sizes: number[]): number {
    return sizes.reduce((sum, size) => sum + size, 0);
  }

  /**
   * Format bytes to human readable
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Create a direct upload from File objects
   * Helper method to convert Files to CIDs and sizes
   */
  static async fromFiles(
    files: File[], 
    ipfsAdd: (file: File) => Promise<{ cid: string; size: number }>,
    id?: string
  ): Promise<DirectUploadOptions> {
    const cids: string[] = [];
    const sizes: number[] = [];
    
    // Generate unique ID if not provided
    const uploadId = id || `direct_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Add files to IPFS and collect CIDs
    for (const file of files) {
      const { cid, size } = await ipfsAdd(file);
      cids.push(cid);
      sizes.push(size);
    }
    
    // Create metadata
    const metadata = DirectUpload.createMetadata(files.length);
    
    return {
      cids,
      sizes,
      id: uploadId,
      metadata
    };
  }
}