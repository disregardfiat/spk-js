/**
 * SPK Network Token Operations
 * Handles all token transactions using protocol configurations
 */

import { KeychainAdapter } from '../core/keychain-adapter';
import { SPKAPI } from '../core/api';
import { ProtocolManager } from '../core/protocol';

export interface TokenOperationResult {
  id: string;
  block?: number;
  success: boolean;
}

export class TokenOperations {
  private keychainAdapter: KeychainAdapter | null;
  private api: SPKAPI;
  private protocol: ProtocolManager;
  private username: string;

  constructor(
    username: string,
    keychainAdapter: KeychainAdapter | null,
    api: SPKAPI,
    protocol: ProtocolManager
  ) {
    this.username = username;
    this.keychainAdapter = keychainAdapter;
    this.api = api;
    this.protocol = protocol;
  }

  /**
   * Send any token using amount string format (e.g., "50.000 BROCA")
   */
  async send(amountStr: string, to: string, memo = ''): Promise<TokenOperationResult> {
    const { amount, token } = this.protocol.parseAmount(amountStr);
    
    switch (token) {
      case 'LARYNX':
        return this.sendLarynx(amount, to, memo);
      case 'SPK':
        return this.sendSpk(amount, to, memo);
      case 'BROCA':
        return this.sendBroca(amount, to, memo);
      default:
        throw new Error(`Unsupported token: ${token}`);
    }
  }

  /**
   * Send LARYNX tokens
   */
  async sendLarynx(amount: number, to: string, memo = ''): Promise<TokenOperationResult> {
    return this.executeTokenOperation('LARYNX', 'send', {
      to,
      amount,
      memo
    });
  }

  /**
   * Send SPK tokens
   */
  async sendSpk(amount: number, to: string, memo = ''): Promise<TokenOperationResult> {
    return this.executeTokenOperation('SPK', 'send', {
      to,
      amount,
      memo
    });
  }

  /**
   * Send BROCA tokens
   */
  async sendBroca(amount: number, to: string, memo = ''): Promise<TokenOperationResult> {
    return this.executeTokenOperation('BROCA', 'send', {
      to,
      amount,
      memo
    });
  }

  /**
   * Power up tokens
   */
  async powerUp(token: string, amount: number): Promise<TokenOperationResult> {
    if (!['LARYNX', 'SPK', 'BROCA'].includes(token.toUpperCase())) {
      throw new Error(`Power up not supported for token: ${token}`);
    }
    
    return this.executeTokenOperation(token.toUpperCase(), 'power_up', {
      amount
    });
  }

  /**
   * Power down tokens
   */
  async powerDown(token: string, amount: number): Promise<TokenOperationResult> {
    if (!['LARYNX', 'SPK'].includes(token.toUpperCase())) {
      throw new Error(`Power down not supported for token: ${token}`);
    }
    
    return this.executeTokenOperation(token.toUpperCase(), 'power_down', {
      amount
    });
  }

  /**
   * Claim rewards
   */
  async claim(token: string): Promise<TokenOperationResult> {
    if (!['LARYNX', 'SPK'].includes(token.toUpperCase())) {
      throw new Error(`Claim not supported for token: ${token}`);
    }
    
    return this.executeTokenOperation(token.toUpperCase(), 'claim', {});
  }

  /**
   * Register as SPK Network node
   */
  async registerNode(
    ipfsId: string, 
    domain: string, 
    bidRate: number, 
    decayMargin: number
  ): Promise<TokenOperationResult> {
    return this.executeTokenOperation('SPK', 'node_add', {
      id: ipfsId,
      domain,
      bidRate,
      dm: decayMargin
    });
  }

  /**
   * Execute a token operation
   */
  private async executeTokenOperation(
    token: string,
    feature: string,
    data: any
  ): Promise<TokenOperationResult> {
    if (!this.keychainAdapter || !this.keychainAdapter.isAvailable()) {
      throw new Error('Keychain/Signer not available');
    }

    // Validate transaction data
    this.protocol.validateTransaction(token, feature, data);

    // Check recipient exists for send operations
    if (feature === 'send' && data.to) {
      const recipient = await this.api.get(`/@${data.to}`).catch(() => null);
      if (!recipient) {
        throw new Error(`Invalid recipient account: ${data.to}`);
      }
    }

    // Get custom JSON ID and auth type
    const customJsonId = this.protocol.getCustomJsonId(token, feature);
    const authType = this.protocol.getAuthType(token, feature);
    
    // Build transaction JSON
    const json = {
      ...data,
      from: this.username
    };

    // Get token info for display message
    const amountDisplay = data.amount 
      ? this.protocol.formatAmount(token, data.amount) 
      : '';
    const displayMessage = this.buildDisplayMessage(token, feature, data, amountDisplay);

    try {
      const result = await this.keychainAdapter.broadcastCustomJson(
        this.username,
        customJsonId,
        authType === 'active' ? 'Active' : 'Posting',
        json,
        displayMessage
      );

      return {
        id: result.id,
        success: true
      };
    } catch (error: any) {
      throw new Error(`Token operation failed: ${error.message}`);
    }
  }

  /**
   * Build human-readable display message for transaction
   */
  private buildDisplayMessage(
    token: string, 
    feature: string, 
    data: any, 
    amountDisplay: string
  ): string {
    switch (feature) {
      case 'send':
        return `Send ${amountDisplay} to ${data.to}`;
      case 'power_up':
        return `Power up ${amountDisplay}`;
      case 'power_down':
        return `Power down ${amountDisplay}`;
      case 'claim':
        return `Claim ${token} rewards`;
      case 'node_add':
        return `Register SPK Network node`;
      default:
        return `${token} ${feature} operation`;
    }
  }

  /**
   * Check if account exists on chain
   */
  async checkAccount(account: string): Promise<boolean> {
    try {
      const data = await this.api.get(`/@${account}`);
      return !!data;
    } catch {
      return false;
    }
  }
}