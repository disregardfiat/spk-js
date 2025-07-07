/**
 * @jest-environment node
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Encryption, EncryptionMetadata } from '../../../src/crypto/encryption';
import { KeyManager } from '../../../src/crypto/key-management';

// Mock the HiveAPI
jest.mock('../../../src/api', () => ({
  HiveAPI: {
    getAccounts: jest.fn().mockImplementation((accounts: any) => {
      const accountArray = accounts as string[];
      return Promise.resolve(accountArray.map(name => ({
        name,
        memo_key: `STM8PublicKey${name}...`
      })));
    })
  }
}));

// Mock the wallet encryption
jest.mock('../../../src/wallet/encryption', () => ({
  walletEncryption: {
    encryptForMultipleRecipients: jest.fn().mockImplementation(async (_account: any, recipients: any, message: any) => {
      const recipientArray = recipients as string[];
      return recipientArray.map((recipient: string) => ({
        account: recipient,
        encryptedKey: `#encrypted-${message}-for-${recipient}`
      }));
    })
  }
}));

// Mock crypto globally for this test file
const mockCrypto = {
  getRandomValues: (array: Uint8Array) => {
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
    return array;
  },
  subtle: {
    generateKey: jest.fn().mockImplementation(async () => ({
      type: 'secret',
      algorithm: { name: 'AES-GCM', length: 256 },
      extractable: true,
      usages: ['encrypt', 'decrypt'],
      _id: Math.random() // Add unique identifier for testing
    })),
    encrypt: jest.fn().mockImplementation(async (_algorithm: any, _key: any, data: any) => {
      const dataBuffer = data as ArrayBuffer;
      const encrypted = new ArrayBuffer(dataBuffer.byteLength + 16);
      new Uint8Array(encrypted).set(new Uint8Array(dataBuffer));
      return encrypted;
    }),
    decrypt: jest.fn().mockImplementation(async (_algorithm: any, _key: any, data: any) => {
      const dataBuffer = data as ArrayBuffer;
      const decrypted = new ArrayBuffer(dataBuffer.byteLength - 16);
      new Uint8Array(decrypted).set(new Uint8Array(dataBuffer).slice(0, -16));
      return decrypted;
    }),
    exportKey: jest.fn().mockImplementation(async (_format: any, key: any) => {
      const mockKey = new ArrayBuffer(32);
      // Use the key's unique ID to generate different exports
      const fillValue = key._id ? Math.floor(key._id * 255) : 42;
      new Uint8Array(mockKey).fill(fillValue);
      return mockKey;
    })
  }
};

// Try to use node's webcrypto if available, otherwise use mock
let crypto: any;
try {
  const { webcrypto } = require('crypto');
  crypto = webcrypto;
} catch {
  crypto = mockCrypto;
}

// Set up global crypto
global.crypto = crypto as any;
(globalThis as any).crypto = crypto;

interface AesKeyAlgorithm extends KeyAlgorithm {
  length: number;
}

describe('Encryption', () => {
  let encryption: Encryption;
  let keyManager: KeyManager;

  beforeEach(() => {
    keyManager = new KeyManager();
    encryption = new Encryption(keyManager, 'testuser');
  });

  describe('AES Key Generation', () => {
    it('should generate a random AES-256 key', async () => {
      const key = await encryption.generateAESKey();
      
      expect(key).toBeDefined();
      expect(key.type).toBe('secret');
      expect(key.algorithm.name).toBe('AES-GCM');
      expect((key.algorithm as AesKeyAlgorithm).length).toBe(256);
      expect(key.extractable).toBe(true);
      expect(key.usages).toContain('encrypt');
      expect(key.usages).toContain('decrypt');
    });

    it('should generate unique keys each time', async () => {
      const key1 = await encryption.generateAESKey();
      const key2 = await encryption.generateAESKey();
      
      // Export keys to compare them
      const exportedKey1 = await crypto.subtle.exportKey('raw', key1);
      const exportedKey2 = await crypto.subtle.exportKey('raw', key2);
      
      // Convert to arrays for comparison
      const array1 = new Uint8Array(exportedKey1);
      const array2 = new Uint8Array(exportedKey2);
      
      // At least one byte should be different
      const isDifferent = array1.some((byte, index) => byte !== array2[index]);
      expect(isDifferent).toBe(true);
    });
  });

  describe('File Encryption', () => {
    it('should encrypt a file with AES-GCM', async () => {
      const testData = new TextEncoder().encode('Test file content');
      const file = new File([testData], 'test.txt', { type: 'text/plain' });
      const key = await encryption.generateAESKey();
      
      const encrypted = await encryption.encryptFile(file, key);
      
      expect(encrypted).toBeDefined();
      expect(encrypted.encryptedData).toBeInstanceOf(ArrayBuffer);
      expect(encrypted.iv).toBeInstanceOf(Uint8Array);
      expect(encrypted.iv.length).toBe(12); // GCM uses 96-bit IV
      expect(encrypted.originalName).toBe('test.txt');
      expect(encrypted.originalType).toBe('text/plain');
      expect(encrypted.originalSize).toBe(testData.length);
    });

    it('should decrypt an encrypted file', async () => {
      const testData = new TextEncoder().encode('Test file content');
      const file = new File([testData], 'test.txt', { type: 'text/plain' });
      const key = await encryption.generateAESKey();
      
      const encrypted = await encryption.encryptFile(file, key);
      const decrypted = await encryption.decryptFile(encrypted, key);
      
      expect(decrypted).toBeInstanceOf(File);
      expect(decrypted.name).toBe('test.txt');
      expect(decrypted.type).toBe('text/plain');
      
      const decryptedContent = await decrypted.text();
      expect(decryptedContent).toBe('Test file content');
    });

    it('should handle large files with chunked encryption', async () => {
      // Create a 5MB file
      const largeData = new Uint8Array(5 * 1024 * 1024);
      for (let i = 0; i < largeData.length; i++) {
        largeData[i] = i % 256;
      }
      const file = new File([largeData], 'large.bin', { type: 'application/octet-stream' });
      const key = await encryption.generateAESKey();
      
      const encrypted = await encryption.encryptFile(file, key);
      const decrypted = await encryption.decryptFile(encrypted, key);
      
      expect(decrypted.size).toBe(file.size);
      
      // Verify content integrity
      const decryptedBuffer = await decrypted.arrayBuffer();
      const decryptedArray = new Uint8Array(decryptedBuffer);
      expect(decryptedArray).toEqual(largeData);
    });
  });

  describe('Key Wrapping for Recipients', () => {
    it('should wrap AES key for multiple recipients', async () => {
      const aesKey = await encryption.generateAESKey();
      const recipients = [
        { account: 'alice', memoKey: 'STM8YourPublicKey1...' },
        { account: 'bob', memoKey: 'STM8YourPublicKey2...' },
        { account: 'self', memoKey: 'STM8MyPublicKey...' }
      ];
      
      const wrappedKeys = await encryption.wrapKeyForRecipients(aesKey, recipients);
      
      expect(wrappedKeys).toHaveLength(3);
      expect(wrappedKeys[0].account).toBe('alice');
      expect(wrappedKeys[0].encryptedKey).toBeDefined();
      expect(wrappedKeys[0].algorithm).toBe('RSA-OAEP');
    });
  });

  describe('Encryption Metadata', () => {
    it('should create encryption metadata for upload', async () => {
      const testData = new TextEncoder().encode('Test file content');
      const file = new File([testData], 'test.txt', { type: 'text/plain' });
      const recipients = ['alice', 'bob', 'charlie'];
      
      const result = await encryption.encryptForUpload(file, recipients);
      
      expect(result).toBeDefined();
      expect(result.encryptedFile).toBeInstanceOf(File);
      expect(result.encryptedFile.name).toMatch(/\.enc$/);
      expect(result.metadata).toBeDefined();
      expect(result.metadata.encrypted).toBe(true);
      expect(result.metadata.algorithm).toBe('AES-256-GCM');
      expect(result.metadata.recipients).toHaveLength(4); // alice, bob, charlie, testuser
      expect(result.metadata.originalName).toBe('test.txt');
      expect(result.metadata.originalType).toBe('text/plain');
      expect(result.metadata.encryptedKeys).toHaveLength(4);
      expect(result.metadata.iv).toBeDefined();
    });

    it('should automatically include signer in recipients', async () => {
      const testData = new TextEncoder().encode('Test file content');
      const file = new File([testData], 'test.txt', { type: 'text/plain' });
      const recipients = ['alice', 'bob']; // Note: 'testuser' not included
      
      const result = await encryption.encryptForUpload(file, recipients);
      
      // Should have 3 recipients: alice, bob, and testuser (the signer)
      expect(result.metadata.recipients).toHaveLength(3);
      expect(result.metadata.recipients).toContain('alice');
      expect(result.metadata.recipients).toContain('bob');
      expect(result.metadata.recipients).toContain('testuser'); // The signer
      expect(result.metadata.encryptedKeys).toHaveLength(3);
    });

    it('should not duplicate signer if already in recipients', async () => {
      const testData = new TextEncoder().encode('Test file content');
      const file = new File([testData], 'test.txt', { type: 'text/plain' });
      const recipients = ['alice', 'testuser', 'bob']; // testuser already included
      
      const result = await encryption.encryptForUpload(file, recipients);
      
      // Should still have 3 recipients
      expect(result.metadata.recipients).toHaveLength(3);
      expect(result.metadata.recipients).toEqual(['alice', 'testuser', 'bob']);
    });
  });

  describe('Metadata String Generation', () => {
    it('should generate compact metadata string', () => {
      const metadata: EncryptionMetadata = {
        encrypted: true,
        algorithm: 'AES-256-GCM',
        recipients: ['alice', 'bob', 'charlie'],
        originalName: 'document.pdf',
        originalType: 'application/pdf',
        encryptedKeys: [
          { account: 'alice', encryptedKey: '#encrypted-key-alice' },
          { account: 'bob', encryptedKey: '#encrypted-key-bob' },
          { account: 'charlie', encryptedKey: '#encrypted-key-charlie' }
        ],
        iv: 'base64-encoded-iv'
      };
      
      const metadataString = Encryption.generateMetadataString(metadata);
      
      expect(metadataString).toBeDefined();
      expect(typeof metadataString).toBe('string');
      
      // Should be base64 encoded
      expect(() => Buffer.from(metadataString, 'base64')).not.toThrow();
      
      // Decode and check structure
      const decoded = JSON.parse(Buffer.from(metadataString, 'base64').toString());
      expect(decoded.e).toBe(1);
      expect(decoded.a).toBe('AES-256-GCM');
      expect(decoded.r).toEqual(['alice', 'bob', 'charlie']);
      expect(decoded.n).toBe('document.pdf');
      expect(decoded.t).toBe('application/pdf');
      expect(decoded.k).toEqual({
        alice: '#encrypted-key-alice',
        bob: '#encrypted-key-bob',
        charlie: '#encrypted-key-charlie'
      });
      expect(decoded.iv).toBe('base64-encoded-iv');
    });

    it('should parse metadata string back to object', () => {
      const originalMetadata: EncryptionMetadata = {
        encrypted: true,
        algorithm: 'AES-256-GCM',
        recipients: ['alice', 'bob'],
        originalName: 'test.txt',
        originalType: 'text/plain',
        encryptedKeys: [
          { account: 'alice', encryptedKey: '#key1' },
          { account: 'bob', encryptedKey: '#key2' }
        ],
        iv: 'test-iv'
      };
      
      const metadataString = Encryption.generateMetadataString(originalMetadata);
      const parsed = Encryption.parseMetadataString(metadataString);
      
      expect(parsed.encrypted).toBe(true);
      expect(parsed.algorithm).toBe('AES-256-GCM');
      expect(parsed.recipients).toEqual(['alice', 'bob']);
      expect(parsed.originalName).toBe('test.txt');
      expect(parsed.originalType).toBe('text/plain');
      expect(parsed.encryptedKeys).toHaveLength(2);
      expect(parsed.encryptedKeys).toContainEqual({ account: 'alice', encryptedKey: '#key1' });
      expect(parsed.encryptedKeys).toContainEqual({ account: 'bob', encryptedKey: '#key2' });
      expect(parsed.iv).toBe('test-iv');
    });

    it('should handle invalid metadata string', () => {
      expect(() => Encryption.parseMetadataString('invalid-base64!@#'))
        .toThrow('Invalid metadata string format');
      
      expect(() => Encryption.parseMetadataString('aW52YWxpZCBqc29u')) // "invalid json"
        .toThrow('Invalid metadata string format');
    });
  });
});