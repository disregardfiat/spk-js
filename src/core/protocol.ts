/**
 * SPK Network Protocol Configuration
 * Fetched from protocol APIs and cached with validation
 */

export interface TokenProtocol {
  precision: number;
  jsonPrefix: string;
  multisig: string;
  features: Record<string, FeatureConfig>;
  api_health: {
    head_block: number;
    behind: number;
  };
}

export interface FeatureConfig {
  desc: string;
  json: Record<string, FieldConfig>;
  auth: 'posting' | 'active';
}

export interface FieldConfig {
  type: 'I' | 'S' | 'AS';  // Integer, String, Account String
  name: string;
  req?: boolean;
  check?: 'AC';  // Account Check
  min?: number;
  max?: number;
}

// Default protocol configurations (as of 2025-01-07)
export const DEFAULT_PROTOCOLS: Record<string, TokenProtocol> = {
  LARYNX: {
    precision: 3,
    jsonPrefix: 'spkccT_',
    multisig: 'spk-cc-test',
    features: {
      claim: {
        desc: 'Claim earned LARYNX rewards',
        json: {},
        auth: 'posting'
      },
      send: {
        desc: 'Send LARYNX tokens',
        json: {
          to: { type: 'AS', name: 'Send To', req: true, check: 'AC' },
          amount: { type: 'I', name: 'Amount', req: true, min: 1 },
          memo: { type: 'S', name: 'Memo' }
        },
        auth: 'active'
      },
      power_up: {
        desc: 'Power up LARYNX tokens',
        json: {
          amount: { type: 'I', name: 'Amount', req: true, min: 1 }
        },
        auth: 'active'
      },
      power_down: {
        desc: 'Power down LARYNX Power',
        json: {
          amount: { type: 'I', name: 'Amount', req: true, min: 1 }
        },
        auth: 'active'
      }
    },
    api_health: {
      head_block: 0,
      behind: 0
    }
  },
  SPK: {
    precision: 3,
    jsonPrefix: 'spkccT_spk_',
    multisig: 'spk-cc-test',
    features: {
      claim: {
        desc: 'Claim SPK Rewards',
        json: {},
        auth: 'posting'
      },
      send: {
        desc: 'Send SPK tokens',
        json: {
          to: { type: 'AS', name: 'Send To', req: true, check: 'AC' },
          amount: { type: 'I', name: 'Amount', req: true, min: 1 },
          memo: { type: 'S', name: 'Memo' }
        },
        auth: 'active'
      },
      power_up: {
        desc: 'Power up SPK tokens',
        json: {
          amount: { type: 'I', name: 'Amount', req: true, min: 1 }
        },
        auth: 'active'
      },
      power_down: {
        desc: 'Power down SPK Power',
        json: {
          amount: { type: 'I', name: 'Amount', req: true, min: 1 }
        },
        auth: 'active'
      },
      node_add: {
        desc: 'Register your account with the validator network',
        json: {
          id: { type: 'S', name: 'IPFS Identity', req: true },
          domain: { type: 'S', name: 'https://example.com', req: true },
          bidRate: { type: 'I', name: 'Starting Bid Rate (0-1000)', req: true, min: 0, max: 1000 },
          dm: { type: 'I', name: 'DecayMargin', req: true }
        },
        auth: 'active'
      }
    },
    api_health: {
      head_block: 0,
      behind: 0
    }
  },
  BROCA: {
    precision: 0,
    jsonPrefix: 'spkccT_broca_',
    multisig: 'spk-cc-test',
    features: {
      send: {
        desc: 'Send BROCA tokens',
        json: {
          to: { type: 'AS', name: 'Send To', req: true, check: 'AC' },
          amount: { type: 'I', name: 'Amount', req: true, min: 1 },
          memo: { type: 'S', name: 'Memo' }
        },
        auth: 'active'
      },
      power_up: {
        desc: 'Power up BROCA tokens',
        json: {
          amount: { type: 'I', name: 'Amount', req: true, min: 1 }
        },
        auth: 'active'
      }
    },
    api_health: {
      head_block: 0,
      behind: 0
    }
  }
};

export class ProtocolManager {
  private protocols: Map<string, TokenProtocol> = new Map();
  private node: string;
  private lastFetch: number = 0;
  private CACHE_DURATION = 3600000; // 1 hour

  constructor(node: string) {
    this.node = node;
    // Initialize with defaults
    Object.entries(DEFAULT_PROTOCOLS).forEach(([token, protocol]) => {
      this.protocols.set(token, protocol);
    });
  }

