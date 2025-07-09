import { SPKAccount } from '../core/account';
import { BrocaCalculator } from '../tokens/broca';
import { SPKFileMetadata } from './file-metadata';
import { FileMetadataItem, UploadOptions, UploadResult } from './file';
import { SPKContractCreator } from './contract-creator';
import Hash from 'ipfs-only-hash';
import { Buffer } from 'buffer';

export interface BatchUploadResult {
  results: UploadResult[];
  totalSize: number;
  totalBrocaCost: number;
  contractId: string;
}

export interface FileWithMetadata {
  file: File;
  metadata?: FileMetadataItem;
  cid?: string;
  size: number;
}

/**
 * Enhanced SPK Network file upload operations
 */
export class SPKFileUpload {
  private account: SPKAccount;
  private uploadController?: AbortController;
  private contractCreator?: SPKContractCreator;

  constructor(account: SPKAccount) {
    this.account = account;
    // Contract creator will be initialized when needed with proper SPK instance
  }

  /**
   * Upload single or multiple files with metadata support
   */
  async upload(
    files: File | File[], 
    options: UploadOptions = {}
  ): Promise<UploadResult | BatchUploadResult> {
    // Convert single file to array for uniform processing
    const fileArray = Array.isArray(files) ? files : [files];
    
    if (fileArray.length === 0) {
      throw new Error('No files provided');
    }

    // Validate metadata if provided
    if (options.metaData) {
      this.validateMetadata(fileArray, options.metaData);
    }

    // Single file upload
    if (fileArray.length === 1 && (!options.metaData || options.metaData.length <= 1)) {
      return this.uploadSingleFile(fileArray[0], options);
    }

    // Batch upload
    return this.uploadBatch(fileArray, options);
  }

  /**
   * Upload a single file
   */
  private async uploadSingleFile(
    file: File, 
    options: UploadOptions
  ): Promise<UploadResult> {
    // Ensure account has registered public key
    await this.account.registerPublicKey();

    // Generate CID
    const cid = await this.hashFile(file);

    // Get metadata for this file
    const metadata = options.metaData?.[0];
    const spkMetadata = metadata ? this.convertToSPKMetadata(metadata) : {};

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

    // Handle thumbnail
    let thumbnailCid = metadata?.thumbnail;
    if (!thumbnailCid && file.type.startsWith('image/')) {
      const generatedThumb = await this.generateThumbnail(file);
      thumbnailCid = generatedThumb || undefined;
    }

    // Create contract
    const contract = await this.createContract({
      cid,
      size: uploadFile.size,
      duration: options.duration || 30,
      autoRenew: metadata?.autoRenew ?? options.autoRenew,
      ...encryptionMetadata,
      metadata: {
        ...spkMetadata,
        thumb: thumbnailCid
      },
    });

    // Upload file with progress tracking
    const fileProgress = metadata?.onProgress || options.onProgress;
    await this.uploadToIPFS(uploadFile, contract.id, fileProgress, contract);

    return {
      cid,
      contract,
      size: file.size,
      url: `https://ipfs.dlux.io/ipfs/${cid}`,
    };
  }

  /**
   * Upload multiple files as a batch
   */
  private async uploadBatch(
    files: File[], 
    options: UploadOptions
  ): Promise<BatchUploadResult> {
    // Ensure account has registered public key
    await this.account.registerPublicKey();

    // Process all files
    const filesWithMetadata: FileWithMetadata[] = [];
    let totalSize = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const metadata = options.metaData?.find(m => m.FileIndex === i);
      const cid = await this.hashFile(file);
      
      filesWithMetadata.push({
        file,
        metadata,
        cid,
        size: file.size
      });
      
      totalSize += file.size;
    }

    // Calculate total BROCA cost
    const duration = options.duration || 30;
    const totalBrocaCost = BrocaCalculator.cost(totalSize, duration);

    // Check if user has enough BROCA
    const availableBroca = await this.account.calculateBroca();
    if (totalBrocaCost > availableBroca) {
      throw new Error(`Insufficient BROCA. Required: ${totalBrocaCost}, Available: ${availableBroca}`);
    }

