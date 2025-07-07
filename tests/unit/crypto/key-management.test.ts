/**
 * @jest-environment node
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { KeyManager } from '../../../src/crypto/key-management';

// Set up crypto for node environment
const { webcrypto } = require('crypto');
global.crypto = webcrypto as any;
(globalThis as any).crypto = webcrypto;

// Mock the Hive API calls
jest.mock('../../../src/api', () => ({
  HiveAPI: {
    getAccounts: jest.fn()
  }
}));

describe('KeyManager', () => {
  let keyManager: KeyManager;

  beforeEach(() => {
    keyManager = new KeyManager();
    jest.clearAllMocks();
  });

  describe('Memo Key Fetching', () => {
    it('should fetch memo keys for multiple accounts', async () => {
      const { HiveAPI } = await import('../../../src/api');
      const mockAccounts = [
        {
          name: 'alice',
          memo_key: 'STM8YourPublicKey1...',
          posting: { key_auths: [['STM8PostingKey1...', 1]] }
        },
        {
          name: 'bob',
          memo_key: 'STM8YourPublicKey2...',
          posting: { key_auths: [['STM8PostingKey2...', 1]] }
        }
      ];
      
      (HiveAPI.getAccounts as jest.MockedFunction<typeof HiveAPI.getAccounts>).mockResolvedValue(mockAccounts);
      
      const accounts = ['alice', 'bob'];
      const memoKeys = await keyManager.fetchMemoKeys(accounts);
      
      expect(HiveAPI.getAccounts).toHaveBeenCalledWith(accounts);
      expect(memoKeys).toHaveLength(2);
      expect(memoKeys[0]).toEqual({
        account: 'alice',
        memoKey: 'STM8YourPublicKey1...'
      });
      expect(memoKeys[1]).toEqual({
        account: 'bob',
        memoKey: 'STM8YourPublicKey2...'
      });
    });

    it('should handle missing accounts gracefully', async () => {
      const { HiveAPI } = await import('../../../src/api');
      const mockAccounts = [
        {
          name: 'alice',
          memo_key: 'STM8YourPublicKey1...'
        }
      ];
      
      (HiveAPI.getAccounts as jest.MockedFunction<typeof HiveAPI.getAccounts>).mockResolvedValue(mockAccounts);
      
      const accounts = ['alice', 'nonexistent'];
      const memoKeys = await keyManager.fetchMemoKeys(accounts);
      
      expect(memoKeys).toHaveLength(1);
      expect(memoKeys[0].account).toBe('alice');
    });

    it('should cache memo keys to avoid repeated API calls', async () => {
      const { HiveAPI } = await import('../../../src/api');
      const mockAccounts = [
        {
          name: 'alice',
          memo_key: 'STM8YourPublicKey1...'
        }
      ];
      
      (HiveAPI.getAccounts as jest.MockedFunction<typeof HiveAPI.getAccounts>).mockResolvedValue(mockAccounts);
      
      // First call
      await keyManager.fetchMemoKeys(['alice']);
      
      // Second call - should use cache
      const cachedKeys = await keyManager.fetchMemoKeys(['alice']);
      
      expect(HiveAPI.getAccounts).toHaveBeenCalledTimes(1);
      expect(cachedKeys[0].account).toBe('alice');
    });
  });

  describe('Key Derivation', () => {
    it('should convert Hive memo key to Web Crypto key', async () => {
      const hiveMemoKey = 'STM8YourPublicKey1...';
      
      const cryptoKey = await keyManager.hiveMemoKeyToCryptoKey(hiveMemoKey);
      
      expect(cryptoKey).toBeDefined();
      expect(cryptoKey.type).toBe('public');
      expect(cryptoKey.algorithm.name).toBe('RSA-OAEP');
      expect(cryptoKey.usages).toContain('wrapKey');
    });

    it('should handle invalid Hive keys', async () => {
      const invalidKey = 'invalid-key-format';
      
      await expect(keyManager.hiveMemoKeyToCryptoKey(invalidKey))
        .rejects.toThrow('Invalid Hive public key format');
    });
  });

  describe('Encryption Request Signing', () => {
    it('should prepare encryption request for wallet signing', async () => {
      const aesKey = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );
      
      const recipients = [
        { account: 'alice', memoKey: 'STM8YourPublicKey1...' },
        { account: 'bob', memoKey: 'STM8YourPublicKey2...' }
      ];
      
      const request = await keyManager.prepareEncryptionRequest(aesKey, recipients);
      
      expect(request).toBeDefined();
      expect(request.type).toBe('encrypt_memo');
      expect(request.recipients).toEqual(['alice', 'bob']);
      expect(request.keyData).toBeDefined();
      expect(request.keyData.algorithm).toBe('AES-256-GCM');
      expect(request.keyData.key).toBeDefined();
    });
  });

  describe('Encrypted Key Processing', () => {
    it('should process wallet encryption response', async () => {
      const walletResponse = {
        success: true,
        encryptedKeys: [
          {
            account: 'alice',
            encryptedMemo: '#encrypted-memo-for-alice'
          },
          {
            account: 'bob',
            encryptedMemo: '#encrypted-memo-for-bob'
          }
        ]
      };
      
      const processed = keyManager.processWalletEncryptionResponse(walletResponse);
      
      expect(processed).toHaveLength(2);
      expect(processed[0].account).toBe('alice');
      expect(processed[0].encryptedKey).toBe('#encrypted-memo-for-alice');
      expect(processed[1].account).toBe('bob');
      expect(processed[1].encryptedKey).toBe('#encrypted-memo-for-bob');
    });

    it('should handle wallet encryption failure', () => {
      const walletResponse = {
        success: false,
        error: 'User cancelled'
      };
      
      expect(() => keyManager.processWalletEncryptionResponse(walletResponse))
        .toThrow('Wallet encryption failed: User cancelled');
    });
  });
});