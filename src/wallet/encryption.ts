/**
 * Wallet encryption interface for Hive Keychain and custom wallet implementations
 */

import { HiveCrypto } from '../crypto/hive-crypto';

export interface EncryptionRequestUI {
  title: string;
  message: string;
  recipients: string[];
  requiresConfirmation: boolean;
}

export interface FileInfo {
  name: string;
  size: number;
  type: string;
}

export class WalletEncryption {
  /**
   * Check if Hive Keychain is available
   */
  isKeychainAvailable(): boolean {
    return typeof window !== 'undefined' && 
           window.hive_keychain !== undefined;
  }

  /**
   * Encrypt memo using Hive Keychain (async)
   * Supports single recipient
   */
  async encryptMemoKeychain(
    account: string,
    recipient: string,
    memo: string
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.isKeychainAvailable()) {
        reject(new Error('Hive Keychain not available'));
        return;
      }

      window.hive_keychain!.requestEncryptMemo(
        account,
        recipient,
        memo,
        (response: any) => {
          if (response.success) {
            resolve(response.result);
          } else {
            reject(new Error(`Keychain encryption failed: ${response.error || 'Unknown error'}`));
          }
        }
      );
    });
  }

  /**
   * Encrypt memo using Hive Keychain multi-sig (async)
   * Encrypts the same message for multiple recipients in a single operation
   */
  async encryptMemoKeychainMultiSig(
    account: string,
    recipients: string[],
    memo: string
  ): Promise<Array<{ account: string; encryptedKey: string }>> {
    return new Promise((resolve, reject) => {
      if (!this.isKeychainAvailable()) {
        reject(new Error('Hive Keychain not available'));
        return;
      }

      if (recipients.length === 0) {
        resolve([]);
        return;
      }

      // Try multi-sig encryption first (passing array of recipients)
      window.hive_keychain!.requestEncryptMemo(
        account,
        recipients, // Pass array for multi-sig
        memo,
        (response: any) => {
          if (response.success && Array.isArray(response.result)) {
            // Multi-sig succeeded, map results
            const results = recipients.map((recipient, index) => ({
              account: recipient,
              encryptedKey: response.result[index]
            }));
            resolve(results);
          } else {
            // Multi-sig failed or not supported
            reject(new Error(response.error || 'Multi-sig encryption not supported'));
          }
        }
      );
    });
  }

  /**
   * Encrypt memo synchronously for custom wallet implementations
   */
  encryptMemoSync(
    privateKey: string,
    recipientPublicKey: string,
    message: string
  ): string {
    return HiveCrypto.encryptMemo(privateKey, recipientPublicKey, message);
  }

  /**
   * Decrypt memo synchronously for custom wallet implementations
   */
  decryptMemoSync(
    privateKey: string,
    encryptedMemo: string
  ): string {
    return HiveCrypto.decryptMemo(privateKey, encryptedMemo);
  }

  /**
   * Encrypt for multiple recipients using Keychain or custom wallet
   * Uses multi-sig when available, falls back to individual encryption
   */
  async encryptForMultipleRecipients(
    account: string,
    recipients: string[],
    message: string
  ): Promise<Array<{ account: string; encryptedKey: string }>> {
    // Try multi-sig first if Keychain is available
    if (this.isKeychainAvailable()) {
      try {
        return await this.encryptMemoKeychainMultiSig(account, recipients, message);
      } catch (error) {
        console.warn('Multi-sig encryption failed, falling back to individual encryption:', error);
        // Fall through to individual encryption below
      }
    }
    
    // Fallback to individual encryption
    const results = [];
    for (const recipient of recipients) {
      try {
        const encryptedKey = await this.encryptMemoKeychain(account, recipient, message);
        results.push({
          account: recipient,
          encryptedKey
        });
      } catch (error) {
        console.warn(`Failed to encrypt for ${recipient}:`, error);
        // Continue with other recipients
      }
    }
    
    return results;
  }

  /**
   * Encrypt for multiple recipients synchronously (custom wallet)
   * This mirrors the multi-sig functionality for custom wallets
   */
  encryptMemoSyncMultiSig(
    privateKey: string,
    recipients: Array<{ account: string; publicKey: string }>,
    message: string
  ): Array<{ account: string; encryptedKey: string }> {
    const results = [];
    
    for (const recipient of recipients) {
      try {
        const encryptedKey = this.encryptMemoSync(privateKey, recipient.publicKey, message);
        results.push({
          account: recipient.account,
          encryptedKey
        });
      } catch (error) {
        console.warn(`Failed to encrypt for ${recipient.account}:`, error);
        // Continue with other recipients
      }
    }
    
    return results;
  }

  /**
   * Prepare encryption request UI for user confirmation
   */
  prepareEncryptionRequestUI(
    recipients: string[],
    fileInfo: FileInfo
  ): EncryptionRequestUI {
    const fileSizeMB = (fileInfo.size / (1024 * 1024)).toFixed(2);
    
    return {
      title: 'Encrypt File',
      message: `You are about to encrypt "${fileInfo.name}" (${fileSizeMB} MB) for the following recipients: ${recipients.join(', ')}`,
      recipients,
      requiresConfirmation: true
    };
  }

}

// Export singleton instance
export const walletEncryption = new WalletEncryption();