  /**
   * Fetch and update protocol configurations from the network
   */
  async updateProtocols(): Promise<void> {
    const now = Date.now();
    if (now - this.lastFetch < this.CACHE_DURATION) {
      return; // Use cached data
    }

    try {
      // Fetch all protocols in parallel
      const [larynxData, spkData, brocaData] = await Promise.all([
        this.fetchProtocol('/api/protocol'),
        this.fetchProtocol('/spk/api/protocol'),
        this.fetchProtocol('/broca/api/protocol')
      ]);

      // Update protocols if fetch was successful
      if (larynxData) this.updateProtocol('LARYNX', larynxData);
      if (spkData) this.updateProtocol('SPK', spkData);
      if (brocaData) this.updateProtocol('BROCA', brocaData);

      this.lastFetch = now;
    } catch (error) {
      console.warn('Failed to update protocols, using defaults:', error);
    }
  }

  private async fetchProtocol(endpoint: string): Promise<any> {
    try {
      const response = await fetch(`${this.node}${endpoint}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.warn(`Failed to fetch ${endpoint}:`, error);
      return null;
    }
  }

  private updateProtocol(token: string, data: any): void {
    const protocol = this.protocols.get(token);
    if (!protocol) return;

    // Update precision if available
    if (data.precision !== undefined) {
      protocol.precision = data.precision;
    }

    // Update multisig if available
    if (data.multisig) {
      protocol.multisig = data.multisig;
    }

    // Update API health
    if (data.api_health) {
      protocol.api_health = data.api_health;
    }

    // Update features if available
    if (data.features) {
      protocol.features = data.features;
    }

    // Extract json prefix from features
    if (data.json_prefix) {
      protocol.jsonPrefix = data.json_prefix;
    }
  }

  /**
   * Get protocol configuration for a token
   */
  getProtocol(token: string): TokenProtocol | undefined {
    return this.protocols.get(token.toUpperCase());
  }

  /**
   * Build a custom JSON ID from feature name
   */
  getCustomJsonId(token: string, feature: string): string {
    const protocol = this.getProtocol(token);
    if (!protocol) {
      throw new Error(`Unknown token: ${token}`);
    }
    return `${protocol.jsonPrefix}${feature}`;
  }

  /**
   * Format amount based on token precision
   */
  formatAmount(token: string, amount: number): string {
    const protocol = this.getProtocol(token);
    if (!protocol) {
      throw new Error(`Unknown token: ${token}`);
    }
    
    const divisor = Math.pow(10, protocol.precision);
    const formatted = (amount / divisor).toFixed(protocol.precision);
    
    return `${formatted} ${token}`;
  }

  /**
   * Parse amount from string (e.g., "50.000 BROCA")
   */
  parseAmount(amountStr: string): { amount: number; token: string } {
    const match = amountStr.match(/^([\d.]+)\s*([A-Z]+)$/);
    if (!match) {
      throw new Error(`Invalid amount format: ${amountStr}`);
    }

    const [, valueStr, token] = match;
    const protocol = this.getProtocol(token);
    if (!protocol) {
      throw new Error(`Unknown token: ${token}`);
    }

    const value = parseFloat(valueStr);
    const multiplier = Math.pow(10, protocol.precision);
    const amount = Math.round(value * multiplier);

    return { amount, token };
  }

  /**
   * Validate transaction fields
   */
  validateTransaction(token: string, feature: string, data: any): void {
    const protocol = this.getProtocol(token);
    if (!protocol) {
      throw new Error(`Unknown token: ${token}`);
    }

    const featureConfig = protocol.features[feature];
    if (!featureConfig) {
      throw new Error(`Unknown feature: ${feature} for token ${token}`);
    }

    // Check required fields
    for (const [field, config] of Object.entries(featureConfig.json)) {
      if (config.req && !data[field]) {
        throw new Error(`Missing required field: ${field}`);
      }

      if (data[field] !== undefined) {
        // Type validation
        if (config.type === 'I' && typeof data[field] !== 'number') {
          throw new Error(`Field ${field} must be a number`);
        }
        if ((config.type === 'S' || config.type === 'AS') && typeof data[field] !== 'string') {
          throw new Error(`Field ${field} must be a string`);
        }

        // Range validation
        if (config.min !== undefined && data[field] < config.min) {
          throw new Error(`Field ${field} must be at least ${config.min}`);
        }
        if (config.max !== undefined && data[field] > config.max) {
          throw new Error(`Field ${field} must be at most ${config.max}`);
        }
      }
    }
  }

  /**
   * Get auth type for a feature
   */
  getAuthType(token: string, feature: string): 'posting' | 'active' {
    const protocol = this.getProtocol(token);
    if (!protocol) {
      throw new Error(`Unknown token: ${token}`);
    }

    const featureConfig = protocol.features[feature];
    if (!featureConfig) {
      throw new Error(`Unknown feature: ${feature} for token ${token}`);
    }

    return featureConfig.auth;
  }
}