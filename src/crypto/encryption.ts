import { KeyManager } from './key-management';

export interface EncryptedFile {
  encryptedData: ArrayBuffer;
  iv: Uint8Array;
  originalName: string;
  originalType: string;
  originalSize: number;
}

export interface EncryptionMetadata {
  encrypted: boolean;
  algorithm: string;
  recipients: string[];
  originalName: string;
  originalType: string;
  encryptedKeys: Array<{
    account: string;
    encryptedKey: string;
  }>;
  iv?: string; // Base64 encoded IV
}

export interface EncryptedUploadResult {
  encryptedFile: File;
  metadata: EncryptionMetadata;
}

export class Encryption {
  constructor(
    private keyManager: KeyManager,
    private account?: string
  ) {}

  private get crypto() {
    const cryptoLib = typeof globalThis !== 'undefined' && globalThis.crypto 
      ? globalThis.crypto 
      : typeof global !== 'undefined' && (global as any).crypto 
      ? (global as any).crypto 
      : null;

    if (!cryptoLib || !cryptoLib.subtle) {
      throw new Error('Web Crypto API not available');
    }
    return cryptoLib;
  }

  /**
   * Generate a random AES-256 key for file encryption
   */
  async generateAESKey(): Promise<CryptoKey> {
    return await this.crypto.subtle.generateKey(
      {
        name: 'AES-GCM',
        length: 256
      },
      true, // extractable
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encrypt a file using AES-GCM
   */
  async encryptFile(file: File, key: CryptoKey): Promise<EncryptedFile> {
    // Generate a random IV for GCM
    const iv = this.crypto.getRandomValues(new Uint8Array(12));
    
    // Read file data
    const fileData = await file.arrayBuffer();
    
    // Encrypt the data
    const encryptedData = await this.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      key,
      fileData
    );
    
    return {
      encryptedData,
      iv,
      originalName: file.name,
      originalType: file.type,
      originalSize: file.size
    };
  }

  /**
   * Decrypt an encrypted file
   */
  async decryptFile(encrypted: EncryptedFile, key: CryptoKey): Promise<File> {
    const decryptedData = await this.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: encrypted.iv
      },
      key,
      encrypted.encryptedData
    );
    
    return new File([decryptedData], encrypted.originalName, {
      type: encrypted.originalType
    });
  }

  /**
   * Wrap AES key for multiple recipients
   */
  async wrapKeyForRecipients(
    aesKey: CryptoKey,
    recipients: Array<{ account: string; memoKey: string }>
  ): Promise<Array<{ account: string; encryptedKey: string; algorithm: string }>> {
    const wrappedKeys = [];
    
    // Export the AES key to raw format
    const rawKey = await this.crypto.subtle.exportKey('raw', aesKey);
    const keyData = Buffer.from(rawKey).toString('base64');
    
    for (const recipient of recipients) {
      // For now, we'll use the wallet interface to encrypt the key
      // In a real implementation, this would use RSA-OAEP or similar
      wrappedKeys.push({
        account: recipient.account,
        encryptedKey: `#mock-encrypted-${keyData}-for-${recipient.account}`,
        algorithm: 'RSA-OAEP'
      });
    }
    
    return wrappedKeys;
  }

  /**
   * Main method to encrypt a file for upload with multiple recipients
   * Uses multi-sig encryption when available for efficiency
   */
  async encryptForUpload(file: File, recipientAccounts: string[]): Promise<EncryptedUploadResult> {
    // Import wallet encryption
    const { walletEncryption } = await import('../wallet/encryption');
    
    // Generate AES key for this batch of files
    const aesKey = await this.generateAESKey();
    
    // Ensure signer is included in recipients (so they can decrypt their own files)
    const signerAccount = this.account || 'self';
    const allRecipients = recipientAccounts.includes(signerAccount) 
      ? recipientAccounts 
      : [...recipientAccounts, signerAccount];
    
    // Fetch memo keys for recipients
    await this.keyManager.fetchMemoKeys(allRecipients);
    
    // Encrypt the file
    const encrypted = await this.encryptFile(file, aesKey);
    
    // Export AES key for encryption
    const rawKey = await this.crypto.subtle.exportKey('raw', aesKey);
    const keyData = Buffer.from(rawKey).toString('base64');
    
    // Use wallet to encrypt the AES key for all recipients
    // This will use multi-sig if available
    const encryptedKeys = await walletEncryption.encryptForMultipleRecipients(
      signerAccount,
      allRecipients,
      keyData
    );
    
    // Create encrypted file with IV prepended
    const fileContent = new Uint8Array(encrypted.iv.length + encrypted.encryptedData.byteLength);
    fileContent.set(encrypted.iv, 0);
    fileContent.set(new Uint8Array(encrypted.encryptedData), encrypted.iv.length);
    
    const encryptedFile = new File([fileContent], `${file.name}.enc`, {
      type: 'application/octet-stream'
    });
    
    // Store metadata
    const metadata: EncryptionMetadata = {
      encrypted: true,
      algorithm: 'AES-256-GCM',
      recipients: allRecipients,
      originalName: encrypted.originalName,
      originalType: encrypted.originalType,
      encryptedKeys: encryptedKeys,
      iv: Buffer.from(encrypted.iv).toString('base64')
    };
    
    return {
      encryptedFile,
      metadata
    };
  }

  /**
   * Generate metadata string for storage
   * This is what gets stored on-chain or with the file
   */
  static generateMetadataString(metadata: EncryptionMetadata): string {
    // Create a compact representation of the metadata
    const compactMetadata = {
      e: 1, // encrypted flag (1 = true)
      a: metadata.algorithm,
      r: metadata.recipients,
      n: metadata.originalName,
      t: metadata.originalType,
      k: metadata.encryptedKeys.reduce((acc, item) => {
        acc[item.account] = item.encryptedKey;
        return acc;
      }, {} as Record<string, string>),
      iv: metadata.iv
    };
    
    // Convert to base64 encoded JSON string
    return Buffer.from(JSON.stringify(compactMetadata)).toString('base64');
  }

  /**
   * Parse metadata string back to metadata object
   */
  static parseMetadataString(metadataString: string): EncryptionMetadata {
    try {
      const decoded = Buffer.from(metadataString, 'base64').toString('utf-8');
      const compact = JSON.parse(decoded);
      
      return {
        encrypted: compact.e === 1,
        algorithm: compact.a,
        recipients: compact.r,
        originalName: compact.n,
        originalType: compact.t,
        encryptedKeys: Object.entries(compact.k).map(([account, encryptedKey]) => ({
          account,
          encryptedKey: encryptedKey as string
        })),
        iv: compact.iv
      };
    } catch (error) {
      throw new Error('Invalid metadata string format');
    }
  }
}