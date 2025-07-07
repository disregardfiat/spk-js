import { SPKAPI } from '../../../src/core/api';

// Mock fetch globally
global.fetch = jest.fn();

describe('SPKAPI', () => {
  let api: SPKAPI;
  let mockFetch: jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
    api = new SPKAPI('https://test.node');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default node if not provided', () => {
      const defaultApi = new SPKAPI();
      expect(defaultApi.node).toBe('https://spktest.dlux.io');
    });

    it('should use provided node URL', () => {
      expect(api.node).toBe('https://test.node');
    });
  });

  describe('get', () => {
    it('should make GET request to correct endpoint', async () => {
      const mockResponse = { data: 'test' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await api.get('/test-endpoint');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.node/test-endpoint',
        expect.objectContaining({
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle query parameters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      await api.get('/test', { foo: 'bar', baz: 123 });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.node/test?foo=bar&baz=123',
        expect.any(Object)
      );
    });

    it('should throw error on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as Response);

      await expect(api.get('/not-found')).rejects.toThrow('API Error: 404 Not Found');
    }, 10000);

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network failure'));

      await expect(api.get('/test')).rejects.toThrow('Network failure');
    }, 10000);
  });

  describe('post', () => {
    it('should make POST request with data', async () => {
      const postData = { key: 'value' };
      const mockResponse = { success: true };
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await api.post('/test-endpoint', postData);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.node/test-endpoint',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(postData),
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should include authentication headers when provided', async () => {
      const auth = {
        account: 'testuser',
        signature: 'test_sig',
        timestamp: '1234567890',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      await api.post('/auth-endpoint', { data: 'test' }, auth);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.node/auth-endpoint',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'x-account': 'testuser',
            'x-signature': 'test_sig',
            'x-timestamp': '1234567890',
          }),
        })
      );
    });
  });

  describe('delete', () => {
    it('should make DELETE request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ deleted: true }),
      } as Response);

      const result = await api.delete('/test/123');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.node/test/123',
        expect.objectContaining({
          method: 'DELETE',
        })
      );
      expect(result).toEqual({ deleted: true });
    });
  });

  describe('request', () => {
    it('should handle timeout', async () => {
      // Mock fetch to throw an AbortError
      mockFetch.mockImplementationOnce(() => {
        const error = new Error('The operation was aborted');
        error.name = 'AbortError';
        throw error;
      });

      // Set a short timeout
      api.timeout = 100;

      await expect(api.get('/timeout-test')).rejects.toThrow('Request timeout');
    }, 10000);

    it('should retry on failure', async () => {
      // First call fails, second succeeds
      mockFetch
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true }),
        } as Response);

      const result = await api.get('/retry-test');

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ success: true });
    });

    it('should respect max retries', async () => {
      // All calls fail
      mockFetch.mockRejectedValue(new Error('Persistent failure'));

      await expect(api.get('/fail-test')).rejects.toThrow('Persistent failure');
      
      // Default max retries is 3
      expect(mockFetch).toHaveBeenCalledTimes(3);
    }, 10000);
  });

  describe('specialized endpoints', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);
    });

    it('should have getAccount method', async () => {
      await api.getAccount('testuser');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.node/@testuser',
        expect.any(Object)
      );
    });

    it('should have getFileContract method', async () => {
      await api.getFileContract('contract123');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.node/api/fileContract/contract123',
        expect.any(Object)
      );
    });

    it('should have getFileByCID method', async () => {
      await api.getFileByCID('QmXxx');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.node/api/file/QmXxx',
        expect.any(Object)
      );
    });

    it('should have getServices method', async () => {
      await api.getServices('IPFS');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.node/services/IPFS',
        expect.any(Object)
      );
    });

    it('should have getStats method', async () => {
      await api.getStats();
      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.node/stats',
        expect.any(Object)
      );
    });
  });
});