import { HoneygraphClient } from '../../../src/api/honeygraph';

// Mock fetch globally
global.fetch = jest.fn();

describe('HoneygraphClient', () => {
  let client: HoneygraphClient;
  let mockFetch: jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
    client = new HoneygraphClient();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default baseUrl', () => {
      expect(client.baseUrl).toBe('https://honeygraph.dlux.io');
    });

    it('should accept custom baseUrl', () => {
      const customClient = new HoneygraphClient({ baseUrl: 'https://custom.honeygraph.com' });
      expect(customClient.baseUrl).toBe('https://custom.honeygraph.com');
    });

    it('should initialize with default timeout', () => {
      expect(client.timeout).toBe(30000);
    });

    it('should accept custom timeout', () => {
      const customClient = new HoneygraphClient({ timeout: 10000 });
      expect(customClient.timeout).toBe(10000);
    });
  });

  describe('request', () => {
    it('should make GET request to correct endpoint', async () => {
      const mockResponse = { data: 'test' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await client.get('/api/test');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://honeygraph.dlux.io/api/test',
        expect.objectContaining({
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle query parameters correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      await client.get('/api/test', { include: 'all', limit: 50 });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://honeygraph.dlux.io/api/test?include=all&limit=50',
        expect.any(Object)
      );
    });

    it('should handle POST requests with data', async () => {
      const postData = { key: 'value' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      await client.post('/api/test', postData);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://honeygraph.dlux.io/api/test',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify(postData),
        })
      );
    });

    it('should handle timeout properly', async () => {
      // Mock fetch to throw an AbortError
      mockFetch.mockImplementationOnce(() => {
        const error = new Error('The operation was aborted');
        error.name = 'AbortError';
        return Promise.reject(error);
      });

      const shortTimeoutClient = new HoneygraphClient({ timeout: 100 });

      await expect(shortTimeoutClient.get('/api/test')).rejects.toThrow('Request timeout');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(client.get('/api/test')).rejects.toThrow('Network error');
    });

    it('should handle non-ok responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => 'User not found',
      } as Response);

      await expect(client.get('/api/user/nonexistent')).rejects.toThrow(
        'Honeygraph API Error: 404 Not Found - User not found'
      );
    });

    it('should handle JSON parse errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON');
        },
        text: async () => 'Not JSON',
        headers: new Headers(),
        redirected: false,
        status: 200,
        statusText: 'OK',
        type: 'basic',
        url: 'https://honeygraph.dlux.io/api/test',
        clone: () => ({} as Response),
        body: null,
        bodyUsed: false,
        arrayBuffer: async () => new ArrayBuffer(0),
        blob: async () => new Blob(),
        formData: async () => new FormData(),
      } as Response);

      await expect(client.get('/api/test')).rejects.toThrow('Invalid JSON response');
    });
  });

  describe('specialized methods', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);
    });

    it('should have getUserProfile method', async () => {
      await client.getUserProfile('testuser');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://honeygraph.dlux.io/api/spk/user/testuser?include=all',
        expect.any(Object)
      );
    });

    it('should support getUserProfile with custom includes', async () => {
      await client.getUserProfile('testuser', { include: ['contracts', 'files'] });
      expect(mockFetch).toHaveBeenCalledWith(
        'https://honeygraph.dlux.io/api/spk/user/testuser?include=contracts%2Cfiles',
        expect.any(Object)
      );
    });

    it('should have searchFiles method', async () => {
      await client.searchFiles({ q: 'test', tags: 'video,tutorial' });
      expect(mockFetch).toHaveBeenCalledWith(
        'https://honeygraph.dlux.io/api/spk/files/search?q=test&tags=video%2Ctutorial',
        expect.any(Object)
      );
    });

    it('should have getStorageStats method', async () => {
      await client.getStorageStats();
      expect(mockFetch).toHaveBeenCalledWith(
        'https://honeygraph.dlux.io/api/spk/storage/stats',
        expect.any(Object)
      );
    });

    it('should have getMarketDepth method', async () => {
      await client.getMarketDepth('LARYNX:HIVE', 50);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://honeygraph.dlux.io/api/spk/dex/LARYNX:HIVE?depth=50',
        expect.any(Object)
      );
    });

    it('should have getRichList method', async () => {
      await client.getRichList('larynx', 100);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://honeygraph.dlux.io/api/spk/richlist/larynx?limit=100',
        expect.any(Object)
      );
    });

    it('should have getNetworkTopology method', async () => {
      await client.getNetworkTopology();
      expect(mockFetch).toHaveBeenCalledWith(
        'https://honeygraph.dlux.io/api/spk/network/topology',
        expect.any(Object)
      );
    });

    it('should have getFileSystem method', async () => {
      await client.getFileSystem('testuser', '/Documents');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://honeygraph.dlux.io/fs/testuser/Documents',
        expect.any(Object)
      );
    });
  });

  describe('error handling', () => {
    it('should provide meaningful error messages', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({ error: 'Invalid parameters' }),
      } as Response);

      await expect(client.get('/api/test')).rejects.toThrow(
        'Honeygraph API Error: 400 Bad Request - {"error":"Invalid parameters"}'
      );
    });

    it('should handle rate limiting', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: new Headers({
          'Retry-After': '60',
        }),
        text: async () => 'Rate limit exceeded',
        json: async () => { throw new Error('Not JSON'); },
        redirected: false,
        type: 'basic',
        url: 'https://honeygraph.dlux.io/api/test',
        clone: () => ({} as Response),
        body: null,
        bodyUsed: false,
        arrayBuffer: async () => new ArrayBuffer(0),
        blob: async () => new Blob(),
        formData: async () => new FormData(),
      } as Response);

      await expect(client.get('/api/test')).rejects.toThrow(
        'Honeygraph API Error: 429 Too Many Requests - Rate limit exceeded'
      );
    });
  });

  describe('caching', () => {
    it('should cache GET requests when enabled', async () => {
      const cachedClient = new HoneygraphClient({ enableCache: true });
      
      const mockResponse = { data: 'cached' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      // First call
      const result1 = await cachedClient.get('/api/test');
      expect(result1).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second call should use cache
      const result2 = await cachedClient.get('/api/test');
      expect(result2).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledTimes(1); // Still 1, not 2
    });

    it('should not cache POST requests', async () => {
      const cachedClient = new HoneygraphClient({ enableCache: true });
      
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      await cachedClient.post('/api/test', { data: 1 });
      await cachedClient.post('/api/test', { data: 1 });

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should respect cache TTL', async () => {
      const cachedClient = new HoneygraphClient({ 
        enableCache: true, 
        cacheTTL: 100 // 100ms
      });
      
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: 'test' }),
      } as Response);

      // First call
      await cachedClient.get('/api/test');
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      // Second call should fetch again
      await cachedClient.get('/api/test');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should clear cache on demand', async () => {
      const cachedClient = new HoneygraphClient({ enableCache: true });
      
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: 'test' }),
      } as Response);

      await cachedClient.get('/api/test');
      expect(mockFetch).toHaveBeenCalledTimes(1);

      cachedClient.clearCache();

      await cachedClient.get('/api/test');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});