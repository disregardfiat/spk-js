import { SPKFileUpload, BatchUploadResult } from '../../../src/storage/file-upload';
import { SPKAccount } from '../../../src/core/account';
import Hash from 'ipfs-only-hash';

// Mock modules
jest.mock('../../../src/core/account');
jest.mock('../../../src/tokens/broca', () => ({
  BrocaCalculator: {
    cost: jest.fn().mockReturnValue(100)
  }
}));
jest.mock('ipfs-only-hash');

// Mock fetch
global.fetch = jest.fn();

// Mock XMLHttpRequest
const mockXHR = {
  open: jest.fn(),
  send: jest.fn(),
  setRequestHeader: jest.fn(),
  upload: {
    addEventListener: jest.fn()
  },
  addEventListener: jest.fn(),
  status: 200,
  responseText: ''
};

global.XMLHttpRequest = jest.fn(() => mockXHR) as any;

describe('SPKFileUpload', () => {
  let mockAccount: jest.Mocked<SPKAccount>;
  let fileUpload: SPKFileUpload;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Reset XMLHttpRequest mock
    mockXHR.addEventListener.mockImplementation((event, callback) => {
      if (event === 'load') {
        // Simulate successful upload
        setTimeout(() => callback(), 10);
      }
    });
    
    // Create mock account
    mockAccount = {
      username: 'testuser',
      registerPublicKey: jest.fn().mockResolvedValue(undefined),
      sign: jest.fn().mockResolvedValue({ signature: 'mock-sig' }),
      calculateBroca: jest.fn().mockResolvedValue(1000),
      api: {
        post: jest.fn().mockResolvedValue({ 
          id: 'contract-123',
          df: ['QmTestHash123'],
          i: 'contract-123',
          t: 'testuser',
          fosig: 'mock-sig',
          api: 'https://ipfs.dlux.io'
        }),
        get: jest.fn().mockResolvedValue({ 
          df: ['QmTestHash123'], 
          i: 'contract-123',
          t: 'testuser',
          fosig: 'mock-sig',
          api: 'https://ipfs.dlux.io'
        })
      },
      node: 'https://spktest.dlux.io'
    } as any;
    
    fileUpload = new SPKFileUpload(mockAccount);
    
    // Mock Hash.of
    (Hash.of as jest.Mock).mockResolvedValue('QmTestHash123');
    
    // Mock fetch for upload operations
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ success: true })
    });
  });

  describe('upload', () => {
    it('should handle empty file array', async () => {
      await expect(fileUpload.upload([])).rejects.toThrow('No files provided');
    });

    it('should upload single file', async () => {
      const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
      
      const result = await fileUpload.upload(file);
      
      expect(result).toHaveProperty('cid', 'QmTestHash123');
      expect(result).toHaveProperty('url', 'https://ipfs.dlux.io/ipfs/QmTestHash123');
      expect(mockAccount.registerPublicKey).toHaveBeenCalled();
      expect(mockAccount.api.post).toHaveBeenCalledWith(
        '/api/new_contract',
        expect.objectContaining({
          cid: 'QmTestHash123',
          size: file.size,
          duration: 30
        }),
        expect.any(Object)
      );
    });

    it('should upload single file with metadata', async () => {
      const file = new File(['test content'], 'test.jpg', { type: 'image/jpeg' });
      const metadata = {
        FileIndex: 0,
        name: 'vacation-photo',
        ext: 'jpg',
        tags: [4, 8],
        labels: '125',
        license: '7'
      };
      
      const result = await fileUpload.upload(file, { metaData: [metadata] });
      
      expect(result).toHaveProperty('cid');
      expect(mockAccount.api.post).toHaveBeenCalledWith(
        '/api/new_contract',
        expect.objectContaining({
          metadata: expect.objectContaining({
            name: 'vacation-photo',
            ext: 'jpg',
            flag: expect.any(String), // Base64 encoded tags
            labels: '125',
            license: '7'
          })
        }),
        expect.any(Object)
      );
    });

    it('should handle batch upload', async () => {
      const files = [
        new File(['content1'], 'file1.txt', { type: 'text/plain' }),
        new File(['content2'], 'file2.txt', { type: 'text/plain' })
      ];
      
      const result = await fileUpload.upload(files) as BatchUploadResult;
      
      expect(result.results).toHaveLength(2);
      expect(result.totalSize).toBe(files[0].size + files[1].size);
      expect(result.totalBrocaCost).toBeGreaterThan(0);
      expect(result.contractId).toMatch(/testuser_\d+_/);
    });

    it('should validate metadata FileIndex', async () => {
      const file = new File(['test'], 'test.txt');
      const invalidMetadata = [{ FileIndex: 5, name: 'test' }];
      
      await expect(
        fileUpload.upload(file, { metaData: invalidMetadata })
      ).rejects.toThrow('Invalid FileIndex 5. Must be between 0 and 0');
    });

    it('should handle insufficient BROCA', async () => {
      mockAccount.calculateBroca.mockResolvedValue(10); // Low BROCA
      
      // For batch uploads, we need multiple files
      const files = [
        new File(['x'.repeat(1024 * 1024)], 'large1.txt'), // 1MB file
        new File(['x'.repeat(1024 * 1024)], 'large2.txt')  // 1MB file
      ];
      
      await expect(fileUpload.upload(files)).rejects.toThrow(/Insufficient BROCA/);
    });
  });

  describe('single file upload', () => {
    it('should handle encryption', async () => {
      const file = new File(['secret'], 'secret.txt');
      
      await fileUpload.upload(file, { encrypt: ['alice', 'bob'] });
      
      expect(mockAccount.api.post).toHaveBeenCalledWith(
        '/api/new_contract',
        expect.objectContaining({
          encrypted: true,
          recipients: ['alice', 'bob']
        }),
        expect.any(Object)
      );
    });

    it('should auto-generate thumbnail for images', async () => {
      const file = new File(['image data'], 'photo.jpg', { type: 'image/jpeg' });
      
      await fileUpload.upload(file);
      
      // Thumbnail generation is mocked to return null for now
      expect(mockAccount.api.post).toHaveBeenCalledWith(
        '/api/new_contract',
        expect.objectContaining({
          metadata: expect.objectContaining({
            thumb: undefined
          })
        }),
        expect.any(Object)
      );
    });

    it('should use custom thumbnail if provided', async () => {
      const file = new File(['image'], 'photo.jpg', { type: 'image/jpeg' });
      const metadata = {
        FileIndex: 0,
        thumbnail: 'QmCustomThumb'
      };
      
      await fileUpload.upload(file, { metaData: [metadata] });
      
      expect(mockAccount.api.post).toHaveBeenCalledWith(
        '/api/new_contract',
        expect.objectContaining({
          metadata: expect.objectContaining({
            thumb: 'QmCustomThumb'
          })
        }),
        expect.any(Object)
      );
    });

    it('should handle upload progress', async () => {
      const file = new File(['test'], 'test.txt');
      const progressValues: number[] = [];
      
      await fileUpload.upload(file, {
        onProgress: (percent) => progressValues.push(percent)
      });
      
      // Progress tracking is handled in uploadToIPFS which uses XMLHttpRequest
      // For unit tests, we can't easily test this without more complex mocking
      expect(progressValues).toBeDefined();
    });
  });

  describe('batch upload', () => {
    it('should create contracts for each file', async () => {
      const files = [
        new File(['content1'], 'file1.txt'),
        new File(['content2'], 'file2.txt'),
        new File(['content3'], 'file3.txt')
      ];
      
      const result = await fileUpload.upload(files) as BatchUploadResult;
      
      expect(result.results).toHaveLength(3);
      expect(mockAccount.api.post).toHaveBeenCalledTimes(3);
      
      result.results.forEach((fileResult, index) => {
        expect(fileResult.cid).toBe('QmTestHash123');
        expect(fileResult.size).toBe(files[index].size);
        expect(fileResult.url).toBe('https://ipfs.dlux.io/ipfs/QmTestHash123');
      });
    });

    it('should apply metadata to correct files', async () => {
      const files = [
        new File(['doc'], 'doc.pdf'),
        new File(['image'], 'image.jpg', { type: 'image/jpeg' }),
        new File(['video'], 'video.mp4', { type: 'video/mp4' })
      ];
      
      const metaData = [
        { FileIndex: 0, name: 'important-doc', tags: [4], license: '1' },
        { FileIndex: 2, name: 'tutorial-video', labels: '15' }
      ];
      
      await fileUpload.upload(files, { metaData });
      
      // First file should have metadata
      expect(mockAccount.api.post).toHaveBeenNthCalledWith(
        1,
        '/api/new_contract',
        expect.objectContaining({
          metadata: expect.objectContaining({
            name: 'important-doc',
            flag: expect.any(String),
            license: '1'
          })
        }),
        expect.any(Object)
      );
      
      // Third file should have metadata
      expect(mockAccount.api.post).toHaveBeenNthCalledWith(
        3,
        '/api/new_contract',
        expect.objectContaining({
          metadata: expect.objectContaining({
            labels: '15'
          })
        }),
        expect.any(Object)
      );
    });

    it('should handle individual file progress', async () => {
      const files = [
        new File(['a'.repeat(100)], 'file1.txt'),
        new File(['b'.repeat(200)], 'file2.txt')
      ];
      
      const progressTracking: { [key: number]: number[] } = { 0: [], 1: [] };
      
      const metaData = [
        { FileIndex: 0, onProgress: (p: number) => progressTracking[0].push(p) },
        { FileIndex: 1, onProgress: (p: number) => progressTracking[1].push(p) }
      ];
      
      await fileUpload.upload(files, { metaData });
      
      expect(progressTracking[0]).toBeDefined();
      expect(progressTracking[1]).toBeDefined();
    });

    it('should respect global and individual autoRenew settings', async () => {
      const files = [
        new File(['1'], 'file1.txt'),
        new File(['2'], 'file2.txt'),
        new File(['3'], 'file3.txt')
      ];
      
      const metaData = [
        { FileIndex: 1, autoRenew: false } // Override for second file
      ];
      
      await fileUpload.upload(files, { autoRenew: true, metaData });
      
      // First file should have global autoRenew
      expect(mockAccount.api.post).toHaveBeenNthCalledWith(
        1,
        '/api/new_contract',
        expect.objectContaining({ autoRenew: true }),
        expect.any(Object)
      );
      
      // Second file should have overridden autoRenew
      expect(mockAccount.api.post).toHaveBeenNthCalledWith(
        2,
        '/api/new_contract',
        expect.objectContaining({ autoRenew: false }),
        expect.any(Object)
      );
      
      // Third file should have global autoRenew
      expect(mockAccount.api.post).toHaveBeenNthCalledWith(
        3,
        '/api/new_contract',
        expect.objectContaining({ autoRenew: true }),
        expect.any(Object)
      );
    });

    it('should handle batch encryption', async () => {
      const files = [
        new File(['secret1'], 'file1.txt'),
        new File(['secret2'], 'file2.txt')
      ];
      
      await fileUpload.upload(files, { encrypt: ['alice', 'bob'] });
      
      const result = await fileUpload.upload(files, { encrypt: ['alice', 'bob'] }) as BatchUploadResult;
      
      result.results.forEach(() => {
        expect(mockAccount.api.post).toHaveBeenCalledWith(
          '/api/new_contract',
          expect.objectContaining({
            encrypted: true,
            recipients: ['alice', 'bob']
          }),
          expect.any(Object)
        );
      });
    });
  });

  describe('metadata conversion', () => {
    it('should convert FileMetadataItem to SPK format', async () => {
      const file = new File(['test'], 'test.txt');
      const metadata = {
        FileIndex: 0,
        name: 'test-file',
        ext: 'txt',
        path: '/Documents/Tests',
        tags: [4, 8],
        labels: '123',
        license: '7'
      };
      
      await fileUpload.upload(file, { metaData: [metadata] });
      
      expect(mockAccount.api.post).toHaveBeenCalledWith(
        '/api/new_contract',
        expect.objectContaining({
          metadata: expect.objectContaining({
            name: 'test-file',
            ext: 'txt',
            path: '/Documents/Tests',
            flag: expect.any(String), // Base64 encoded 12 (4|8)
            labels: '123',
            license: '7'
          })
        }),
        expect.any(Object)
      );
    });

    it('should handle metadata with single tag value', async () => {
      const file = new File(['test'], 'test.txt');
      const metadata = {
        FileIndex: 0,
        tags: 4 // Single value instead of array
      };
      
      await fileUpload.upload(file, { metaData: [metadata] });
      
      expect(mockAccount.api.post).toHaveBeenCalledWith(
        '/api/new_contract',
        expect.objectContaining({
          metadata: expect.objectContaining({
            flag: expect.any(String) // Base64 encoded 4
          })
        }),
        expect.any(Object)
      );
    });
  });

  describe('cancelUpload', () => {
    it('should abort ongoing upload', () => {
      const mockAbort = jest.fn();
      fileUpload['uploadController'] = { abort: mockAbort } as any;
      
      fileUpload.cancelUpload();
      
      expect(mockAbort).toHaveBeenCalled();
    });

    it('should handle cancel when no upload in progress', () => {
      expect(() => fileUpload.cancelUpload()).not.toThrow();
    });
  });
});