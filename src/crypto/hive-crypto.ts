/**
 * Hive blockchain cryptography utilities
 * Handles conversion between Hive keys and Web Crypto API keys
 */

import { Buffer } from 'buffer';

export class HiveCrypto {
  /**
   * Convert a Hive public key (base58) to a format suitable for encryption
   * Note: This is a simplified implementation. In production, you would need
   * to properly decode the Hive key format and convert to appropriate crypto key.
   */
  static async hivePubKeyToWebCrypto(hivePubKey: string): Promise<CryptoKey> {
    if (!hivePubKey.startsWith('STM')) {
      throw new Error('Invalid Hive public key format');
    }

    // In a real implementation, you would:
    // 1. Decode the base58 key
    // 2. Extract the actual public key bytes
    // 3. Import as an appropriate key type
    
    // For now, we'll create a dummy RSA key for testing
    // In production, Hive uses secp256k1 which would need conversion
    const keyData = {
      kty: 'RSA',
      e: 'AQAB',
      n: 'mock-key-data-' + hivePubKey,
      alg: 'RSA-OAEP-256',
      ext: true,
      key_ops: ['encrypt', 'wrapKey']
    };

    return crypto.subtle.importKey(
      'jwk',
      keyData as any,
      {
        name: 'RSA-OAEP',
        hash: 'SHA-256'
      },
      false,
      ['encrypt', 'wrapKey']
    );
  }

  /**
   * Encrypt data using Hive memo format
   * In production, this would use the same encryption as Hive memo fields
   */
  static encryptMemo(privateKey: string, publicKey: string, message: string): string {
    // Real implementation would:
    // 1. Derive shared secret using ECDH
    // 2. Encrypt message with AES using shared secret
    // 3. Format as Hive memo (starts with #)
    
    const timestamp = Date.now();
    const nonce = Math.random().toString(36).substring(2, 15);
    const encoded = Buffer.from(JSON.stringify({
      msg: message,
      from: privateKey.substring(0, 10),
      to: publicKey.substring(0, 10),
      ts: timestamp,
      nonce
    })).toString('base64');
    
    return `#${encoded}`;
  }

  /**
   * Decrypt Hive memo format
   */
  static decryptMemo(_privateKey: string, encryptedMemo: string): string {
    if (!encryptedMemo.startsWith('#')) {
      throw new Error('Invalid encrypted memo format');
    }

    try {
      const decoded = Buffer.from(encryptedMemo.substring(1), 'base64').toString('utf-8');
      const data = JSON.parse(decoded);
      return data.msg;
    } catch (error) {
      throw new Error('Failed to decrypt memo');
    }
  }

  /**
   * Generate a shared secret for memo encryption
   * Used for deriving encryption keys between two Hive accounts
   */
  static async generateSharedSecret(
    privateKey: string, 
    publicKey: string
  ): Promise<CryptoKey> {
    // In production, this would use ECDH with secp256k1 keys
    // For now, generate a deterministic key based on the input
    const combined = privateKey + publicKey;
    const encoder = new TextEncoder();
    const data = encoder.encode(combined);
    
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    
    return crypto.subtle.importKey(
      'raw',
      hashBuffer,
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt']
    );
  }
}