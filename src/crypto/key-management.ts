import { HiveAPI } from '../api';
import { HiveCrypto } from './hive-crypto';

export interface MemoKeyInfo {
  account: string;
  memoKey: string;
}

export interface EncryptionRequest {
  type: 'encrypt_memo';
  recipients: string[];
  keyData: {
    algorithm: string;
    key: string;
  };
}

export interface WalletEncryptionResponse {
  success: boolean;
  error?: string;
  encryptedKeys?: Array<{
    account: string;
    encryptedMemo: string;
  }>;
}

export class KeyManager {
  private memoKeyCache: Map<string, string> = new Map();

  /**
   * Fetch memo keys for multiple accounts from Hive blockchain
   */
  async fetchMemoKeys(accounts: string[]): Promise<MemoKeyInfo[]> {
    const uncachedAccounts = accounts.filter(acc => !this.memoKeyCache.has(acc));
    
    if (uncachedAccounts.length > 0) {
      try {
        const hiveAccounts = await HiveAPI.getAccounts(uncachedAccounts);
        
        // Cache the results
        for (const account of hiveAccounts) {
          if (account && account.memo_key) {
            this.memoKeyCache.set(account.name, account.memo_key);
          }
        }
      } catch (error) {
        console.error('Failed to fetch accounts from Hive:', error);
      }
    }
    
    // Return all requested accounts that we have keys for
    return accounts
      .filter(acc => this.memoKeyCache.has(acc))
      .map(acc => ({
        account: acc,
        memoKey: this.memoKeyCache.get(acc)!
      }));
  }

  /**
   * Convert a Hive memo public key to a Web Crypto key
   */
  async hiveMemoKeyToCryptoKey(hiveMemoKey: string): Promise<CryptoKey> {
    return HiveCrypto.hivePubKeyToWebCrypto(hiveMemoKey);
  }

  /**
   * Prepare an encryption request for wallet signing
   */
  async prepareEncryptionRequest(
    aesKey: CryptoKey,
    recipients: MemoKeyInfo[]
  ): Promise<EncryptionRequest> {
    // Export the AES key
    const rawKey = await crypto.subtle.exportKey('raw', aesKey);
    const keyData = Buffer.from(rawKey).toString('base64');
    
    return {
      type: 'encrypt_memo',
      recipients: recipients.map(r => r.account),
      keyData: {
        algorithm: 'AES-256-GCM',
        key: keyData
      }
    };
  }

  /**
   * Process the wallet's encryption response
   */
  processWalletEncryptionResponse(
    response: WalletEncryptionResponse
  ): Array<{ account: string; encryptedKey: string }> {
    if (!response.success) {
      throw new Error(`Wallet encryption failed: ${response.error || 'Unknown error'}`);
    }
    
    if (!response.encryptedKeys) {
      throw new Error('No encrypted keys in wallet response');
    }
    
    return response.encryptedKeys.map(item => ({
      account: item.account,
      encryptedKey: item.encryptedMemo
    }));
  }

  /**
   * Clear the memo key cache
   */
  clearCache(): void {
    this.memoKeyCache.clear();
  }
}