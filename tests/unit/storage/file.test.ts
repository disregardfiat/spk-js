import { SPKFile } from '../../../src/storage/file';
import { SPKAccount } from '../../../src/core/account';
import Hash from 'ipfs-only-hash';

// Mock dependencies
jest.mock('ipfs-only-hash');
jest.mock('../../../src/core/account');

describe('SPKFile', () => {
  let file: SPKFile;
  let mockAccount: jest.Mocked<SPKAccount>;
  let mockHash: jest.MockedFunction<typeof Hash.of>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockAccount = new SPKAccount('testuser') as jest.Mocked<SPKAccount>;
    mockHash = Hash.of as jest.MockedFunction<typeof Hash.of>;
    
    file = new SPKFile(mockAccount);
  });

  describe('hash', () => {
    it('should generate IPFS hash for file', async () => {
      const testFile = new File(['test content'], 'test.txt', { type: 'text/plain' });
      const expectedCID = 'QmTest123';
      
      mockHash.mockResolvedValue(expectedCID);

      const cid = await SPKFile.hash(testFile);

      expect(cid).toBe(expectedCID);
      expect(mockHash).toHaveBeenCalledWith(expect.any(Buffer));
    });

    it('should handle large files', async () => {
      // Create a 10MB file
      const largeContent = new Uint8Array(10 * 1024 * 1024);
      const largeFile = new File([largeContent], 'large.bin', { type: 'application/octet-stream' });
      
      mockHash.mockResolvedValue('QmLarge456');

      const cid = await SPKFile.hash(largeFile);

      expect(cid).toBe('QmLarge456');
    });

    it('should throw error for invalid file', async () => {
      await expect(SPKFile.hash(null as any)).rejects.toThrow('Invalid file');
    });
  });

  describe('createContract', () => {
    beforeEach(() => {
      mockAccount.api = {
        post: jest.fn().mockResolvedValue({ 
          id: 'contract123',
          success: true 
        })
      } as any;
    });

    it('should create storage contract for file', async () => {
      const fileData = {
        cid: 'QmTest123',
        size: 1024,
        duration: 30
      };

      const contract = await file.createContract(fileData);

      expect(contract).toEqual({
        id: 'contract123',
        success: true
      });
      
      expect(mockAccount.api.post).toHaveBeenCalledWith(
        '/api/fileContract',
        expect.objectContaining({
          cid: 'QmTest123',
          size: 1024,
          duration: 30
        }),
        expect.any(Object)
      );
    });

    it('should calculate BROCA cost', async () => {
      const fileData = {
        cid: 'QmTest123',
        size: 1000000, // 1MB
        duration: 30
      };

      await file.createContract(fileData);

      expect(mockAccount.api.post).toHaveBeenCalledWith(
        '/api/fileContract',
        expect.objectContaining({
          broca_cost: 30000 // 1MB * 30 days * 0.001
        }),
        expect.any(Object)
      );
    });

    it('should support auto-renewal option', async () => {
      const fileData = {
        cid: 'QmTest123',
        size: 1024,
        duration: 30,
        autoRenew: true
      };

      await file.createContract(fileData);

      expect(mockAccount.api.post).toHaveBeenCalledWith(
        '/api/fileContract',
        expect.objectContaining({
          autoRenew: true
        }),
        expect.any(Object)
      );
    });

    it('should reject if insufficient BROCA', async () => {
      mockAccount.calculateBroca = jest.fn().mockReturnValue(1000);
      
      const fileData = {
        cid: 'QmTest123',
        size: 10000000, // 10MB = 300,000 BROCA needed
        duration: 30
      };

      await expect(file.createContract(fileData)).rejects.toThrow('Insufficient BROCA');
    });
  });

  describe('upload', () => {
    let mockFile: File;
    let mockProgress: jest.Mock;

    beforeEach(() => {
      mockFile = new File(['test content'], 'test.txt', { type: 'text/plain' });
      mockProgress = jest.fn();
      
      // Mock successful hash
      mockHash.mockResolvedValue('QmTest123');
      
      // Mock successful contract creation
      mockAccount.api = {
        post: jest.fn().mockResolvedValue({ 
          id: 'contract123',
          success: true 
        })
      } as any;
      
      // Mock XMLHttpRequest for upload
      const mockXHR = {
        open: jest.fn(),
        setRequestHeader: jest.fn(),
        send: jest.fn(),
        upload: {
          addEventListener: jest.fn((event, handler) => {
            if (event === 'progress') {
              // Simulate progress events
              setTimeout(() => handler({ loaded: 50, total: 100 }), 10);
              setTimeout(() => handler({ loaded: 100, total: 100 }), 20);
            }
          })
        },
        addEventListener: jest.fn((event, handler) => {
          if (event === 'load') {
            setTimeout(() => {
              mockXHR.status = 200;
              mockXHR.responseText = JSON.stringify({ success: true });
              handler();
            }, 30);
          }
        }),
        status: 0,
        responseText: ''
      };
      
      global.XMLHttpRequest = jest.fn(() => mockXHR) as any;
    });

    it('should upload file with progress tracking', async () => {
      const result = await file.upload(mockFile, {
        onProgress: mockProgress
      });

      expect(result).toEqual({
        cid: 'QmTest123',
        contract: { id: 'contract123', success: true },
        size: mockFile.size,
        url: 'https://ipfs.dlux.io/ipfs/QmTest123'
      });

      // Check progress callbacks
      expect(mockProgress).toHaveBeenCalledWith(50);
      expect(mockProgress).toHaveBeenCalledWith(100);
    });

    it('should support chunked upload for large files', async () => {
      // Create a 5MB file
      const largeContent = new Uint8Array(5 * 1024 * 1024);
      const largeFile = new File([largeContent], 'large.bin');
      
      const result = await file.upload(largeFile, {
        chunkSize: 1024 * 1024 // 1MB chunks
      });

      expect(result.cid).toBe('QmTest123');
      // Should have made 5 chunk uploads
      expect(global.XMLHttpRequest).toHaveBeenCalledTimes(5);
    });

    it('should handle upload errors', async () => {
      const mockXHR = {
        open: jest.fn(),
        setRequestHeader: jest.fn(),
        send: jest.fn(),
        upload: { addEventListener: jest.fn() },
        addEventListener: jest.fn((event, handler) => {
          if (event === 'error') {
            setTimeout(() => handler(), 10);
          }
        })
      };
      
      global.XMLHttpRequest = jest.fn(() => mockXHR) as any;

      await expect(file.upload(mockFile)).rejects.toThrow('Upload failed');
    });

    it('should support upload cancellation', async () => {
      const uploadPromise = file.upload(mockFile);
      
      // Cancel after 5ms
      setTimeout(() => file.cancelUpload(), 5);

      await expect(uploadPromise).rejects.toThrow('Upload cancelled');
    });
  });

  describe('encryption', () => {
    it('should encrypt file before upload', async () => {
      const testFile = new File(['secret content'], 'secret.txt');
      const recipients = ['alice', 'bob'];
      
      // Mock encryption
      const mockEncrypt = jest.fn().mockResolvedValue({
        encryptedData: new Uint8Array([1, 2, 3]),
        encryptedKeys: {
          alice: 'encrypted_key_alice',
          bob: 'encrypted_key_bob'
        }
      });
      
      (file as any).encrypt = mockEncrypt;

      await file.upload(testFile, {
        encrypt: recipients
      });

      expect(mockEncrypt).toHaveBeenCalledWith(testFile, recipients);
    });

    it('should store encryption metadata', async () => {
      const testFile = new File(['secret content'], 'secret.txt');
      
      await file.upload(testFile, {
        encrypt: ['alice']
      });

      expect(mockAccount.api.post).toHaveBeenCalledWith(
        '/api/fileContract',
        expect.objectContaining({
          encrypted: true,
          recipients: ['alice']
        }),
        expect.any(Object)
      );
    });
  });

  describe('metadata', () => {
    it('should include metadata in contract', async () => {
      const testFile = new File(['content'], 'document.pdf');
      
      await file.upload(testFile, {
        folder: 'Documents',
        tags: ['important', 'work'],
        license: 'CC-BY-4.0'
      });

      expect(mockAccount.api.post).toHaveBeenCalledWith(
        '/api/fileContract',
        expect.objectContaining({
          metadata: {
            folder: 'Documents',
            tags: ['important', 'work'],
            license: 'CC-BY-4.0'
          }
        }),
        expect.any(Object)
      );
    });

    it('should generate thumbnail for images', async () => {
      const imageFile = new File(['image data'], 'photo.jpg', { type: 'image/jpeg' });
      
      // Mock thumbnail generation
      const mockGenerateThumbnail = jest.fn().mockResolvedValue('QmThumb789');
      (file as any).generateThumbnail = mockGenerateThumbnail;

      await file.upload(imageFile);

      expect(mockGenerateThumbnail).toHaveBeenCalledWith(imageFile);
      expect(mockAccount.api.post).toHaveBeenCalledWith(
        '/api/fileContract',
        expect.objectContaining({
          thumbnail: 'QmThumb789'
        }),
        expect.any(Object)
      );
    });
  });
});