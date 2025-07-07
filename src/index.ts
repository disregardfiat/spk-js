import { SPKAccount } from './core/account';
import { SPKFile, UploadOptions, UploadResult } from './storage/file';
import { BrocaCalculator } from './tokens/broca';
import { SPKConfig } from './core/config';
import { SPKDrive } from './drive';

export * from './core/account';
export * from './core/api';
export * from './core/config';
export * from './storage/file';
export * from './storage/metadata';
export * from './tokens/broca';
export * from './drive';

// Re-export specific classes for easier access
export { BrocaCalculator } from './tokens/broca';
export { SPKAccount } from './core/account';
export { SPKAPI } from './core/api';

// Export wallet calculation methods
export * as walletCalculations from './wallet/calculations';
export * as precision from './utils/precision';

// Export UI utilities
export * from './ui/icons';

/**
 * Main SPK Network interface
 */
export default class SPK {
  public account: SPKAccount;
  private file: SPKFile;
  public drive: SPKDrive;

  constructor(username: string, options: Partial<SPKConfig> = {}) {
    this.account = new SPKAccount(username, options);
    this.file = new SPKFile(this.account);
    this.drive = new SPKDrive(this.account);
  }

  /**
   * Initialize the SPK instance
   */
  async init(): Promise<void> {
    await this.account.init();
  }

  /**
   * Upload a file to SPK Network
   */
  async upload(file: File, options?: UploadOptions): Promise<UploadResult> {
    return this.file.upload(file, options);
  }

  /**
   * Get current token balances
   */
  async getBalances(refresh = false): Promise<{
    larynx: number;
    spk: number;
    broca: number;
  }> {
    return this.account.getBalances(refresh);
  }

  /**
   * Send LARYNX tokens
   */
  async sendLarynx(amount: number, to: string, memo = ''): Promise<any> {
    return this.account.sendLarynx(amount, to, memo);
  }

  /**
   * Send SPK tokens
   */
  async sendSpk(amount: number, to: string, memo = ''): Promise<any> {
    return this.account.sendSpk(amount, to, memo);
  }

  /**
   * Power up LARYNX tokens
   */
  async powerUp(amount: number): Promise<any> {
    return this.account.powerUp(amount);
  }

  /**
   * Power down LARYNX tokens
   */
  async powerDown(amount: number): Promise<any> {
    return this.account.powerDown(amount);
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
  async decrypt(cid: string): Promise<Blob> {
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
  async getStorageProviders(): Promise<any[]> {
    const stats = await this.getNetworkStats();
    const providers = [];
    
    if (stats && stats.peers) {
      for (const [account, data] of Object.entries(stats.peers)) {
        if (data.ipfs) {
          providers.push({
            account,
            ipfs: data.ipfs,
            bid: data.bid || 0.015,
            ...data
          });
        }
      }
    }
    
    return providers.sort((a, b) => a.bid - b.bid);
  }

  /**
   * Create storage contract
   */
  async createContract(contractData: any): Promise<any> {
    const auth = await this.account.sign(`create_contract:${Date.now()}`);
    return this.account.api.post('/api/new_contract', contractData, auth);
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
   */
  async directUpload(files: File[], options: UploadOptions = {}): Promise<UploadResult[]> {
    const results = [];
    
    for (const file of files) {
      const result = await this.upload(file, options);
      results.push(result);
    }
    
    return results;
  }