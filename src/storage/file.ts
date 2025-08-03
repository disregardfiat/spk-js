import { SPKAccount } from '../core/account';
import { BrocaCalculator } from '../tokens/broca';
import Hash from 'ipfs-only-hash';
import { Buffer } from 'buffer';
import { Encryption, KeyManager } from '../crypto';

export interface FileData {
  cid: string;
  size: number;
  duration?: number;
  autoRenew?: boolean;
  broca_cost?: number;
}

export interface FileMetadataItem {
  name?: string;
  FileIndex: number;
  ext?: string;
  path?: string;
  thumbnail?: string;
  tags?: number | number[];  // Can be array of numbers or single number
  license?: string;
  labels?: string;
  autoRenew?: boolean;
  onProgress?: (percent: number) => void;
}

export interface UploadOptions {
  autoRenew?: boolean;
  encrypt?: string[];
  metaData?: FileMetadataItem[];
  chunkSize?: number;
  onProgress?: (percent: number) => void;
  beneficiary?: {
    account: string;
    weight: number; // 0-1 (0-100%)
  };
}

export interface UploadResult {
  cid: string;
  contract: any;
  size: number;
  url: string;
}

/**
 * SPK Network file operations
 */
export class SPKFile {
  private account: SPKAccount;
  private uploadController?: AbortController;
  private encryption: Encryption;
  private keyManager: KeyManager;

  constructor(account: SPKAccount) {
    this.account = account;
    this.keyManager = new KeyManager();
    this.encryption = new Encryption(this.keyManager, account.username);
  }

