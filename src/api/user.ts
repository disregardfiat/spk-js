import { HoneygraphClient, UserProfileOptions } from './honeygraph';

export interface UserBalances {
  larynx: number;
  spk: number;
  broca: number;
  liquidBroca: number;
  power: number;
  powerGranted: number;
}

export interface UserContract {
  id: string;
  status: string;
  expiresBlock: number;
  fileCount: number;
  utilized: number;
  power: number;
  metadata?: {
    autoRenew: boolean;
    encrypted: boolean;
  };
}

export interface StoringContract {
  id: string;
  owner: {
    username: string;
  };
  status: string;
  expiresBlock: number;
}

export interface UserService {
  id: string;
  type: string;
  endpoint: string;
  active: boolean;
  uptime: number;
}

export interface Delegation {
  to?: { username: string };
  from?: { username: string };
  amount: number;
  vestsPerDay: number;
}

export interface NodeMarket {
  bidRate: number;
  bidAmount: number;
  wins: number;
  attempts: number;
}

export interface DexOrder {
  id: string;
  pair: string;
  type: string;
  rate: number;
  amount: number;
  filled: number;
  status: string;
}

export interface UserFile {
  cid: string;
  name: string;
  size: number;
  path: string;
  tags?: string[];
  uploadedAt?: string;
}

export interface UserFilesOptions {
  limit?: number;
  path?: string;
  tags?: string[];
}

export interface UserSummary {
  username: string;
  balances: {
    larynx: number;
    spk: number;
    broca: number;
    power: number;
  };
  stats: {
    totalContracts: number;
    activeContracts: number;
    totalFiles: number;
    activeServices: number;
  };
}

export class UserAPI {
  private client: HoneygraphClient;

  constructor(client: HoneygraphClient) {
    this.client = client;
  }

  /**
   * Get complete user profile with all data
   */
  async getUserProfile(username: string, options?: UserProfileOptions): Promise<any> {
    return this.client.getUserProfile(username, options);
  }

  /**
   * Get user token balances
   */
  async getUserBalances(username: string): Promise<UserBalances> {
    const data = await this.client.getUserProfile(username, { include: ['balances'] });
    
    // Convert millitokens to tokens for LARYNX and SPK
    return {
      larynx: (data.larynxBalance || 0) / 1000,
      spk: (data.spkBalance || 0) / 1000,
      broca: data.brocaBalance || 0,  // BROCA is not in millitokens
      liquidBroca: data.liquidBroca || 0,
      power: (data.power || 0) / 1000,
      powerGranted: (data.powerGranted || 0) / 1000
    };
  }

  /**
   * Get user storage contracts
   */
  async getUserContracts(username: string): Promise<{ owned: UserContract[]; storing: StoringContract[] }> {
    const data = await this.client.getUserProfile(username, { include: ['contracts'] });
    
    return {
      owned: data.contracts || [],
      storing: data.contractsStoring || []
    };
  }

  /**
   * Get user registered services
   */
  async getUserServices(username: string): Promise<UserService[]> {
    const data = await this.client.getUserProfile(username, { include: ['services'] });
    return data.services || [];
  }

  /**
   * Get user delegations
   */
  async getUserDelegations(username: string): Promise<{ outgoing: Delegation[]; incoming: Delegation[] }> {
    const data = await this.client.getUserProfile(username, { include: ['delegations'] });
    
    return {
      outgoing: data.delegationsOut || [],
      incoming: data.delegationsIn || []
    };
  }

  /**
   * Get user market activity
   */
  async getUserMarketActivity(username: string): Promise<{ nodeMarket?: NodeMarket; dexOrders: DexOrder[] }> {
    const data = await this.client.getUserProfile(username, { include: ['market'] });
    
    return {
      nodeMarket: data.nodeMarket,
      dexOrders: data.dexOrders || []
    };
  }

  /**
   * Get user files
   */
  async getUserFiles(username: string, options?: UserFilesOptions): Promise<UserFile[]> {
    const data = await this.client.getUserProfile(username, { include: ['files'] });
    let files = data.files || [];

    // Apply client-side filters if needed
    if (options?.path) {
      files = files.filter((file: UserFile) => file.path.startsWith(options.path!));
    }

    if (options?.tags && options.tags.length > 0) {
      files = files.filter((file: UserFile) => 
        file.tags && options.tags!.some(tag => file.tags!.includes(tag))
      );
    }

    if (options?.limit) {
      files = files.slice(0, options.limit);
    }

    return files;
  }

  /**
   * Get a summary of user data
   */
  async getUserSummary(username: string): Promise<UserSummary> {
    const data = await this.client.getUserProfile(username);
    
    const activeContracts = (data.contracts || []).filter((c: any) => c.status === 'ACTIVE').length;
    const activeServices = (data.services || []).filter((s: any) => s.active).length;

    return {
      username: data.username,
      balances: {
        larynx: (data.larynxBalance || 0) / 1000,
        spk: (data.spkBalance || 0) / 1000,
        broca: data.brocaBalance || 0,
        power: (data.power || 0) / 1000
      },
      stats: {
        totalContracts: (data.contracts || []).length,
        activeContracts,
        totalFiles: (data.files || []).length,
        activeServices
      }
    };
  }
}