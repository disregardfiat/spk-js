import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { WalletEncryption } from '../../../src/wallet/encryption';


// Mock window.hive_keychain
if (typeof window === 'undefined') {
  (global as any).window = {};
}

const mockRequestEncryptMemo = jest.fn();
const mockRequestCustomJson = jest.fn();
const mockRequestBroadcast = jest.fn();

(global as any).window.hive_keychain = {
  requestEncryptMemo: mockRequestEncryptMemo,
  requestCustomJson: mockRequestCustomJson,
  requestBroadcast: mockRequestBroadcast
};

describe('WalletEncryption', () => {
  let walletEncryption: WalletEncryption;

  beforeEach(() => {
    walletEncryption = new WalletEncryption();
    jest.clearAllMocks();
  });

  describe('Hive Keychain Integration', () => {
    it('should request memo encryption via Hive Keychain', async () => {
      const mockResponse = {
        success: true,
        result: '#encrypted-memo-content'
      };
      
      mockRequestEncryptMemo.mockImplementation((_account: any, _recipient: any, _memo: any, callback: any) => {
        callback(mockResponse);
      });
      
      const result = await walletEncryption.encryptMemoKeychain(
        'alice',
        'bob',
        'test-aes-key-data'
      );
      
      expect(mockRequestEncryptMemo).toHaveBeenCalledWith(
        'alice',
        'bob',
        'test-aes-key-data',
        expect.any(Function)
      );
      expect(result).toBe('#encrypted-memo-content');
    });

    it('should handle Keychain encryption errors', async () => {
      const mockResponse = {
        success: false,
        error: 'User cancelled'
      };
      
      mockRequestEncryptMemo.mockImplementation((_account: any, _recipient: any, _memo: any, callback: any) => {
        callback(mockResponse);
      });
      
      await expect(walletEncryption.encryptMemoKeychain('alice', 'bob', 'test-key'))
        .rejects.toThrow('Keychain encryption failed: User cancelled');
    });

    it('should detect when Hive Keychain is not available', () => {
      // Temporarily remove hive_keychain
      const originalKeychain = window.hive_keychain;
      (window as any).hive_keychain = undefined;
      
      expect(walletEncryption.isKeychainAvailable()).toBe(false);
      
      // Restore
      window.hive_keychain = originalKeychain;
      expect(walletEncryption.isKeychainAvailable()).toBe(true);
    });
  });

  describe('Custom Wallet Interface', () => {
    it('should encrypt memo synchronously for custom wallet', () => {
      // Mock private key (in real usage, this would come from secure storage)
      const mockPrivateKey = 'mock-private-memo-key';
      const recipientPublicKey = 'STM8YourPublicKey1...';
      const message = 'test-aes-key-data';
      
      const encrypted = walletEncryption.encryptMemoSync(
        mockPrivateKey,
        recipientPublicKey,
        message
      );
      
      expect(encrypted).toBeDefined();
      expect(encrypted).toMatch(/^#/); // Encrypted memos start with #
    });
    
    it('should encrypt for multiple recipients synchronously', () => {
      const mockPrivateKey = 'mock-private-memo-key';
      const recipients = [
        { account: 'alice', publicKey: 'STM8PublicKey1...' },
        { account: 'bob', publicKey: 'STM8PublicKey2...' },
        { account: 'charlie', publicKey: 'STM8PublicKey3...' }
      ];
      const message = 'test-aes-key-data';
      
      const results = walletEncryption.encryptMemoSyncMultiSig(
        mockPrivateKey,
        recipients,
        message
      );
      
      expect(results).toHaveLength(3);
      expect(results[0].account).toBe('alice');
      expect(results[0].encryptedKey).toMatch(/^#/);
      expect(results[1].account).toBe('bob');
      expect(results[1].encryptedKey).toMatch(/^#/);
      expect(results[2].account).toBe('charlie');
      expect(results[2].encryptedKey).toMatch(/^#/);
    });

    it('should decrypt memo synchronously for custom wallet', () => {
      const mockPrivateKey = 'mock-private-memo-key';
      // Create a properly formatted encrypted memo
      const msgData = { msg: 'decrypted-content' };
      const base64Data = Buffer.from(JSON.stringify(msgData)).toString('base64');
      const encryptedMemo = `#${base64Data}`;
      
      const decrypted = walletEncryption.decryptMemoSync(
        mockPrivateKey,
        encryptedMemo
      );
      
      expect(decrypted).toBeDefined();
      expect(decrypted).toBe('decrypted-content');
    });

    it('should handle memo encryption for self', () => {
      const mockPrivateKey = 'mock-private-memo-key';
      const mockPublicKey = 'STM8MyPublicKey...';
      const message = 'test-aes-key-data';
      
      // When encrypting for self, use own public key
      const encrypted = walletEncryption.encryptMemoSync(
        mockPrivateKey,
        mockPublicKey,
        message
      );
      
      // Should be able to decrypt with same private key
      const decrypted = walletEncryption.decryptMemoSync(
        mockPrivateKey,
        encrypted
      );
      
      expect(decrypted).toBe(message);
    });
  });

  describe('Batch Encryption', () => {
    it('should use multi-sig encryption when available', async () => {
      // Mock multi-sig response
      mockRequestEncryptMemo.mockImplementation((_account: any, _recipient: any, _memo: any, callback: any) => {
        if (Array.isArray(_recipient)) {
          // Multi-sig format
          const results = _recipient.map((r: string) => `#encrypted-for-${r}`);
          callback({ success: true, result: results });
        } else {
          callback({ success: true, result: `#encrypted-for-${_recipient}` });
        }
      });
      
      const recipients = ['alice', 'bob', 'charlie'];
      const results = await walletEncryption.encryptForMultipleRecipients(
        'sender',
        recipients,
        'test-aes-key'
      );
      
      // Should have called multi-sig once instead of individual calls
      expect(mockRequestEncryptMemo).toHaveBeenCalledTimes(1);
      expect(mockRequestEncryptMemo).toHaveBeenCalledWith(
        'sender',
        recipients, // Array of recipients for multi-sig
        'test-aes-key',
        expect.any(Function)
      );
      
      expect(results).toHaveLength(3);
      expect(results[0]).toEqual({
        account: 'alice',
        encryptedKey: '#encrypted-for-alice'
      });
      expect(results[1]).toEqual({
        account: 'bob',
        encryptedKey: '#encrypted-for-bob'
      });
      expect(results[2]).toEqual({
        account: 'charlie',
        encryptedKey: '#encrypted-for-charlie'
      });
    });
    
    it('should fall back to individual encryption if multi-sig fails', async () => {
      let callCount = 0;
      mockRequestEncryptMemo.mockImplementation((_account: any, _recipient: any, _memo: any, callback: any) => {
        callCount++;
        if (Array.isArray(_recipient) && callCount === 1) {
          // First call with array fails
          callback({ success: false, error: 'Multi-sig not supported' });
        } else {
          // Individual calls succeed
          callback({ success: true, result: `#encrypted-for-${_recipient}` });
        }
      });
      
      const recipients = ['alice', 'bob', 'charlie'];
      const results = await walletEncryption.encryptForMultipleRecipients(
        'sender',
        recipients,
        'test-aes-key'
      );
      
      // Should have tried multi-sig first (call 1), then individual calls (calls 2-4)
      expect(mockRequestEncryptMemo).toHaveBeenCalledTimes(4);
      
      expect(results).toHaveLength(3);
      expect(results[0]).toEqual({
        account: 'alice',
        encryptedKey: '#encrypted-for-alice'
      });
      expect(results[1]).toEqual({
        account: 'bob',
        encryptedKey: '#encrypted-for-bob'
      });
      expect(results[2]).toEqual({
        account: 'charlie',
        encryptedKey: '#encrypted-for-charlie'
      });
    });

    it('should continue batch encryption even if one fails', async () => {
      mockRequestEncryptMemo.mockImplementation((_account: any, _recipient: any, _memo: any, callback: any) => {
        if (Array.isArray(_recipient)) {
          // Multi-sig fails
          callback({ success: false, error: 'Multi-sig not supported' });
        } else if (_recipient === 'bob') {
          callback({ success: false, error: 'Invalid recipient' });
        } else {
          callback({ success: true, result: `#encrypted-for-${_recipient}` });
        }
      });
      
      const recipients = ['alice', 'bob', 'charlie'];
      const results = await walletEncryption.encryptForMultipleRecipients(
        'sender',
        recipients,
        'test-aes-key'
      );
      
      expect(results).toHaveLength(2); // Only successful encryptions
      expect(results.find(r => r.account === 'alice')).toBeDefined();
      expect(results.find(r => r.account === 'charlie')).toBeDefined();
      expect(results.find(r => r.account === 'bob')).toBeUndefined();
    });
  });

  describe('Encryption Request UI', () => {
    it('should prepare encryption request for user confirmation', () => {
      const recipients = ['alice', 'bob', 'self'];
      const fileInfo = {
        name: 'document.pdf',
        size: 1024 * 1024,
        type: 'application/pdf'
      };
      
      const request = walletEncryption.prepareEncryptionRequestUI(recipients, fileInfo);
      
      expect(request).toBeDefined();
      expect(request.title).toBe('Encrypt File');
      expect(request.message).toContain('document.pdf');
      expect(request.message).toContain('1.00 MB');
      expect(request.recipients).toEqual(recipients);
      expect(request.requiresConfirmation).toBe(true);
    });
  });
});