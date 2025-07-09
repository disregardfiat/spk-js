/**
 * SPK Contract Creator
 * Creates storage contracts on the SPK network using blockchain transactions
 */

import { StorageProviderSelector } from './provider-selector';
import { Buffer } from 'buffer';

export interface ContractOptions {
  duration?: number;
  beneficiary?: {
    account: string;
    weight: number; // 0-1 (0-100%)
  };
  metadata?: any;
}

export interface ContractResult {
  success: boolean;
  contractId: string;
  transactionId: string;
  provider: {
    nodeId: string;
    api: string;
  };
  brocaCost: number;
  size: number;
  duration: number;
}

export interface DirectUploadResult extends ContractResult {
  directUpload: boolean;
  uploadTransactionId: string;
  files: Array<{
    cid: string;
    size: number;
    name: string;
  }>;
}

export interface FileData {
  name: string;
  size: number;
  cid?: string;
}

export class SPKContractCreator {
  private spk: any; // SPK instance
  private apiUrl: string;
  public selector: StorageProviderSelector;
  private tokenPrefix: string;

  constructor(spkInstance: any, apiUrl: string = 'https://spktest.dlux.io') {
    this.spk = spkInstance;
    this.apiUrl = apiUrl;
    this.selector = new StorageProviderSelector(apiUrl);
    this.tokenPrefix = apiUrl.includes('spktest') ? 'spkccT_' : 'spkcc_dlux_';
  }

  /**
   * Create a storage contract for files
   */
  async createStorageContract(totalSize: number, options: ContractOptions = {}): Promise<ContractResult> {
    try {
      // Calculate BROCA cost
      const brocaAmount = await this.calculateBrocaCost(totalSize, options.duration || 30);
      
      // Check BROCA balance
      const availableBroca = await this.spk.account.calculateBroca();
      if (brocaAmount > availableBroca) {
        throw new Error(`Insufficient BROCA. Required: ${brocaAmount}, Available: ${availableBroca}`);
      }
      
      // Select best provider
      console.log('Selecting storage provider for', this.selector.formatBytes(totalSize));
      const provider = await this.selector.selectBestProvider(totalSize);
      console.log('Selected provider:', provider.nodeId, 'with', this.selector.formatBytes(provider.freeSpace), 'free');
      
      // Prepare contract parameters
      const contractParams: any = {
        to: this.spk.username,  // Storage contract for self
        broca: Math.ceil(brocaAmount),
        broker: provider.nodeId,
        contract: "0"  // Standard contract (not beneficiary)
      };
      
      // Add beneficiary if specified
      if (options.beneficiary) {
        contractParams.contract = "1";
        contractParams.slots = `${options.beneficiary.account},${Math.round(options.beneficiary.weight * 100)}`;
      }
      
      // Create the blockchain transaction
      const customJson = {
        required_auths: [],
        required_posting_auths: [this.spk.username],
        id: `${this.tokenPrefix}channel_open`,
        json: JSON.stringify(contractParams)
      };
      
      console.log('Creating storage contract:', contractParams);
      
      // Sign and broadcast the transaction
      const result = await this.broadcastTransaction(customJson);
      
      // Generate contract ID from transaction
      const contractId = this.generateContractId(result.id);
      
      // Return contract details
      return {
        success: true,
        contractId,
        transactionId: result.id,
        provider: {
          nodeId: provider.nodeId,
          api: provider.api
        },
        brocaCost: brocaAmount,
        size: totalSize,
        duration: options.duration || 30
      };
      
    } catch (error) {
      console.error('Failed to create storage contract:', error);
      throw error;
    }
  }

  /**
   * Calculate BROCA cost for storage
   */
  async calculateBrocaCost(sizeInBytes: number, durationInDays: number = 30): Promise<number> {
    try {
      // Get network stats for accurate calculation
      const response = await fetch(`${this.apiUrl}/`);
      const stats = await response.json();
      
      // Use network's channel_bytes if available (usually 1024 bytes per BROCA)
      const bytesPerBroca = stats.result?.channel_bytes || 1024;
      
      // Calculate base cost
      let brocaCost = Math.ceil(sizeInBytes / bytesPerBroca);
      
      // Apply duration multiplier if not standard 30 days
      if (durationInDays !== 30) {
        brocaCost = Math.ceil(brocaCost * (durationInDays / 30));
      }
      
      // Apply minimum channel cost
      const minCost = stats.result?.channel_min || 100;
      return Math.max(brocaCost, minCost);
      
    } catch (error) {
      console.warn('Failed to get network stats, using defaults:', error);
      // Fallback calculation
      const brocaCost = Math.ceil(sizeInBytes / 1024); // 1 BROCA per KB
      return Math.max(brocaCost, 100); // Minimum 100 BROCA
    }
  }

  /**
   * Broadcast transaction to blockchain
   */
  private async broadcastTransaction(customJson: any): Promise<any> {
    // Use spk-js keychain to sign and broadcast
    return new Promise((resolve, reject) => {
      this.spk.keychain.requestBroadcast(
        this.spk.username,
        [['custom_json', customJson]],
        'posting',
        (response: any) => {
          if (response.success) {
            resolve(response.result);
          } else {
            reject(new Error(response.error || 'Broadcast failed'));
          }
        }
      );
    });
  }

  /**
   * Generate contract ID from transaction ID
   */
  generateContractId(_txId: string): string {
    // Contract ID format: username_timestamp_random
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `${this.spk.username}_${timestamp}_${random}`;
  }

  /**
   * Get contract details from blockchain
   */
  async getContractDetails(contractId: string): Promise<any> {
    try {
      const response = await fetch(`${this.apiUrl}/api/fileContract/${contractId}`);
      if (!response.ok) {
        throw new Error(`Contract not found: ${contractId}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Failed to get contract details:', error);
      throw error;
    }
  }

  /**
   * Create a direct upload contract (for trusted uploads)
   */
  async createDirectUploadContract(files: FileData[], options: ContractOptions = {}): Promise<DirectUploadResult> {
    // Calculate total size
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    
    // Create base contract first
    const contract = await this.createStorageContract(totalSize, options);
    
    // Prepare file metadata
    const fileData = files.map(file => ({
      cid: file.cid || '', // Will be calculated during upload
      size: file.size,
      name: file.name
    }));
    
    // Create direct upload transaction
    const directUploadJson: any = {
      op: 'direct_upload',
      c: fileData.map(f => f.cid).join(','),
      s: fileData.map(f => f.size).join(','),
      id: contract.contractId
    };
    
    // Add metadata if provided
    if (options.metadata) {
      directUploadJson.m = Buffer.from(JSON.stringify(options.metadata)).toString('base64');
    }
    
    const customJson = {
      required_auths: [this.spk.username],
      required_posting_auths: [],
      id: `${this.tokenPrefix}direct_upload`,
      json: JSON.stringify(directUploadJson)
    };
    
    // Broadcast direct upload
    const uploadResult = await this.broadcastTransaction(customJson);
    
    return {
      ...contract,
      directUpload: true,
      uploadTransactionId: uploadResult.id,
      files: fileData
    };
  }
}