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
  duration?: number;
  autoRenew?: boolean;
  encrypt?: string[];
  metaData?: FileMetadataItem[];
  chunkSize?: number;
  onProgress?: (percent: number) => void;
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
      duration: options.duration || 30,
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
   * Direct upload method - uploads files directly to IPFS without broker verification
   * This creates a completed storage contract immediately upon upload
   */
  async directUpload(files: (File | { name: string; size: number; arrayBuffer: () => Promise<ArrayBuffer> })[], options: { duration?: number; metadata?: any } = {}): Promise<any> {
    if (!files || files.length === 0) {
      throw new Error('No files provided');
    }

    // Ensure account has registered public key
    await this.account.registerPublicKey();

    // Generate CIDs and calculate total size
    const fileData: Array<{ file: File | { name: string; size: number; arrayBuffer: () => Promise<ArrayBuffer> }; cid: string; size: number }> = [];
    let totalSize = 0;

    for (const file of files) {
      let cid: string;
      if (file instanceof File) {
        cid = await SPKFile.hash(file);
      } else {
        // Handle file-like objects
        const buffer = Buffer.from(await file.arrayBuffer());
        cid = await Hash.of(buffer);
      }
      fileData.push({ file, cid, size: file.size });
      totalSize += file.size;
    }

    // Calculate BROCA cost
    const duration = options.duration || 30;
    const brocaCost = BrocaCalculator.cost(totalSize, duration);
    
    // Check if user has enough BROCA
    const availableBroca = await this.account.calculateBroca();
    if (brocaCost > availableBroca) {
      throw new Error(`Insufficient BROCA. Required: ${brocaCost}, Available: ${availableBroca}`);
    }

    // Generate unique contract ID
    const contractId = `${this.account.username}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Prepare CIDs and sizes for the direct_upload operation
    const cids = fileData.map(f => f.cid).join(',');
    const sizes = fileData.map(f => f.size).join(',');

    // Create the direct upload transaction
    const json: any = {
      op: 'direct_upload',
      c: cids,
      s: sizes,
      id: contractId,
    };

    // Add metadata if provided
    if (options.metadata) {
      json['m'] = Buffer.from(JSON.stringify(options.metadata)).toString('base64');
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
        `Direct upload ${files.length} file(s) (${totalSize} bytes)`,
        async (response: any) => {
          if (response.error) {
            reject(new Error(response.error));
          } else {
            // Upload files to IPFS after transaction is broadcast
            try {
              // Create a mock contract object that matches the expected format
              const mockContract = {
                i: contractId,
                t: this.account.username,
                df: fileData.map(f => f.cid),
                files: cids,
                api: this.account.node,
                fosig: 'direct_upload', // This is a special case for direct uploads
                m: options.metadata || {}
              };
              
              for (const { file } of fileData) {
                await this.uploadToIPFS(file, contractId, {}, mockContract);
              }
              
              resolve({
                success: true,
                contractId,
                transactionId: response.result.id,
                files: fileData.map(f => ({
                  cid: f.cid,
                  size: f.size,
                  url: `https://ipfs.dlux.io/ipfs/${f.cid}`
                })),
                totalSize,
                brocaCost,
              });
            } catch (uploadError) {
              reject(uploadError);
            }
          }
        }
      );
    });
  }
}