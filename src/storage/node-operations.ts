import { SPKAccount } from '../core/account';
import { SPKAPI } from '../core/api';
import { KeychainAdapter } from '../core/keychain-adapter';

export interface StorageContract {
  id: string;
  owner: string;
  size: number;
  providers: number;
  expiryBlock: number;
  isStoring: boolean;
  nodePosition?: number;
}

export interface NodeStatus {
  registered: boolean;
  service?: string;
  domain?: string;
  bidRate?: number;
  timestamp?: number;
}

export interface ExtendResult {
  success: boolean;
  id: string;
  contractId: string;
  extendedBy: number; // blocks
}

/**
 * Handles node registration and storage operations
 */
export class NodeOperations {
  constructor(
    private account: SPKAccount,
    private api: SPKAPI,
    private keychainAdapter: KeychainAdapter | null
  ) {}

  // Note: registerNode is handled by TokenOperations to avoid duplication
  // Use spk.registerNode() instead

  /**
   * Register a public key authority
   * @param pubKey - Public key (STM format, 53 characters)
   */
  async registerAuthority(pubKey: string): Promise<any> {
    // Validate public key format
    if (!pubKey || !pubKey.startsWith('STM') || pubKey.length !== 53) {
      throw new Error('Invalid public key format. Must be STM format with 53 characters.');
    }

    if (!this.keychainAdapter || !this.keychainAdapter.isAvailable()) {
      throw new Error('Keychain/Signer not available');
    }

    const customJsonId = 'spk-register-authority';
    const json = {
      pubKey,
      from: this.account.username,
    };

    try {
      const result = await this.keychainAdapter.broadcastCustomJson(
        this.account.username,
        customJsonId,
        'Active',
        json,
        'Register SPK Authority'
      );

      return {
        id: result.id,
        success: true,
      };
    } catch (error: any) {
      throw new Error(`Authority registration failed: ${error.message}`);
    }
  }

  /**
   * Store files on the network (become a storage provider)
   * @param contractIds - Array of contract IDs to store
   */
  async storeFiles(contractIds: string[]): Promise<{
    success: boolean;
    stored: string[];
    id: string;
  }> {
    if (!contractIds || contractIds.length === 0) {
      throw new Error('No contracts to store');
    }

    // Check if node is registered
    const nodeStatus = await this.getNodeStatus();
    if (!nodeStatus.registered) {
      throw new Error('Node not registered. Please register your node first.');
    }

    // Verify contracts exist
    const validContracts = [];
    for (const contractId of contractIds) {
      const pointer = await this.api.get(`/api/cPointers/${contractId}`);
      if (!pointer) {
        throw new Error(`Contract not found: ${contractId}`);
      }
      validContracts.push(contractId);
    }

    if (!this.keychainAdapter || !this.keychainAdapter.isAvailable()) {
      throw new Error('Keychain/Signer not available');
    }

    const customJsonId = 'spk-store';
    const json = {
      items: validContracts,
      from: this.account.username,
    };

    try {
      const result = await this.keychainAdapter.broadcastCustomJson(
        this.account.username,
        customJsonId,
        'Active',
        json,
        `Store ${validContracts.length} contracts`
      );

      return {
        success: true,
        stored: validContracts,
        id: result.id,
      };
    } catch (error: any) {
      throw new Error(`Store files failed: ${error.message}`);
    }
  }

  /**
   * Remove files from storage (stop being a provider)
   * @param contractIds - Array of contract IDs to stop storing
   */
  async removeFiles(contractIds: string[]): Promise<{
    success: boolean;
    removed: string[];
    id: string;
  }> {
    if (!contractIds || contractIds.length === 0) {
      throw new Error('No files to remove');
    }

    // Verify contracts exist
    const validContracts = [];
    for (const contractId of contractIds) {
      const pointer = await this.api.get(`/api/cPointers/${contractId}`);
      if (pointer) {
        validContracts.push(contractId);
      }
    }

    if (validContracts.length === 0) {
      throw new Error('No valid contracts found to remove');
    }

    if (!this.keychainAdapter || !this.keychainAdapter.isAvailable()) {
      throw new Error('Keychain/Signer not available');
    }

    const customJsonId = 'spk-remove';
    const json = {
      items: validContracts,
      from: this.account.username,
    };

    try {
      const result = await this.keychainAdapter.broadcastCustomJson(
        this.account.username,
        customJsonId,
        'Active',
        json,
        `Remove ${validContracts.length} contracts from storage`
      );

      return {
        success: true,
        removed: validContracts,
        id: result.id,
      };
    } catch (error: any) {
      throw new Error(`Remove files failed: ${error.message}`);
    }
  }