  /**
   * Generate IPFS hash for a file
   */
  static async hash(file: File): Promise<string> {
    if (!file || !(file instanceof File)) {
      throw new Error('Invalid file');
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    return Hash.of(buffer);
  }


  /**
   * Upload a file to SPK Network
   */
  async upload(file: File, options: UploadOptions = {}): Promise<UploadResult> {
    if (!file || !(file instanceof File)) {
      throw new Error('Invalid file');
    }

    // Ensure account has registered public key
    await this.account.registerPublicKey();

    // Generate CID
    const cid = await SPKFile.hash(file);

    // Handle encryption if requested
    let uploadFile = file;
    let encryptionMetadata = {};
    if (options.encrypt && options.encrypt.length > 0) {
      const encrypted = await this.encrypt(file, options.encrypt);
      uploadFile = new File([encrypted.encryptedData], file.name + '.enc', {
        type: 'application/octet-stream',
      });
      encryptionMetadata = {
        encrypted: true,
        recipients: options.encrypt,
      };
    }

    // Create contract
    const contract = await this.createContract({
      cid,
      size: uploadFile.size,
      autoRenew: options.autoRenew,
      ...encryptionMetadata,
      metadata: {},
    });

    // Generate thumbnail for images
    let thumbnail;
    if (file.type.startsWith('image/')) {
      thumbnail = await this.generateThumbnail(file);
      if (thumbnail) {
        contract.thumbnail = thumbnail;
      }
    }

    // Upload file
    await this.uploadToIPFS(uploadFile, contract.id, options, contract);

    return {
      cid,
      contract,
      size: file.size,
      url: `https://ipfs.dlux.io/ipfs/${cid}`,
    };
  }

  /**
   * Create storage contract
   */
  private async createContract(contractData: any): Promise<any> {
    const auth = await this.account.sign(`create_contract:${Date.now()}`);
    
    const response = await this.account.api.post('/api/new_contract', {
      ...contractData,
      username: this.account.username
    }, auth);
    
    if (!response || response.error) {
      throw new Error(response?.error || 'Failed to create contract');
    }
    
    return response;
  }

  /**
   * Upload file to IPFS via TROLE
   */
  private async uploadToIPFS(
    file: File | Blob | { name: string; size: number; arrayBuffer: () => Promise<ArrayBuffer> },
    contractId: string,
    options: UploadOptions,
    contract?: any
  ): Promise<void> {
    // First, we need to authorize the upload
    let cid: string;
    if (file instanceof File) {
      cid = await SPKFile.hash(file);
    } else if ('arrayBuffer' in file) {
      // Handle file-like objects
      const buffer = Buffer.from(await file.arrayBuffer());
      cid = await Hash.of(buffer);
    } else {
      // For Blob, convert to File
      const tempFile = new File([file], 'chunk', { type: 'application/octet-stream' });
      cid = await SPKFile.hash(tempFile);
    }
    
    // Get the contract details if not provided
    if (!contract) {
      contract = await this.account.api.get(`/api/fileContract/${contractId}`);
    }
    
    // Authorize the upload
    const authData = await this.authorizeUpload(contract, cid);
    
    const chunkSize = options.chunkSize || 1024 * 1024; // 1MB default
    const fileSize = file.size || (file instanceof Blob ? file.size : 0);
    const chunks = Math.ceil(fileSize / chunkSize);

    this.uploadController = new AbortController();

    if (chunks === 1) {
      // Small file, single upload
      if (file instanceof Blob || file instanceof File) {
        await this.uploadChunk(file, contract, authData, 0, fileSize, options.onProgress);
      } else {
        // Convert file-like object to Blob
        const buffer = await file.arrayBuffer();
        const blob = new Blob([buffer]);
        await this.uploadChunk(blob, contract, authData, 0, fileSize, options.onProgress);
      }
    } else {
      // Large file, chunked upload
      let uploaded = 0;
      for (let i = 0; i < chunks; i++) {
        if (this.uploadController.signal.aborted) {
          throw new Error('Upload cancelled');
        }

        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, fileSize);
        
        let chunk: Blob;
        if (file instanceof File || file instanceof Blob) {
          chunk = file.slice(start, end);
        } else {
          // For file-like objects, we need to handle differently
          const buffer = await file.arrayBuffer();
          chunk = new Blob([buffer.slice(start, end)]);
        }

        await this.uploadChunk(chunk, contract, authData, start, fileSize, (chunkProgress) => {
          const totalProgress = ((uploaded + (chunkProgress * chunk.size) / 100) / fileSize) * 100;
          options.onProgress?.(Math.round(totalProgress));
        });

        uploaded += chunk.size;
      }
    }
  }

  /**
   * Authorize upload with TROLE
   */
  private async authorizeUpload(contract: any, cid: string): Promise<any> {
    const apiUrl = contract.api || 'https://ipfs.dlux.io';
    
    const response = await fetch(`${apiUrl}/upload-authorize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sig': contract.fosig,
        'X-Account': contract.t,
        'X-Contract': contract.i,
        'X-Cid': cid,
        'X-Chain': 'HIVE'
      },
      body: JSON.stringify({
        files: contract.files,
        meta: contract.m || {}
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Upload authorization failed: ${errorText}`);
    }

