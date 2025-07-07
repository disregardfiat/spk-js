import { SPKAPI, AuthHeaders } from './api';
import { mergeConfig, SPKConfig } from './config';

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

  private keychain: any = null;

  constructor(username: string, options: Partial<SPKConfig> = {}) {
    const config = mergeConfig(options);
    this.username = username;
    this.node = config.node;
    this.api = new SPKAPI(config.node, config.timeout, config.maxRetries);
    
    if (config.keychain) {
      this.keychain = config.keychain;
      this.hasKeychain = true;
    }
  }

  async init(): Promise<void> {
    try {
      // Check for Hive Keychain
      if (!this.keychain && typeof window !== 'undefined' && (window as any).hive_keychain) {
        this.keychain = (window as any).hive_keychain;
        this.hasKeychain = true;
      }

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
        
        // Calculate pending rewards
        const { calculateSpkReward } = await import('../wallet/calculations');
        const stats = await this.api.get('/stats');
        this.spk += calculateSpkReward(this, stats);
        
        // Ensure granted and granting have default values
        if (!this.granted.t) this.granted.t = 0;
        if (!this.granting.t) this.granting.t = 0;
      }
      
      return data;
    } catch (error: any) {
      throw new Error(`Failed to get SPK API data: ${error.message}`);
    }
  }

  private parseBroca(): number {
    if (!this.broca || typeof this.broca !== 'string') return 0;
    const parts = this.broca.split(',');
    return parseInt(parts[0]) || 0;
  }

  async calculateBroca(currentBlock?: number): Promise<number> {
    if (!currentBlock) currentBlock = this.head_block;
    
    // Import and use the proper broca_calc method
    const { broca_calc } = await import('../wallet/calculations');
    
    // Default broca_refill value from dlux-iov
    const broca_refill = 144000;
    
    return broca_calc(this.broca, broca_refill, this.spk_power, currentBlock);
  }

  async sendLarynx(amount: number, to: string, memo = ''): Promise<any> {
    if (!this.hasKeychain) {
      throw new Error('Hive Keychain not available');
    }

    if (amount > this.balance) {
      throw new Error('Insufficient balance');
    }

    // Check if recipient exists
    const recipient = await this.api.get(`/@${to}`).catch(() => null);
    if (!recipient) {
      throw new Error('Invalid recipient account');
    }

    const json = JSON.stringify({
      from: this.username,
      to,
      amount,
      memo,
    });

    return new Promise((resolve, reject) => {
      this.keychain.requestCustomJson(
        this.username,
        'spkcc_send',
        'Active',
        json,
        `Send ${amount} LARYNX to ${to}`,
        (response: any) => {
          if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response);
          }
        }
      );
    });
  }

  async sendSpk(amount: number, to: string, memo = ''): Promise<any> {
    if (!this.hasKeychain) {
      throw new Error('Hive Keychain not available');
    }

    if (amount > this.spk) {
      throw new Error('Insufficient balance');
    }

    const json = JSON.stringify({
      from: this.username,
      to,
      amount,
      memo,
    });

    return new Promise((resolve, reject) => {
      this.keychain.requestCustomJson(
        this.username,
        'spkcc_spk_send',
        'Active',
        json,
        `Send ${amount} SPK to ${to}`,
        (response: any) => {
          if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response);
          }
        }
      );
    });
  }

  async powerUp(amount: number): Promise<any> {
    if (!this.hasKeychain) {
      throw new Error('Hive Keychain not available');
    }

    if (amount > this.balance) {
      throw new Error('Insufficient balance');
    }

    const json = JSON.stringify({
      from: this.username,
      amount,
    });

    return new Promise((resolve, reject) => {
      this.keychain.requestCustomJson(
        this.username,
        'spkcc_power_up',
        'Active',
        json,
        `Power up ${amount} LARYNX`,
        (response: any) => {
          if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response);
          }
        }
      );
    });
  }

  async powerDown(amount: number): Promise<any> {
    if (!this.hasKeychain) {
      throw new Error('Hive Keychain not available');
    }

    const json = JSON.stringify({
      from: this.username,
      amount,
    });

    return new Promise((resolve, reject) => {
      this.keychain.requestCustomJson(
        this.username,
        'spkcc_power_down',
        'Active',
        json,
        `Power down ${amount} LARYNX`,
        (response: any) => {
          if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response);
          }
        }
      );
    });
  }

  async registerPublicKey(): Promise<void> {
    if (this.pubKey !== 'NA') return;

    if (!this.hasKeychain) {
      throw new Error('Hive Keychain not available');
    }

    const timestamp = Date.now().toString();
    const message = `${timestamp}:register:${this.username}`;

    return new Promise((resolve, reject) => {
      this.keychain.requestSignBuffer(
        this.username,
        message,
        'Posting',
        (response: any) => {
          if (response.error) {
            reject(new Error(response.error));
          } else {
            const auth: AuthHeaders = {
              account: this.username,
              signature: response.signature,
              timestamp,
            };

            this.api.post(
              '/api/register',
              {
                account: this.username,
                pubKey: response.publicKey,
              },
              auth
            ).then(() => {
              this.pubKey = response.publicKey;
              resolve();
            }).catch(reject);
          }
        }
      );
    });
  }

  async sign(message: string, keyType = 'Posting'): Promise<AuthHeaders> {
    if (!this.hasKeychain) {
      throw new Error('Hive Keychain not available');
    }

    const timestamp = Date.now().toString();
    const fullMessage = `${timestamp}:${message}`;

    return new Promise((resolve, reject) => {
      this.keychain.requestSignBuffer(
        this.username,
        fullMessage,
        keyType,
        (response: any) => {
          if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve({
              account: this.username,
              signature: response.signature,
              timestamp,
            });
          }
        }
      );
    });
  }
}