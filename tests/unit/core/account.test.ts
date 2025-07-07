import { SPKAccount } from '../../../src/core/account';
import { SPKAPI } from '../../../src/core/api';

// Mock the API module
jest.mock('../../../src/core/api');

describe('SPKAccount', () => {
  let account: SPKAccount;
  let mockAPI: jest.Mocked<SPKAPI>;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Create mock API
    mockAPI = new SPKAPI('https://test.node') as jest.Mocked<SPKAPI>;
    
    // Create account instance
    account = new SPKAccount('testuser', {
      node: 'https://test.node'
    });
    
    // Replace the internal API with our mock
    (account as any).api = mockAPI;
  });

  describe('constructor', () => {
    it('should initialize with username and default options', () => {
      const acc = new SPKAccount('alice');
      expect(acc.username).toBe('alice');
      expect(acc.node).toBe('https://spktest.dlux.io');
    });

    it('should accept custom node URL', () => {
      const acc = new SPKAccount('bob', { node: 'https://custom.node' });
      expect(acc.node).toBe('https://custom.node');
    });
  });

  describe('init', () => {
    it('should load account data from API', async () => {
      const mockAccountData = {
        balance: 1000,
        spk: 500,
        broca: '250000,1000',
        poweredUp: 100,
        pubKey: 'STM8...',
        contracts: [],
        file_contracts: {}
      };

      mockAPI.get.mockResolvedValue(mockAccountData);

      await account.init();

      expect(mockAPI.get).toHaveBeenCalledWith('/@testuser');
      expect(account.balance).toBe(1000);
      expect(account.spk).toBe(500);
      expect(account.pubKey).toBe('STM8...');
    });

    it('should handle API errors gracefully', async () => {
      mockAPI.get.mockRejectedValue(new Error('Network error'));

      await expect(account.init()).rejects.toThrow('Failed to initialize account: Network error');
    });

    it('should detect Hive Keychain if available', async () => {
      // Mock window.hive_keychain
      (global as any).window = {
        hive_keychain: {
          requestSignBuffer: jest.fn()
        }
      };

      mockAPI.get.mockResolvedValue({ balance: 1000 });

      await account.init();

      expect(account.hasKeychain).toBe(true);
    });
  });

  describe('getBalances', () => {
    it('should return current token balances', async () => {
      account.balance = 1000;
      account.spk = 500;
      account.broca = '250000,1000';

      const balances = await account.getBalances();

      expect(balances).toEqual({
        larynx: 1000,
        spk: 500,
        broca: 250000
      });
    });

    it('should refresh balances if requested', async () => {
      mockAPI.get.mockResolvedValue({
        balance: 2000,
        spk: 1000,
        broca: '500000,2000'
      });

      const balances = await account.getBalances(true);

      expect(mockAPI.get).toHaveBeenCalledWith('/@testuser');
      expect(balances).toEqual({
        larynx: 2000,
        spk: 1000,
        broca: 500000
      });
    });
  });

  describe('sendLarynx', () => {
    beforeEach(() => {
      account.balance = 1000;
      account.hasKeychain = true;
      (global as any).window = {
        hive_keychain: {
          requestSignBuffer: jest.fn((_username, _message, _method, callback) => {
            callback(null, { signature: 'test_signature' });
          }),
          requestCustomJson: jest.fn((_username, _id, _method, _json, _display, callback) => {
            callback(null, { success: true });
          })
        }
      };
    });

    it('should send LARYNX tokens to another account', async () => {
      mockAPI.post.mockResolvedValue({ success: true });

      const result = await account.sendLarynx(100, 'alice', 'Test transfer');

      expect(result.success).toBe(true);
      expect(window.hive_keychain.requestCustomJson).toHaveBeenCalledWith(
        'testuser',
        'spkcc_send',
        'Active',
        expect.stringContaining('"amount":100'),
        expect.any(String),
        expect.any(Function)
      );
    });

    it('should reject if insufficient balance', async () => {
      account.balance = 50;

      await expect(account.sendLarynx(100, 'alice')).rejects.toThrow('Insufficient balance');
    });

    it('should reject if no keychain available', async () => {
      account.hasKeychain = false;

      await expect(account.sendLarynx(100, 'alice')).rejects.toThrow('Hive Keychain not available');
    });

    it('should validate recipient account exists', async () => {
      // For this test, assume we have a checkAccount method
      mockAPI.get.mockResolvedValueOnce(null); // Account doesn't exist

      await expect(account.sendLarynx(100, 'invalid_user')).rejects.toThrow('Invalid recipient account');
    });
  });

  describe('powerUp', () => {
    beforeEach(() => {
      account.balance = 1000;
      account.hasKeychain = true;
      (global as any).window = {
        hive_keychain: {
          requestCustomJson: jest.fn((_username, _id, _method, _json, _display, callback) => {
            callback(null, { success: true });
          })
        }
      };
    });

    it('should power up LARYNX tokens', async () => {
      const result = await account.powerUp(100);

      expect(result.success).toBe(true);
      expect(window.hive_keychain.requestCustomJson).toHaveBeenCalledWith(
        'testuser',
        'spkcc_power_up',
        'Active',
        expect.stringContaining('"amount":100'),
        expect.any(String),
        expect.any(Function)
      );
    });

    it('should reject if amount exceeds balance', async () => {
      await expect(account.powerUp(2000)).rejects.toThrow('Insufficient balance');
    });
  });

  describe('calculateBroca', () => {
    it('should calculate available BROCA correctly', () => {
      account.broca = '100000,5000'; // current,block
      account.spk_power = 1000;
      
      const currentBlock = 6000;
      const available = account.calculateBroca(currentBlock);
      
      // 100000 + (1000 * 0.0001 * (6000 - 5000)) = 100000 + 100 = 100100
      expect(available).toBe(100100);
    });

    it('should cap BROCA at spk_power', () => {
      account.broca = '900,5000';
      account.spk_power = 1000;
      
      const currentBlock = 15000; // Large block difference
      const available = account.calculateBroca(currentBlock);
      
      expect(available).toBe(1000); // Capped at spk_power
    });
  });

  describe('registerPublicKey', () => {
    it('should register public key on first use', async () => {
      account.pubKey = 'NA';
      mockAPI.post.mockResolvedValue({ success: true });
      
      (global as any).window = {
        hive_keychain: {
          requestSignBuffer: jest.fn((_username, _message, _method, callback) => {
            callback(null, { 
              signature: 'test_signature',
              publicKey: 'STM8TestPublicKey'
            });
          })
        }
      };

      await account.registerPublicKey();

      expect(mockAPI.post).toHaveBeenCalledWith(
        '/api/register',
        expect.objectContaining({
          account: 'testuser',
          pubKey: 'STM8TestPublicKey'
        }),
        expect.any(Object)
      );
    });

    it('should skip if already registered', async () => {
      account.pubKey = 'STM8ExistingKey';

      await account.registerPublicKey();

      expect(mockAPI.post).not.toHaveBeenCalled();
    });
  });
});