    // Create batch contract
    const contractId = `${this.account.username}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create individual contracts for each file
    const results: UploadResult[] = [];
    
    for (const fileData of filesWithMetadata) {
      const { file, metadata, cid } = fileData;
      
      // Convert metadata
      const spkMetadata = metadata ? this.convertToSPKMetadata(metadata) : {};
      
      // Handle encryption
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

      // Handle thumbnail
      let thumbnailCid = metadata?.thumbnail;
      if (!thumbnailCid && file.type.startsWith('image/')) {
        const generatedThumb = await this.generateThumbnail(file);
        thumbnailCid = generatedThumb || undefined;
      }

      // Create contract for this file
      const contract = await this.createContract({
        cid: cid!,
        size: uploadFile.size,
        duration: options.duration || 30,
        autoRenew: metadata?.autoRenew ?? options.autoRenew,
        batchId: contractId,
        ...encryptionMetadata,
        metadata: {
          ...spkMetadata,
          thumb: thumbnailCid
        },
      });

      // Upload file with individual progress tracking
      const fileProgress = metadata?.onProgress || options.onProgress;
      await this.uploadToIPFS(uploadFile, contract.id, fileProgress, contract);

      results.push({
        cid: cid!,
        contract,
        size: file.size,
        url: `https://ipfs.dlux.io/ipfs/${cid}`,
      });
    }

    return {
      results,
      totalSize,
      totalBrocaCost,
      contractId
    };
  }

  /**
   * Validate metadata matches files
   */
  private validateMetadata(files: File[], metadata: FileMetadataItem[]): void {
    for (const meta of metadata) {
      if (meta.FileIndex < 0 || meta.FileIndex >= files.length) {
        throw new Error(`Invalid FileIndex ${meta.FileIndex}. Must be between 0 and ${files.length - 1}`);
      }
    }
  }

  /**
   * Convert FileMetadataItem to SPK format
   */
  private convertToSPKMetadata(metadata: FileMetadataItem): any {
    const spkMeta = new SPKFileMetadata({
      name: metadata.name,
      ext: metadata.ext,
      tags: metadata.tags,
      labels: metadata.labels,
      license: metadata.license
    });

    const converted = spkMeta.toSPKFormat();
    
    // Add path if provided
    if (metadata.path) {
      converted.path = metadata.path;
    }
    
    return converted;
  }

  /**
   * Generate IPFS hash for a file
   */
  private async hashFile(file: File): Promise<string> {
    if (!file || !(file instanceof File)) {
      throw new Error('Invalid file');
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    return Hash.of(buffer);
  }

  /**
   * Create storage contract using blockchain transaction
   */
  private async createContract(contractData: any): Promise<any> {
    // Initialize contract creator if not already done
    if (!this.contractCreator) {
      // Get the SPK instance from the global context
      const spkInstance = (global as any).currentSPKInstance || this.account;
      this.contractCreator = new SPKContractCreator(spkInstance, this.account.node);
    }
    
    // Use the contract creator to create a blockchain-based contract
    const result = await this.contractCreator.createStorageContract(
      contractData.size,
      {
        duration: contractData.duration,
        beneficiary: contractData.beneficiary,
        metadata: contractData.metadata
      }
    );
    
    // Transform result to match expected contract format
    return {
      i: result.contractId,
      t: this.account.username,
      n: result.provider.nodeId,
      api: result.provider.api,
      df: [contractData.cid],
      m: contractData.metadata || {},
      a: contractData.autoRenew || false,
      r: 0, // Renewals
      u: Date.now(), // Updated timestamp
      // Generate fosig (file owner signature) for upload authorization
      fosig: await this.account.sign(`${result.contractId}:${contractData.cid}:${Date.now()}`)
    };
  }

  /**
   * Upload file to IPFS via TROLE
   */
  private async uploadToIPFS(
    file: File | Blob,
    contractId: string,
    onProgress?: (percent: number) => void,
    contract?: any
  ): Promise<void> {
    // Get the contract details if not provided
    if (!contract) {
      contract = await this.account.api.get(`/api/fileContract/${contractId}`);
    }
    
    // Get CID
    const cid = contract.df?.[0] || await this.hashFile(file as File);
    
    // Authorize the upload
    const authData = await this.authorizeUpload(contract, cid);
    
    const chunkSize = 1024 * 1024; // 1MB chunks
    const fileSize = file.size;
    const chunks = Math.ceil(fileSize / chunkSize);

    this.uploadController = new AbortController();

    if (chunks === 1) {
      // Small file, single upload
      await this.uploadChunk(file, contract, authData, 0, fileSize, onProgress);
    } else {
      // Large file, chunked upload
      let uploaded = 0;
      for (let i = 0; i < chunks; i++) {
        if (this.uploadController.signal.aborted) {
          throw new Error('Upload cancelled');
        }

        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, fileSize);
        const chunk = file.slice(start, end);

        await this.uploadChunk(chunk, contract, authData, start, fileSize, (chunkProgress) => {
          const totalProgress = ((uploaded + (chunkProgress * chunk.size) / 100) / fileSize) * 100;
          onProgress?.(Math.round(totalProgress));
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
      console.log('[SPKFileUpload] Appending chunk to FormData:', {
        chunkType: typeof chunk,
        chunkConstructor: chunk.constructor?.name,
        chunkSize: (chunk as any).size || (chunk as any).length || 'unknown',
        isFile: chunk instanceof File,
        hasContent: !!(chunk as any)._content
      });
      formData.append('chunk', chunk, 'chunk.dat');

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
      
      // Always set Content-Range header
      xhr.setRequestHeader(
        'Content-Range',
        `bytes ${start}-${start + chunk.size - 1}/${totalSize}`
      );

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
    // This would use WebCrypto API or a library like crypto-js
    // For now, return mock encrypted data
    return {
      encryptedData: await file.arrayBuffer(),
      encryptedKeys: recipients.reduce((acc, recipient) => {
        acc[recipient] = 'encrypted_key_' + recipient;
        return acc;
      }, {} as Record<string, string>),
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
}