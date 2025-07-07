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
export { default as SPKDriveVue } from './drive/SPKDriveVue';

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
}