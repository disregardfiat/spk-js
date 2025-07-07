import { SPKAPI, AuthHeaders } from './api';
import { mergeConfig, SPKConfig } from './config';
import { KeychainAdapter } from './keychain-adapter';
import { ProtocolManager } from './protocol';

/**
 * SPK Network account management
 */
export class SPKAccount {
  public username: string;
  public node: string;
  public api: SPKAPI;
  public hasKeychain: boolean = false;
  
  // Account data
  public balance: number = 0;
  public spk: number = 0;
  public broca: string = '0,0';
  public poweredUp: number = 0;
  public pubKey: string = 'NA';
  public contracts: any[] = [];
  public file_contracts: Record<string, any> = {};
  public spk_power: number = 0;
  public head_block: number = 0;
  public liq_broca: number = 0;
  public pow_broca: number = 0;
  
  // Additional properties from dlux-iov
  public gov: number = 0;
  public spk_block: number = 0;
  public granted: { t: number } = { t: 0 };
  public granting: { t: number } = { t: 0 };
  public pow: number = 0;
  public power_downs: Record<string, any> = {};
  public drop: { last_claim: number; availible: { amount: number } } = {
    last_claim: 0,
    availible: { amount: 0 }
  };
  public claim: number = 0;
  public tick: number = 0.01;
  public behind: number = 0;

  public keychainAdapter: KeychainAdapter | null = null;
  private protocol: ProtocolManager;

  constructor(username: string, options: Partial<SPKConfig> = {}) {
    const config = mergeConfig(options);
    this.username = username;
    this.node = config.node;
    this.api = new SPKAPI(config.node, config.timeout, config.maxRetries);
    this.protocol = new ProtocolManager(config.node);
    
    if (config.keychain) {
      this.keychainAdapter = new KeychainAdapter(config.keychain);
      this.hasKeychain = true;
    }
  }

  async init(): Promise<void> {
    try {
      // Check for Hive Keychain if no adapter was provided
      if (!this.keychainAdapter && typeof window !== 'undefined' && (window as any).hive_keychain) {
        this.keychainAdapter = new KeychainAdapter((window as any).hive_keychain);
        this.hasKeychain = true;
      }

      // Update protocol configurations
      await this.protocol.updateProtocols();

      // Load account data
      const accountData = await this.api.get(`/@${this.username}`);
      
      if (!accountData) {
        throw new Error('Account not found');
      }

      // Update account properties
      Object.assign(this, accountData);
    } catch (error: any) {
      throw new Error(`Failed to initialize account: ${error.message}`);
    }
  }

  async getBalances(refresh = false): Promise<{ larynx: number; spk: number; broca: number }> {
    if (refresh) {
      await this.refresh();
    }

    const brocaAmount = await this.calculateBroca();

    return {
      larynx: this.balance,
      spk: this.spk,
      broca: brocaAmount,
    };
  }

  /**
   * Get BROCA storage capacity in human-readable format
   */
  async getBrocaStorage(): Promise<string> {
    try {
      const brocaCredits = await this.calculateBroca();
      const stats = await this.api.get('/stats');
      const channelBytes = stats?.channel_bytes || 1024; // Default to 1KB per BROCA
      
      // BROCA credits * channel_bytes = total bytes available
      const totalBytes = brocaCredits * channelBytes;
      
      // Format as human-readable size
      if (totalBytes < 1024) {
        return `${totalBytes}B`;
      } else if (totalBytes < 1024 * 1024) {
        const kb = totalBytes / 1024;
        return `${kb.toFixed(2)}KB`;
      } else if (totalBytes < 1024 * 1024 * 1024) {
        const mb = totalBytes / (1024 * 1024);
        return `${mb.toFixed(2)}MB`;
      } else {
        const gb = totalBytes / (1024 * 1024 * 1024);
        return `${gb.toFixed(2)}GB`;
      }
    } catch (error) {
      console.warn('Failed to calculate BROCA storage:', error);
      return '0MB';
    }
  }

  async refresh(): Promise<any> {
    const data = await this.api.get(`/@${this.username}`);
    Object.assign(this, data);
    return data;
  }

  /**
   * Get SPK token user data (similar to getTokenUser from dlux-iov)
   * This fetches basic SPK account data
   */
  async getTokenUser(user: string = this.username): Promise<any> {
    try {
      const data = await this.api.get(`/@${user}`);
      data.tick = data.tick || 0.01;
      
      if (user === this.username) {
        // Update instance properties
        this.behind = data.behind;
        this.balance = data.balance;
        this.gov = data.gov;
        this.poweredUp = data.poweredUp;
        this.claim = data.claim;
        this.spk = data.spk;
        this.spk_power = data.spk_power;
        this.broca = data.broca || '0,0';
        this.head_block = data.head_block;
        Object.assign(this, data);
      }
      
      return data;
    } catch (error: any) {
      throw new Error(`Failed to get token user: ${error.message}`);
    }
  }

