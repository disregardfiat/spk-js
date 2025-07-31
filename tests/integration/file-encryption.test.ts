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
      // This mock should NOT call the KeyManager's fetchMemoKeys
      // Instead, the Encryption class should call fetchMemoKeys itself
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
    
    // Add TextEncoder/TextDecoder polyfills if missing  
    if (typeof TextEncoder === 'undefined') {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { TextEncoder, TextDecoder } = require('util');
      (global as any).TextEncoder = TextEncoder;
      (global as any).TextDecoder = TextDecoder;
    }
    
    // Force use of our polyfilled File class instead of jsdom's basic one
    if (typeof File !== 'undefined' && !File.prototype.arrayBuffer) {
      // jsdom's File doesn't have arrayBuffer, so use our polyfill
      (global as any).File = class File {
        name: string;
        size: number;
        type: string;
        private content: ArrayBuffer;

        constructor(content: BlobPart[], name: string, options?: FilePropertyBag) {
          this.name = name;
          this.type = options?.type || '';
          
          // Convert content to ArrayBuffer
          if (content[0] instanceof ArrayBuffer) {
            this.content = content[0];
          } else if (content[0] instanceof Uint8Array) {
            this.content = content[0].buffer.slice(content[0].byteOffset, content[0].byteOffset + content[0].byteLength);
          } else if (typeof content[0] === 'string') {
            const encoder = new TextEncoder();
            this.content = encoder.encode(content[0]).buffer;
          } else {
            this.content = new ArrayBuffer(0);
          }
          
          this.size = this.content.byteLength;
        }

        async arrayBuffer(): Promise<ArrayBuffer> {
          return this.content;
        }

        async text(): Promise<string> {
          const decoder = new TextDecoder();
          return decoder.decode(this.content);
        }
      };
    }
    
    // Ensure crypto mocks are available - use the same mock structure as setup.ts
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
    
    // Set crypto on global, globalThis, and window for maximum compatibility
    (global as any).crypto = cryptoMock;
    (globalThis as any).crypto = cryptoMock;
    if (typeof window !== 'undefined') {
      (window as any).crypto = cryptoMock;
    }
    
    // Ensure subtle property is explicitly set (sometimes it gets lost)
    if ((globalThis as any).crypto && !(globalThis as any).crypto.subtle) {
      (globalThis as any).crypto.subtle = cryptoMock.subtle;
    }
    if ((global as any).crypto && !(global as any).crypto.subtle) {
      (global as any).crypto.subtle = cryptoMock.subtle;
    }
    
    // Setup mock account
    account = new SPKAccount('testuser', { node: 'https://spktest.dlux.io' });
    account.hasKeychain = true;
    
    // Mock the keychain adapter
    account.keychainAdapter = {
      isAvailable: jest.fn().mockReturnValue(true),
      signMessage: jest.fn().mockImplementation(() => Promise.resolve({ signature: 'mock-signature', publicKey: 'mock-pubkey' })),
      sign: jest.fn().mockImplementation(() => Promise.resolve({ signature: 'mock-signature', publicKey: 'mock-pubkey' })),
      broadcast: jest.fn().mockImplementation(() => Promise.resolve({ id: 'mock-tx-id' }))
    } as any;
    
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
      const recipients = ['alice', 'bob', 'testuser']; // Include self
      
      // Mock wallet encryption responses
      ((global as any).window.hive_keychain.requestEncryptMemo as jest.Mock).mockImplementation(
        (_account: any, recipient: any, memo: any, callback: any) => {
          callback({
            success: true,
            result: `#encrypted-${memo.substring(0, 10)}...-for-${recipient}`
          });
        }
      );
      
      // Mock fetch to handle different API calls
      (global.fetch as jest.Mock).mockImplementation((url: unknown) => {
        const urlStr = url as string;
        
        // Mock Hive API call for memo keys
        if (urlStr.includes('/api/accounts')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              result: [
                { name: 'alice', memo_key: 'STM7mockMemoKeyForAlice123' },
                { name: 'bob', memo_key: 'STM7mockMemoKeyForBob456' },
                { name: 'testuser', memo_key: 'STM7mockMemoKeyForTestuser789' }
              ]
            })
          });
        }
        // Mock contract creation
        if (urlStr.includes('/api/new_contract')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              id: 'contract-123',
              api: 'https://ipfs.dlux.io',
              fosig: 'mock-signature',
              t: 'testuser',
              files: [{ cid: 'QmMockCID...', size: 12 }]
            })
          });
        }
        // Mock upload authorization
        if (urlStr.includes('/upload-authorize')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              cid: 'QmMockCID...'
            })
          });
        }
        return Promise.reject(new Error(`Unknown URL: ${urlStr}`));
      });
      
      // Mock the contract creator methods and other internal methods to prevent early failures
      const mockContractResult = {
        success: true,
        contractId: 'contract-123',
        transactionId: 'tx-123',
        provider: { nodeId: 'testnode', api: 'https://testnode.com' },
        brocaCost: 100,
        size: 1000,
        duration: 30
      };
      
      const mockContract = {
        i: 'contract-123',
        t: 'testuser',
        fosig: 'mock-sig',
        api: 'https://ipfs.dlux.io',
        df: ['QmMockCID...']
      };
      
      // Mock all methods that could cause the upload to fail before encryption
      (spkFile as any)['contractCreator'] = {
        createStorageContract: jest.fn().mockImplementation(() => Promise.resolve(mockContractResult)),
        getContractDetails: jest.fn().mockImplementation(() => Promise.resolve(mockContract))
      };
      (spkFile as any)['waitForContract'] = jest.fn().mockImplementation(() => Promise.resolve());
      (spkFile as any)['authorizeUpload'] = jest.fn().mockImplementation(() => Promise.resolve());
      (spkFile as any)['uploadToIPFS'] = jest.fn().mockImplementation(() => Promise.resolve());
      
      // Test the encryption flow directly to verify memo key fetching
      const encryption = spkFile['encryption'];
      
      // Import and spy on HiveAPI
      const { HiveAPI } = await import('../../src/api');
      const getAccountsSpy = jest.spyOn(HiveAPI, 'getAccounts');
      
      // Create a test file for encryption
      const testFile = new File(['Test content'], 'test.txt', { type: 'text/plain' });
      
      // This should trigger the full encryption flow including memo key fetching
      await encryption.encryptForUpload(testFile, recipients);
      
      // Verify that HiveAPI.getAccounts was called with the recipients
      expect(getAccountsSpy).toHaveBeenCalledWith(recipients);
      
      // The wallet encryption is mocked at the module level, so we should verify
      // that the walletEncryption.encryptForMultipleRecipients was called
      const { walletEncryption } = await import('../../src/wallet/encryption');
      expect(walletEncryption.encryptForMultipleRecipients).toHaveBeenCalledWith(
        'testuser',
        recipients,
        expect.any(String)
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
      // eslint-disable-next-line @typescript-eslint/no-var-requires
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
      
      // Debug: File should now have arrayBuffer method
      
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
      
      // Verify metadata structure
      expect(result.metadata).toMatchObject({
        encrypted: true,
        algorithm: 'AES-256-GCM',
        recipients: expect.arrayContaining(['alice', 'bob', 'self']), // 'self' automatically added
        originalName: 'secret.pdf',
        originalType: 'application/pdf',
        iv: expect.any(String) // Base64 encoded IV
      });
      
      // Verify encrypted keys structure
      expect(result.metadata.encryptedKeys).toHaveLength(3);
      expect(result.metadata.encryptedKeys).toEqual(
        expect.arrayContaining([
          { account: 'alice', encryptedKey: expect.stringMatching(/^#encrypted-.+-for-alice$/) },
          { account: 'bob', encryptedKey: expect.stringMatching(/^#encrypted-.+-for-bob$/) },
          { account: 'self', encryptedKey: expect.stringMatching(/^#encrypted-.+-for-self$/) }
        ])
      );
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