  /**
   * Extend a storage contract with BROCA
   * @param contractId - Contract ID to extend
   * @param fileOwner - Owner of the file/contract
   * @param brocaAmount - Amount of BROCA to spend
   * @param power - Power level (optional, default 0)
   */
  async extendContract(
    contractId: string,
    fileOwner: string,
    brocaAmount: number,
    power: number = 0
  ): Promise<ExtendResult> {
    if (brocaAmount <= 0) {
      throw new Error('BROCA amount must be positive');
    }

    // Get contract details
    const contract = await this.api.get(`/api/contract/${fileOwner}/${contractId}`);
    if (!contract) {
      throw new Error('Contract not found');
    }

    if (contract.c !== 3) {
      throw new Error('Contract is not active');
    }

    // Get network stats for calculation
    const stats = await this.api.get('/stats');
    const channelBytes = stats?.channel_bytes || 1024;

    // Calculate extension
    const brocaPerTerm = Math.ceil((contract.u * contract.p) / (channelBytes * 3)) || 1;
    const blocksAdditional = Math.floor((brocaAmount / brocaPerTerm) * 28800 * 30);

    if (!this.keychainAdapter || !this.keychainAdapter.isAvailable()) {
      throw new Error('Keychain/Signer not available');
    }

    const customJsonId = 'spk-extend';
    const json = {
      id: contractId,
      file_owner: fileOwner,
      broca: brocaAmount,
      power,
      from: this.account.username,
    };

    try {
      const result = await this.keychainAdapter.broadcastCustomJson(
        this.account.username,
        customJsonId,
        'Active',
        json,
        `Extend contract ${contractId} with ${brocaAmount} BROCA`
      );

      return {
        success: true,
        id: result.id,
        contractId,
        extendedBy: blocksAdditional,
      };
    } catch (error: any) {
      throw new Error(`Extend contract failed: ${error.message}`);
    }
  }

  /**
   * Get node registration status
   */
  async getNodeStatus(): Promise<NodeStatus> {
    try {
      const services = await this.api.get(`/services/${this.account.username}/IPFS`);

      if (services && services.IPFS) {
        return {
          registered: true,
          service: 'IPFS',
          domain: services.IPFS.a,
          bidRate: services.IPFS.b,
          timestamp: services.IPFS.t,
        };
      }

      return { registered: false };
    } catch (error) {
      return { registered: false };
    }
  }

  /**
   * Get contracts being stored by this node
   */
  async getStoredContracts(): Promise<StorageContract[]> {
    const storing = await this.api.get(`/@${this.account.username}/storing`);

    if (!storing) {
      return [];
    }

    const contracts: StorageContract[] = [];

    for (const [contractId, contract] of Object.entries(storing)) {
      if (typeof contract === 'object' && contract !== null) {
        const typedContract = contract as any;

        // Check if this node is storing the contract
        let isStoring = false;
        let nodePosition = 0;

        if (typedContract.n) {
          for (const [pos, node] of Object.entries(typedContract.n)) {
            if (node === this.account.username) {
              isStoring = true;
              nodePosition = parseInt(pos);
              break;
            }
          }
        }

        contracts.push({
          id: contractId,
          owner: typedContract.t,
          size: typedContract.u || 0,
          providers: typedContract.p || 0,
          expiryBlock: parseInt(typedContract.e?.split(':')[0] || '0'),
          isStoring,
          nodePosition,
        });
      }
    }

    return contracts;
  }

  /**
   * Get available contracts to store (under-replicated)
   */
  async getAvailableContracts(limit: number = 100): Promise<StorageContract[]> {
    const contracts = await this.api.get(`/api/contracts/available?limit=${limit}`);

    if (!contracts) {
      return [];
    }

    return Object.entries(contracts).map(([id, contract]: [string, any]) => ({
      id,
      owner: contract.t,
      size: contract.u || 0,
      providers: Object.keys(contract.n || {}).length,
      expiryBlock: parseInt(contract.e?.split(':')[0] || '0'),
      isStoring: false,
      needed: contract.p - Object.keys(contract.n || {}).length,
    }));
  }

  /**
   * Batch store multiple contracts efficiently
   */
  async batchStore(
    contractIds: string[],
    chunkSize: number = 10
  ): Promise<{
    success: boolean;
    stored: string[];
    failed: string[];
    transactions: string[];
  }> {
    const stored: string[] = [];
    const failed: string[] = [];
    const transactions: string[] = [];

    // Process in chunks
    for (let i = 0; i < contractIds.length; i += chunkSize) {
      const chunk = contractIds.slice(i, i + chunkSize);

      try {
        const result = await this.storeFiles(chunk);
        stored.push(...result.stored);
        transactions.push(result.id);
      } catch (error) {
        console.error(`Failed to store chunk ${i / chunkSize + 1}:`, error);
        failed.push(...chunk);
      }

      // Rate limiting - wait between chunks
      if (i + chunkSize < contractIds.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    return {
      success: failed.length === 0,
      stored,
      failed,
      transactions,
    };
  }

  /**
   * Calculate potential earnings for storing a contract
   */
  calculateEarnings(
    contract: {
      size: number;
      providers: number;
      duration: number; // blocks
    },
    bidRate: number = 500
  ): {
    totalBroca: number;
    dailyBroca: number;
    monthlyBroca: number;
  } {
    // Simplified calculation - actual earnings depend on network factors
    const blocksPerDay = 28800;
    const daysInMonth = 30;

    const brocaPerBlock =
      (contract.size * bidRate) / (1024 * 1024 * contract.providers * blocksPerDay);
    const totalBroca = brocaPerBlock * contract.duration;
    const dailyBroca = brocaPerBlock * blocksPerDay;
    const monthlyBroca = dailyBroca * daysInMonth;

    return {
      totalBroca: Math.floor(totalBroca),
      dailyBroca: Math.floor(dailyBroca),
      monthlyBroca: Math.floor(monthlyBroca),
    };
  }
}
