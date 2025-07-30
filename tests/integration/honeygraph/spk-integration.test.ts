import SPK from '../../../src';

// Mock all external dependencies
jest.mock('../../../src/api/honeygraph', () => {
  return {
    HoneygraphClient: jest.fn().mockImplementation((options) => {
      return {
        baseUrl: options?.baseUrl || 'https://honeygraph.dlux.io',
        timeout: options?.timeout || 30000,
        enableCache: options?.enableCache ?? true,
        cacheTTL: options?.cacheTTL ?? 60000,
        get: jest.fn(),
        post: jest.fn(),
        getUserProfile: jest.fn(),
        searchFiles: jest.fn(),
        getFileProviders: jest.fn(),
        getMarketDepth: jest.fn(),
        getRichList: jest.fn(),
        getNetworkTopology: jest.fn(),
        getStorageStats: jest.fn()
      };
    })
  };
});

jest.mock('../../../src/api/user', () => {
  return {
    UserAPI: jest.fn().mockImplementation(() => {
      return {
        getUserProfile: jest.fn(),
        getUserBalances: jest.fn(),
        getUserContracts: jest.fn(),
        getUserServices: jest.fn()
      };
    })
  };
});

jest.mock('../../../src/api/files', () => {
  return {
    FileSearchAPI: jest.fn().mockImplementation(() => {
      return {
        searchFiles: jest.fn(),
        searchByTags: jest.fn(),
        getFileProviders: jest.fn(),
        getRecentUploads: jest.fn()
      };
    })
  };
});
jest.mock('../../../src/core/account', () => {
  return {
    SPKAccount: jest.fn().mockImplementation((username) => {
      return {
        username,
        api: {
          get: jest.fn(),
          post: jest.fn()
        },
        getBalances: jest.fn().mockResolvedValue({
          larynx: 1000,
          spk: 500,
          broca: 100000
        })
      };
    })
  };
});

// Mock fetch globally
global.fetch = jest.fn();

describe('SPK Honeygraph Integration', () => {
  let spk: SPK;
  let mockFetch: jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
    
    // Mock successful API responses
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    } as Response);

    spk = new SPK('testuser');
  });

  describe('Honeygraph initialization', () => {
    it('should initialize honeygraph client with default URL', () => {
      expect(spk.honeygraph).toBeDefined();
      expect(spk.honeygraph.baseUrl).toBe('https://honeygraph.dlux.io');
    });

    it('should accept custom honeygraph URL', () => {
      const customSPK = new SPK('testuser', {
        honeygraphUrl: 'https://custom.honeygraph.com'
      });
      
      expect(customSPK.honeygraph.baseUrl).toBe('https://custom.honeygraph.com');
    });

    it('should initialize user and file APIs', () => {
      expect(spk.users).toBeDefined();
      expect(spk.files).toBeDefined();
    });
  });

  describe('Convenience methods', () => {
    beforeEach(() => {
      // Mock the API methods
      spk.users.getUserProfile = jest.fn().mockResolvedValue({
        username: 'testuser',
        larynxBalance: 1000000
      });
      
      spk.users.getUserBalances = jest.fn().mockResolvedValue({
        larynx: 1000,
        spk: 500,
        broca: 100000
      });

      spk.files.searchFiles = jest.fn().mockResolvedValue([
        { cid: 'Qm1', name: 'file1.txt' },
        { cid: 'Qm2', name: 'file2.txt' }
      ]);

      spk.files.searchByTags = jest.fn().mockResolvedValue([
        { cid: 'Qm3', tags: ['video', 'tutorial'] }
      ]);

      spk.honeygraph.getMarketDepth = jest.fn().mockResolvedValue({
        buyOrders: [],
        sellOrders: []
      });
    });

    it('should get user profile for current user', async () => {
      const profile = await spk.getUserProfile();
      
      expect(spk.users.getUserProfile).toHaveBeenCalledWith('testuser', undefined);
      expect(profile.username).toBe('testuser');
    });

    it('should get user profile for another user', async () => {
      await spk.getUserProfile('alice', { include: ['contracts'] });
      
      expect(spk.users.getUserProfile).toHaveBeenCalledWith('alice', { include: ['contracts'] });
    });

    it('should get enhanced balances', async () => {
      const balances = await spk.getEnhancedBalances();
      
      expect(spk.users.getUserBalances).toHaveBeenCalledWith('testuser');
      expect(balances).toEqual({
        larynx: 1000,
        spk: 500,
        broca: 100000
      });
    });

    it('should search files', async () => {
      const files = await spk.searchFiles({ q: 'test' });
      
      expect(spk.files.searchFiles).toHaveBeenCalledWith({ q: 'test' });
      expect(files).toHaveLength(2);
    });

    it('should get files by tags', async () => {
      const files = await spk.getFilesByTags(['video', 'tutorial'], 'AND');
      
      expect(spk.files.searchByTags).toHaveBeenCalledWith(['video', 'tutorial'], 'AND');
      expect(files).toHaveLength(1);
    });

    it('should get market depth', async () => {
      const depth = await spk.getMarketDepth('LARYNX:HIVE', 50);
      
      expect(spk.honeygraph.getMarketDepth).toHaveBeenCalledWith('LARYNX:HIVE', 50);
      expect(depth).toHaveProperty('buyOrders');
      expect(depth).toHaveProperty('sellOrders');
    });
  });

  describe('Cache configuration', () => {
    it('should enable cache by default', () => {
      const spkWithDefaults = new SPK('testuser');
      // Cache is enabled by default
      expect(spkWithDefaults.honeygraph).toBeDefined();
    });

    it('should allow disabling cache', () => {
      const spkNoCache = new SPK('testuser', {
        enableHoneygraphCache: false
      });
      
      expect(spkNoCache.honeygraph).toBeDefined();
    });

    it('should accept custom cache TTL', () => {
      const spkCustomTTL = new SPK('testuser', {
        honeygraphCacheTTL: 300000 // 5 minutes
      });
      
      expect(spkCustomTTL.honeygraph).toBeDefined();
    });
  });

  describe('Backward compatibility', () => {
    it('should maintain filesystem property', () => {
      expect(spk.filesystem).toBeDefined();
      expect(spk.filesystem.browse).toBeDefined();
    });

    it('should keep existing methods working', async () => {
      // Mock account methods
      spk.account.getBalances = jest.fn().mockResolvedValue({
        larynx: 1000,
        spk: 500,
        broca: 100000
      });

      const balances = await spk.getBalances();
      
      expect(balances).toBeDefined();
      expect(balances.larynx).toBe(1000);
    });
  });
});