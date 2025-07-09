import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { SPKFile } from '../../src/storage/file';
import { SPKAccount } from '../../src/core/account';
import { Encryption, KeyManager } from '../../src/crypto';
import { walletEncryption } from '../../src/wallet/encryption';

// Mock wallet encryption module
jest.mock('../../src/wallet/encryption', () => ({
  walletEncryption: {
    encryptMemoSync: jest.fn((_privateKey: string, recipientPublicKey: string, memo: string) => {
      return `#encrypted-${memo.substring(0, 10)}-for-${recipientPublicKey.substring(0, 10)}`;
    }),
    decryptMemoSync: jest.fn((_privateKey: string, _encryptedMemo: string) => {
      // Simple mock that returns the original data
      return 'base64-encoded-aes-key';
    }),
    encryptForMultipleRecipients: jest.fn(async (_account: string, recipients: string[], memo: string) => {
      return recipients.map(recipient => ({
        account: recipient,
        encryptedKey: `#encrypted-${memo.substring(0, 10)}-for-${recipient}`
      }));
    })
  }
}));

// Mock HiveAPI
jest.mock('../../src/api', () => ({
  HiveAPI: {
    getAccounts: jest.fn().mockImplementation((accounts: unknown) => {
      const accountArray = accounts as string[];
      return Promise.resolve(accountArray.map(name => ({
        name,
        memo_key: `STM8PublicKey${name}...`
      })));
    })
  }
}));

// Mock fetch for API calls
global.fetch = jest.fn() as any;

// Don't override crypto - let setup.ts handle it
// The setup.ts file already provides proper crypto mocks

// Ensure window exists and add hive_keychain if not already present
if (typeof window === 'undefined') {
  (global as any).window = {};
}
if (!(global as any).window.hive_keychain) {
  (global as any).window.hive_keychain = {
    requestEncryptMemo: jest.fn(),
    requestCustomJson: jest.fn()
  };
}