    return response.json();
  }

  /**
   * Upload a single chunk
   */
  private uploadChunk(
    chunk: Blob,
    contract: any,
    authData: any,
    start: number,
    totalSize: number,
    onProgress?: (percent: number) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      
      // Add chunk to form data
      formData.append('chunk', chunk);

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress((e.loaded / e.total) * 100);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          resolve();
        } else {
          reject(new Error(`Upload failed: ${xhr.status} - ${xhr.responseText}`));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Upload failed'));
      });

      xhr.addEventListener('abort', () => {
        reject(new Error('Upload cancelled'));
      });

      const apiUrl = contract.api || 'https://ipfs.dlux.io';
      xhr.open('POST', `${apiUrl}/upload`);
      
      // Set headers from auth data
      xhr.setRequestHeader('X-Cid', authData.cid || contract.df[0]);
      xhr.setRequestHeader('X-Contract', contract.i);
      xhr.setRequestHeader('X-Sig', contract.fosig);
      xhr.setRequestHeader('X-Account', contract.t);
      
      // Only set Content-Range for chunked uploads
      if (totalSize > chunk.size) {
        xhr.setRequestHeader(
          'Content-Range',
          `bytes ${start}-${start + chunk.size - 1}/${totalSize}`
        );
      }

      xhr.send(formData);
    });
  }

  /**
   * Cancel ongoing upload
   */
  cancelUpload(): void {
    this.uploadController?.abort();
  }

  /**
   * Encrypt file for specific recipients
   */
  private async encrypt(file: File, recipients: string[]): Promise<any> {
    const result = await this.encryption.encryptForUpload(file, recipients);
    
    // Convert the metadata format to match the expected structure
    const encryptedKeys = result.metadata.encryptedKeys.reduce((acc, item) => {
      acc[item.account] = item.encryptedKey;
      return acc;
    }, {} as Record<string, string>);
    
    return {
      encryptedData: await result.encryptedFile.arrayBuffer(),
      encryptedKeys,
      metadata: result.metadata
    };
  }

  /**
   * Generate thumbnail for image files
   */
  private async generateThumbnail(file: File): Promise<string | null> {
    if (!file.type.startsWith('image/')) return null;

    // This would use canvas API to generate thumbnail
    // For now, return null
    return null;
  }

  /**
   * Direct upload files that are already uploaded to IPFS
   * This method creates the blockchain transaction for direct uploads
   */
  async directUpload(fileData: Array<{ cid: string; size: number; name?: string }>, options: { metadata?: any } = {}): Promise<any> {
    if (!Array.isArray(fileData) || fileData.length === 0) {
      throw new Error('No files provided');
    }

    // Validate file data
    for (const file of fileData) {
      if (!file.cid || !file.size) {
        throw new Error('Each file must have cid and size properties');
      }
    }

    // Ensure account has registered public key
    await this.account.registerPublicKey();

    // Calculate total size
    const totalSize = fileData.reduce((sum, file) => sum + file.size, 0);

    // Calculate BROCA cost (all uploads are 30 days)
    const brocaCost = BrocaCalculator.cost(totalSize, 30);
    
    // Check if user has enough BROCA
    const availableBroca = await this.account.calculateBroca();
    if (brocaCost > availableBroca) {
      throw new Error(`Insufficient BROCA. Required: ${brocaCost}, Available: ${availableBroca}`);
    }

    // Prepare CIDs and sizes for the direct_upload operation
    const cids = fileData.map(f => f.cid).join(',');
    const sizes = fileData.map(f => f.size).join(',');

    // Create the direct upload transaction (contract ID will be generated backend)
    const json: any = {
      op: 'direct_upload',
      c: cids,
      s: sizes,
    };

    // Calculate proper metadata string that matches honeycomb validation
    const metadataString = this.calculateMetadataString(fileData, options.metadata);
    if (metadataString) {
      json['m'] = metadataString;
    }

    // Check if we need to chunk the payload
    const jsonString = JSON.stringify(json);
    if (jsonString.length > 7800) {
      return this.directUploadChunked(fileData, options, totalSize, brocaCost);
    }

    // Execute the direct upload transaction
    if (!this.account.hasKeychain) {
      throw new Error('Hive Keychain not available');
    }

    // Determine the correct SPK network ID based on the node being used
    const spkNetworkId = this.account.node.includes('spktest') ? 'spkcc_spktest' : 'spkcc_dlux';

    return new Promise((resolve, reject) => {
      const keychain = (window as any).hive_keychain;
      if (!keychain) {
        reject(new Error('Hive Keychain not found'));
        return;
      }
      
      keychain.requestCustomJson(
        this.account.username,
        spkNetworkId,
        'Active',
        JSON.stringify(json),
        `Direct upload ${fileData.length} file(s) (${totalSize} bytes)`,
        (response: any) => {
          if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve({
              success: true,
              transactionId: response.result.id,
              files: fileData.map(f => ({
                cid: f.cid,
                size: f.size,
                name: f.name,
                url: `https://ipfs.dlux.io/ipfs/${f.cid}`
              })),
              totalSize,
              brocaCost,
            });
          }
        }
      );
    });
  }

  /**
   * Calculate metadata string in the format expected by honeycomb
   * Format: contractData,cid1,name1,ext1,metadata1,cid2,name2,ext2,metadata2,...
   * Length must be: cids.length * 4 + 1
   */
  private calculateMetadataString(
    fileData: Array<{ cid: string; size: number; name?: string }>,
    metadata?: any
  ): string {
    const parts: string[] = [];
    
    // Contract data (first part) - for direct uploads, use "1"
    parts.push('1');
    
    // For each file, add 4 parts: cid, name, ext, metadata
    fileData.forEach((data, index) => {
      let baseName = data.name ? data.name.replace(/\.[^/.]+$/, '') : `file${index}`;
      let fileExt = data.name ? data.name.split('.').pop() || '' : '';
      
      // Override with metadata if provided
      if (metadata?.files?.[index]) {
        baseName = metadata.files[index].name || baseName;
        fileExt = metadata.files[index].ext || fileExt;
      } else if (metadata && !metadata.files && index === 0) {
        // Single file metadata
        baseName = metadata.name || baseName;
        fileExt = metadata.ext || fileExt;
      }
      
      parts.push(data.cid); // CID
      parts.push(baseName); // Name without extension
      parts.push(fileExt); // Extension
      
      // File-specific metadata
      let fileMetadata = '';
      if (metadata) {
        if (metadata.files && metadata.files[index]) {
          const fileMeta = metadata.files[index];
          
          // Convert tags to flag if present
          if (fileMeta.tags) {
            const tagFlag = Array.isArray(fileMeta.tags) 
              ? fileMeta.tags.reduce((acc: number, tag: number) => acc | tag, 0)
              : fileMeta.tags;
            fileMetadata += this.encodeBase64Number(tagFlag);
          }
          
          // Add other metadata fields
          if (fileMeta.labels) fileMetadata += `|${fileMeta.labels}`;
          if (fileMeta.license) fileMetadata += `|${fileMeta.license}`;
        } else if (typeof metadata === 'object' && !metadata.files) {
          // Single file metadata
          if (metadata.tags) {
            const tagFlag = Array.isArray(metadata.tags) 
              ? metadata.tags.reduce((acc: number, tag: number) => acc | tag, 0)
              : metadata.tags;
            fileMetadata += this.encodeBase64Number(tagFlag);
          }
          
          if (metadata.labels) fileMetadata += `|${metadata.labels}`;
          if (metadata.license) fileMetadata += `|${metadata.license}`;
        }
      }
      
      parts.push(fileMetadata); // Metadata for this file
    });
    
    return parts.join(',');
  }

  /**
   * Handle chunked direct upload for payloads over 7800 bytes
   * Splits into multiple direct_upload transactions with delays
   */
  private async directUploadChunked(
    fileData: Array<{ cid: string; size: number; name?: string }>,
    options: any,
    totalSize: number,
    brocaCost: number
  ): Promise<any> {
    const spkNetworkId = this.account.node.includes('spktest') ? 'spkcc_spktest' : 'spkcc_dlux';
    
    // Split files into chunks that each create a separate direct_upload transaction
    const chunks: Array<{ files: typeof fileData; chunkIndex: number }> = [];
    let currentChunkFiles: typeof fileData = [];
    let currentChunkIndex = 0;
    
    for (let i = 0; i < fileData.length; i++) {
      currentChunkFiles.push(fileData[i]);
      
      // Calculate metadata for current chunk
      const chunkMetadata = this.calculateMetadataString(currentChunkFiles, {
        files: options.metadata?.files?.slice(currentChunkIndex, i + 1)
      });
      
      // Create test direct_upload JSON to check size
      const testJson = {
        op: 'direct_upload',
        c: currentChunkFiles.map(f => f.cid).join(','),
        s: currentChunkFiles.map(f => f.size).join(','),
        m: chunkMetadata
      };
      
      // If this chunk would be too big, save the previous chunk and start a new one
      if (JSON.stringify(testJson).length >= 7800 && currentChunkFiles.length > 1) {
        // Remove the last file and save current chunk
        const lastFile = currentChunkFiles.pop()!;
        
        chunks.push({
          files: [...currentChunkFiles],
          chunkIndex: currentChunkIndex
        });
        
        // Start new chunk with the file that didn't fit
        currentChunkFiles = [lastFile];
        currentChunkIndex = i;
      }
    }
    
    // Add the last chunk
    if (currentChunkFiles.length > 0) {
      chunks.push({
        files: [...currentChunkFiles],
        chunkIndex: currentChunkIndex
      });
    }
    
    // Broadcast all chunks as separate direct_upload transactions with delays
    const chunkResults: any[] = [];
    const allFiles: any[] = [];
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      // Calculate metadata for this chunk
      const chunkMetadata = this.calculateMetadataString(chunk.files, {
        files: options.metadata?.files?.slice(chunk.chunkIndex, chunk.chunkIndex + chunk.files.length)
      });
      
      const chunkJson = {
        op: 'direct_upload',
        c: chunk.files.map(f => f.cid).join(','),
        s: chunk.files.map(f => f.size).join(','),
        m: chunkMetadata
      };
      
      // Broadcast this chunk
      const result = await this.broadcastDirectUpload(chunkJson, spkNetworkId, chunk.files.length, chunk.files.reduce((sum, f) => sum + f.size, 0));
      chunkResults.push(result);
      
      // Add files from this chunk to the overall result
      allFiles.push(...chunk.files.map(f => ({
        cid: f.cid,
        size: f.size,
        name: f.name,
        url: `https://ipfs.dlux.io/ipfs/${f.cid}`
      })));
      
      // Add 5-second delay between chunks (except for the last one)
      if (i < chunks.length - 1) {
        await this.delay(5000);
      }
    }
    
    return {
      success: true,
      transactionIds: chunkResults.map(r => r.transactionId),
      files: allFiles,
      totalSize,
      brocaCost,
      chunked: true,
      totalChunks: chunks.length
    };
  }

  /**
   * Helper method to add delays between transactions
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Broadcast a single direct_upload transaction
   */
  private broadcastDirectUpload(json: any, spkNetworkId: string, fileCount: number, totalSize: number): Promise<any> {
    return new Promise((resolve, reject) => {
      const keychain = (window as any).hive_keychain;
      if (!keychain) {
        reject(new Error('Hive Keychain not found'));
        return;
      }
      
      keychain.requestCustomJson(
        this.account.username,
        spkNetworkId,
        'Active',
        JSON.stringify(json),
        `Direct upload ${fileCount} file(s) (${totalSize} bytes)`,
        (response: any) => {
          if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve({
              success: true,
              transactionId: response.result.id
            });
          }
        }
      );
    });
  }

  /**
   * Encode number to Base64 using the same algorithm as honeycomb
   */
  private encodeBase64Number(num: number): string {
    const glyphs64 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz+=";
    
    if (isNaN(Number(num)) || num === null || num === Number.POSITIVE_INFINITY) {
      throw new Error("The input is not valid");
    }
    if (num < 0) throw new Error("Can't represent negative numbers");
    
    let residual = Math.floor(num);
    let result = "";
    
    while (true) {
      const char = residual % 64;
      result = glyphs64.charAt(char) + result;
      residual = Math.floor(residual / 64);
      if (residual === 0) break;
    }
    
    return result;
  }
}