  /**
   * Get complete SPK API data including calculated rewards
   * This is the SPK-specific version of getSapi from dlux-iov
   */
  async getSpkApi(user: string = this.username): Promise<any> {
    try {
      const data = await this.api.get(`/@${user}`);
      data.tick = data.tick || 0.01;
      
      if (user === this.username) {
        // Process power downs
        data.powerDowns = Object.keys(data.power_downs || {});
        for (let i = 0; i < data.powerDowns.length; i++) {
          data.powerDowns[i] = data.powerDowns[i].split(':')[0];
        }
        
        // Update instance with all data
        Object.assign(this, data);
        
        // Pending rewards calculation removed
        
        // Ensure granted and granting have default values
        if (!this.granted.t) this.granted.t = 0;
        if (!this.granting.t) this.granting.t = 0;
      }
      
      return data;
    } catch (error: any) {
      throw new Error(`Failed to get SPK API data: ${error.message}`);
    }
  }


  async calculateBroca(currentBlock?: number): Promise<number> {
    if (!currentBlock) currentBlock = this.head_block;
    
    // Import and use the proper broca_calc method
    const { broca_calc } = await import('../wallet/calculations');
    
    // Default broca_refill value from dlux-iov
    const broca_refill = 144000;
    
    // Use pow_broca (BROCA Power) for the calculation
    return broca_calc(this.broca, broca_refill, this.pow_broca, currentBlock);
  }

  async sendLarynx(amount: number, to: string, memo = ''): Promise<any> {
    if (!this.keychainAdapter || !this.keychainAdapter.isAvailable()) {
      throw new Error('Keychain/Signer not available');
    }

    if (amount > this.balance) {
      throw new Error('Insufficient balance');
    }

    // Check if recipient exists
    const recipient = await this.api.get(`/@${to}`).catch(() => null);
    if (!recipient) {
      throw new Error('Invalid recipient account');
    }

    const json = {
      from: this.username,
      to,
      amount,
      memo,
    };

    const customJsonId = this.protocol.getCustomJsonId('LARYNX', 'send');
    const amountDisplay = this.protocol.formatAmount('LARYNX', amount);
    
    return this.keychainAdapter.broadcastCustomJson(
      this.username,
      customJsonId,
      'Active',
      json,
      `Send ${amountDisplay} to ${to}`
    );
  }

  async sendSpk(amount: number, to: string, memo = ''): Promise<any> {
    if (!this.keychainAdapter || !this.keychainAdapter.isAvailable()) {
      throw new Error('Keychain/Signer not available');
    }

    if (amount > this.spk) {
      throw new Error('Insufficient balance');
    }

    const json = {
      from: this.username,
      to,
      amount,
      memo,
    };

    const customJsonId = this.protocol.getCustomJsonId('SPK', 'send');
    const amountDisplay = this.protocol.formatAmount('SPK', amount);
    
    return this.keychainAdapter.broadcastCustomJson(
      this.username,
      customJsonId,
      'Active',
      json,
      `Send ${amountDisplay} to ${to}`
    );
  }

  async powerUp(amount: number): Promise<any> {
    if (!this.keychainAdapter || !this.keychainAdapter.isAvailable()) {
      throw new Error('Keychain/Signer not available');
    }

    if (amount > this.balance) {
      throw new Error('Insufficient balance');
    }

    const json = {
      from: this.username,
      amount,
    };

    const customJsonId = this.protocol.getCustomJsonId('LARYNX', 'power_up');
    const amountDisplay = this.protocol.formatAmount('LARYNX', amount);
    
    return this.keychainAdapter.broadcastCustomJson(
      this.username,
      customJsonId,
      'Active',
      json,
      `Power up ${amountDisplay}`
    );
  }

  async powerDown(amount: number): Promise<any> {
    if (!this.keychainAdapter || !this.keychainAdapter.isAvailable()) {
      throw new Error('Keychain/Signer not available');
    }

    const json = {
      from: this.username,
      amount,
    };

    const customJsonId = this.protocol.getCustomJsonId('LARYNX', 'power_down');
    const amountDisplay = this.protocol.formatAmount('LARYNX', amount);
    
    return this.keychainAdapter.broadcastCustomJson(
      this.username,
      customJsonId,
      'Active',
      json,
      `Power down ${amountDisplay}`
    );
  }

  async registerPublicKey(): Promise<void> {
    if (this.pubKey !== 'NA') return;

    if (!this.keychainAdapter || !this.keychainAdapter.isAvailable()) {
      throw new Error('Keychain/Signer not available');
    }

    const timestamp = Date.now().toString();
    const message = `${timestamp}:register:${this.username}`;

    try {
      const { signature, publicKey } = await this.keychainAdapter.sign(
        this.username,
        message,
        'Posting'
      );

      const auth: AuthHeaders = {
        account: this.username,
        signature,
        timestamp,
      };

      await this.api.post(
        '/api/register',
        {
          account: this.username,
          pubKey: publicKey,
        },
        auth
      );

      this.pubKey = publicKey || 'NA';
    } catch (error: any) {
      throw new Error(`Failed to register public key: ${error.message}`);
    }
  }

  async sign(message: string, keyType = 'Posting'): Promise<AuthHeaders> {
    if (!this.keychainAdapter || !this.keychainAdapter.isAvailable()) {
      throw new Error('Keychain/Signer not available');
    }

    const timestamp = Date.now().toString();
    const fullMessage = `${timestamp}:${message}`;

    try {
      const { signature } = await this.keychainAdapter.sign(
        this.username,
        fullMessage,
        keyType
      );

      return {
        account: this.username,
        signature,
        timestamp,
      };
    } catch (error: any) {
      throw new Error(`Failed to sign message: ${error.message}`);
    }
  }
}