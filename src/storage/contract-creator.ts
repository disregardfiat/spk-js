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
  forceNew?: boolean; // Force creation of new contract even if existing ones are available
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
  reused?: boolean;
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
   * Find an existing open contract with enough space
   */
  async findOpenContract(requiredSize: number): Promise<any | null> {
    try {
      // Refresh account data to get latest contracts
      await this.spk.refresh();
      
      // Check channels first (this is where contracts are stored)
      if (this.spk.channels && this.spk.channels[this.spk.username]) {
        console.log('Checking channels for existing contracts...');
        const userChannels = this.spk.channels[this.spk.username];
        
        for (const [channelKey, contract] of Object.entries(userChannels)) {
          const c = contract as any;
          console.log(`Checking contract ${c.i}: r=${c.r}, a=${c.a}`);
          
          // Check if contract has space
          // a = available bytes
          // r = BROCA cost (not space!)
          // t = account (to/uploader)
          // i = contract ID
          const availableSpace = c.a || 0;
          
          // Check if there's enough space for the new file
          if (availableSpace >= requiredSize) {
            console.log(`Found existing contract ${c.i} with ${availableSpace} bytes available`);
            return {
              ...c,
              remainingSpace: availableSpace
            };
          } else {
            console.log(`Contract ${c.i} has insufficient space: ${availableSpace} bytes available, need ${requiredSize} bytes`);
          }
        }
      }
      
      // Also check file_contracts if it exists
      if (this.spk.file_contracts && Object.keys(this.spk.file_contracts).length > 0) {
        console.log('Checking file_contracts...');
        for (const [contractId, contract] of Object.entries(this.spk.file_contracts)) {
          const c = contract as any;
          if (c.t && c.r) {
            const usedSpace = c.t || 0;
            const totalSpace = c.r || 0;
            const remainingSpace = totalSpace - usedSpace;
            
            if (remainingSpace >= requiredSize) {
              console.log(`Found existing contract ${contractId} with ${remainingSpace} bytes available`);
              return {
                ...c,
                i: contractId,
                remainingSpace
              };
            }
          }
        }
      }
      
      return null;
    } catch (error) {
      console.warn('Error checking existing contracts:', error);
      return null;
    }
  }

  /**
   * Create a storage contract for files
   */
  async createStorageContract(totalSize: number, options: ContractOptions = {}): Promise<ContractResult> {
    try {
      // First check if we can reuse an existing contract
      const existingContract = await this.findOpenContract(totalSize);
      if (existingContract && !options.forceNew) {
        console.log('Reusing existing contract:', existingContract.i);
        
        // Get provider details from the existing contract
        const provider = {
          nodeId: existingContract.b || existingContract.broker,
          api: existingContract.api || `https://${existingContract.b || existingContract.broker}`
        };
        
        return {
          success: true,
          contractId: existingContract.i,
          transactionId: existingContract.txId || '',
          provider,
          brocaCost: 0, // No additional BROCA cost for reusing
          size: totalSize,
          duration: 30,
          reused: true
        };
      }
      // Calculate BROCA cost
      const brocaAmount = await this.calculateBrocaCost(totalSize, options.duration || 30);
      
      // Check BROCA balance
      const availableBroca = await this.spk.calculateBroca();
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
      
      // Wait a moment for the transaction to be processed
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Fetch the user's contracts to find the newly created one
      const accountData = await this.spk.api.get(`/@${this.spk.username}`);
      
      // Look for the contract that was just created (newest one)
      let contractId: string | null = null;
      if (accountData.channels && accountData.channels[this.spk.username]) {
        // Find the contract with matching transaction ID or the newest one
        const channels = accountData.channels[this.spk.username];
        for (const [key, contract] of Object.entries(channels)) {
          const c = contract as any;
          // TODO: Match by transaction ID when available
          // For now, assume the newest contract is ours
          contractId = c.i;
          break;
        }
      }
      
      if (!contractId) {
        // Fallback to generated ID if we can't find the real one
        console.warn('Could not find contract ID from blockchain, using generated ID');
        contractId = this.generateContractId(result.id);
      }
      
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
    if (!this.spk.keychainAdapter) {
      throw new Error('Keychain not available');
    }
    
    // Use the KeychainAdapter's broadcast method instead of calling requestBroadcast directly
    try {
      const result = await this.spk.keychainAdapter.broadcast(
        this.spk.username,
        [['custom_json', customJson]],
        'posting'
      );
      return result;
    } catch (error: any) {
      throw new Error(error.message || 'Broadcast failed');
    }
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