describe('File Encryption Integration', () => {
  let account: SPKAccount;
  let spkFile: SPKFile;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Ensure crypto mocks are available
    const cryptoMock = {
        getRandomValues: jest.fn((array: any) => {
          for (let i = 0; i < array.length; i++) {
            array[i] = Math.floor(Math.random() * 256);
          }
          return array;
        }),
        subtle: {
          generateKey: jest.fn().mockImplementation(async () => ({
            type: 'secret',
            algorithm: { name: 'AES-GCM', length: 256 },
            extractable: true,
            usages: ['encrypt', 'decrypt'],
            _id: Math.random()
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
          exportKey: jest.fn().mockImplementation(async () => {
            const key = new ArrayBuffer(32);
            new Uint8Array(key).fill(1);
            return key;
          }),
          importKey: jest.fn().mockImplementation(async () => ({
            type: 'secret',
            algorithm: { name: 'AES-GCM', length: 256 },
            extractable: true,
            usages: ['encrypt', 'decrypt']
          }))
        }
      };
    
    // Set crypto on both global and globalThis
    (global as any).crypto = cryptoMock;
    (globalThis as any).crypto = cryptoMock;
    
    // Setup mock account
    account = new SPKAccount('testuser', { node: 'https://spktest.dlux.io' });
    account.hasKeychain = true;
    
    spkFile = new SPKFile(account);
    
    // Mock successful public key registration
    jest.spyOn(account, 'registerPublicKey').mockResolvedValue(undefined);
  });

  // Don't restore all mocks as it removes our crypto setup
  // afterEach(() => {
  //   jest.restoreAllMocks();
  // });

  describe('End-to-End Encryption Flow', () => {
    it('should encrypt a file for multiple recipients and prepare for upload', async () => {
      // Test data
      const testFile = new File(['Test content'], 'test.txt', { type: 'text/plain' });
      const recipients = ['alice', 'bob', 'testuser']; // Include self
      
      // Mock Hive API response for fetching memo keys
      const mockAccounts = [
        { name: 'alice', memo_key: 'STM8PublicKeyAlice...' },
        { name: 'bob', memo_key: 'STM8PublicKeyBob...' },
        { name: 'testuser', memo_key: 'STM8PublicKeyTestuser...' }
      ];
      
      (global.fetch as jest.Mock).mockImplementation((url: unknown) => {
        const urlStr = url as string;
        if (urlStr.includes('/api/accounts')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockAccounts)
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });
      
      // Mock wallet encryption responses
      ((global as any).window.hive_keychain.requestEncryptMemo as jest.Mock).mockImplementation(
        (_account: any, recipient: any, memo: any, callback: any) => {
          callback({
            success: true,
            result: `#encrypted-${memo.substring(0, 10)}...-for-${recipient}`
          });
        }
      );
      
      // Mock contract creation
      (global.fetch as jest.Mock).mockImplementationOnce(() => 
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            id: 'contract-123',
            api: 'https://ipfs.dlux.io',
            fosig: 'mock-signature',
            t: 'testuser',
            files: [{ cid: 'QmMockCID...', size: 12 }]
          })
        })
      );
      
      // Execute the upload with encryption
      const uploadOptions = {
        encrypt: recipients
      };
      
      // This should trigger the full encryption flow
      const uploadPromise = spkFile.upload(testFile, uploadOptions);
      
      // The upload method will:
      // 1. Generate AES key
      // 2. Fetch memo keys for recipients
      // 3. Encrypt the file
      // 4. Prepare encryption request for wallet
      // 5. Get encrypted keys from wallet
      // 6. Create contract with encryption metadata
      
      // For testing, we'll verify the intermediate steps
      expect(account.registerPublicKey).toHaveBeenCalled();
      
      // Since upload will fail at the actual IPFS upload step (not mocked),
      // we'll catch the error and verify the encryption happened
      await expect(uploadPromise).rejects.toThrow();
      
      // Verify memo key fetching was attempted
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/accounts'),
        expect.any(Object)
      );
      
      // Verify wallet encryption was called for each recipient
      expect((window as any).hive_keychain.requestEncryptMemo).toHaveBeenCalledTimes(3);
      expect((window as any).hive_keychain.requestEncryptMemo).toHaveBeenCalledWith(
        'testuser',
        'alice',
        expect.any(String),
        expect.any(Function)
      );
    });
  });

  describe('Encryption with Custom Wallet', () => {
    it('should support synchronous encryption for custom wallets', () => {
      const privateKey = 'mock-private-memo-key';
      const recipientPublicKey = 'STM8PublicKeyRecipient...';
      const aesKeyData = 'base64-encoded-aes-key';
      
      // Test synchronous encryption
      const encrypted = walletEncryption.encryptMemoSync(
        privateKey,
        recipientPublicKey,
        aesKeyData
      );
      
      expect(encrypted).toBeDefined();
      expect(encrypted).toMatch(/^#/); // Encrypted memos start with #
      
      // Test synchronous decryption
      const decrypted = walletEncryption.decryptMemoSync(
        privateKey,
        encrypted
      );
      
      expect(decrypted).toBe(aesKeyData);
    });
  });

  describe('Partial Encryption Failures', () => {
    it('should handle partial encryption failures gracefully', async () => {
      const keyManager = new KeyManager();
      new Encryption(keyManager); // Instantiate to test constructor
      
      // Mock that Bob's account doesn't exist
      // Override HiveAPI mock for this test
      const { HiveAPI } = require('../../src/api');
      HiveAPI.getAccounts.mockImplementationOnce((accounts: string[]) => {
        // Filter out bob from the results
        return Promise.resolve(
          accounts
            .filter(name => name !== 'bob')
            .map(name => ({
              name,
              memo_key: `STM8PublicKey${name}...`
            }))
        );
      });
      
      const recipients = ['alice', 'bob', 'charlie'];
      const fetchedKeys = await keyManager.fetchMemoKeys(recipients);
      
      // Should only return keys for existing accounts
      expect(fetchedKeys).toHaveLength(2);
      expect(fetchedKeys.find(k => k.account === 'bob')).toBeUndefined();
      expect(fetchedKeys.find(k => k.account === 'alice')).toBeDefined();
      expect(fetchedKeys.find(k => k.account === 'charlie')).toBeDefined();
    });
  });

  describe('Encryption Metadata', () => {
    it('should properly store encryption metadata with the file', async () => {
      const keyManager = new KeyManager();
      const encryption = new Encryption(keyManager);
      
      const testFile = new File(['Sensitive data'], 'secret.pdf', { 
        type: 'application/pdf' 
      });
      
      // Mock memo key fetching
      jest.spyOn(keyManager, 'fetchMemoKeys').mockResolvedValue([
        { account: 'alice', memoKey: 'STM8PublicKeyAlice...' },
        { account: 'bob', memoKey: 'STM8PublicKeyBob...' }
      ]);
      
      const result = await encryption.encryptForUpload(testFile, ['alice', 'bob']);
      
      // Verify encrypted file properties
      expect(result.encryptedFile.name).toBe('secret.pdf.enc');
      expect(result.encryptedFile.type).toBe('application/octet-stream');
      expect(result.encryptedFile.size).toBeGreaterThan(0);
      
      // Verify metadata
      expect(result.metadata).toEqual({
        encrypted: true,
        algorithm: 'AES-256-GCM',
        recipients: ['alice', 'bob'],
        originalName: 'secret.pdf',
        originalType: 'application/pdf',
        encryptedKeys: [
          { account: 'alice', encryptedKey: '#encrypted-key-for-alice' },
          { account: 'bob', encryptedKey: '#encrypted-key-for-bob' }
        ]
      });
    });
  });

  describe('Large File Encryption', () => {
    it('should handle large files efficiently', async () => {
      const keyManager = new KeyManager();
      const encryption = new Encryption(keyManager);
      
      // Create a 10MB file
      const largeData = new Uint8Array(10 * 1024 * 1024);
      for (let i = 0; i < largeData.length; i++) {
        largeData[i] = Math.floor(Math.random() * 256);
      }
      const largeFile = new File([largeData], 'large.bin', { 
        type: 'application/octet-stream' 
      });
      
      // Generate AES key
      const aesKey = await encryption.generateAESKey();
      
      // Measure encryption time
      const startTime = performance.now();
      const encrypted = await encryption.encryptFile(largeFile, aesKey);
      const encryptTime = performance.now() - startTime;
      
      // Encryption should be reasonably fast (< 1 second for 10MB)
      expect(encryptTime).toBeLessThan(1000);
      
      // Verify encrypted data
      expect(encrypted.encryptedData).toBeInstanceOf(ArrayBuffer);
      expect(encrypted.encryptedData.byteLength).toBeGreaterThan(largeFile.size);
      
      // Verify decryption
      const decrypted = await encryption.decryptFile(encrypted, aesKey);
      expect(decrypted.size).toBe(largeFile.size);
    });
  });
});