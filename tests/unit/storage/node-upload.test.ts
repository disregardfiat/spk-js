import { SPKFileUpload, BatchUploadResult } from '../../../src/storage/file-upload';
import { SPKAccount } from '../../../src/core/account';
import Hash from 'ipfs-only-hash';
import { Buffer } from 'buffer';

// Mock modules
jest.mock('../../../src/core/account');
jest.mock('../../../src/tokens/broca', () => ({
  BrocaCalculator: {
    cost: jest.fn().mockReturnValue(100)
  }
}));
jest.mock('ipfs-only-hash');
jest.mock('../../../src/storage/contract-creator', () => ({
  SPKContractCreator: jest.fn().mockImplementation(() => ({
    createStorageContract: jest.fn().mockResolvedValue({
      success: true,
      contractId: 'contract-123',
      transactionId: 'tx-123',
      provider: {
        nodeId: 'node1',
        api: 'https://ipfs.dlux.io'
      },
      brocaCost: 100,
      size: 100,
      duration: 30
    }),
    getContractDetails: jest.fn().mockResolvedValue({
      i: 'contract-123',
      t: 'testuser',
      b: 'node1',
      api: 'https://ipfs.dlux.io',
      a: 100000,
      u: 0,
      c: 1,
      e: 1000000,
      r: 1
    })
  }))
}));

// Mock node-fetch for Node.js environment
jest.mock('node-fetch', () => jest.fn());
const fetch = require('node-fetch');

// Mock form-data for Node.js environment
jest.mock('form-data', () => {
  return jest.fn().mockImplementation(() => ({
    append: jest.fn(),
    getHeaders: jest.fn().mockReturnValue({
      'content-type': 'multipart/form-data; boundary=----formdata-boundary'
    })
  }));
});

// Node.js file-like object interface
interface NodeFileObject {
  name: string;
  size: number;
  type?: string;
  buffer: Buffer;
  arrayBuffer?: () => Promise<ArrayBuffer>;
}

// Mock global fetch for contract creator
global.fetch = jest.fn();

describe('SPKFileUpload - nodeUpload', () => {
  let mockAccount: jest.Mocked<SPKAccount>;
  let fileUpload: SPKFileUpload;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create mock account
    mockAccount = {
      username: 'testuser',
      registerPublicKey: jest.fn().mockResolvedValue(undefined),
      sign: jest.fn().mockResolvedValue('mock-sig'),
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
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ success: true }),
      text: jest.fn().mockResolvedValue('')
    });
    
    // Also set global fetch
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ success: true }),
      text: jest.fn().mockResolvedValue('')
    });
  });

  describe('nodeUpload', () => {
    it('should upload a single Node.js file-like object', async () => {
      const buffer = Buffer.from('test content');
      const file: NodeFileObject = {
        name: 'test.txt',
        size: buffer.length,
        type: 'text/plain',
        buffer: buffer
      };
      
      const result = await (fileUpload as any).nodeUpload(file);
      
      expect(result).toHaveProperty('cid', 'QmTestHash123');
      expect(result).toHaveProperty('url', 'https://ipfs.dlux.io/ipfs/QmTestHash123');
      expect(mockAccount.registerPublicKey).toHaveBeenCalled();
    });

    it('should handle file with arrayBuffer method', async () => {
      const buffer = Buffer.from('test content');
      const file: NodeFileObject = {
        name: 'test.txt',
        size: buffer.length,
        type: 'text/plain',
        buffer: buffer,
        arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
      };
      
      const result = await (fileUpload as any).nodeUpload(file);
      
      expect(result).toHaveProperty('cid');
      expect(Hash.of).toHaveBeenCalledWith(buffer);
    });

    it('should handle direct Buffer input', async () => {
      const buffer = Buffer.from('test content');
      
      // For direct buffer, we need to specify name and size
      const result = await (fileUpload as any).nodeUpload(buffer, {
        fileName: 'test.txt',
        fileType: 'text/plain'
      });
      
      expect(result).toHaveProperty('cid');
    });

    it('should handle batch upload of Node.js files', async () => {
      const files: NodeFileObject[] = [
        {
          name: 'file1.txt',
          size: 100,
          buffer: Buffer.from('content1')
        },
        {
          name: 'file2.txt',
          size: 200,
          buffer: Buffer.from('content2')
        }
      ];
      
      const result = await (fileUpload as any).nodeUpload(files) as BatchUploadResult;
      
      expect(result.results).toHaveLength(2);
      expect(result.totalSize).toBe(300);
    });

    it('should handle metadata for Node.js files', async () => {
      const file: NodeFileObject = {
        name: 'test.jpg',
        size: 1000,
        type: 'image/jpeg',
        buffer: Buffer.from('image data')
      };
      
      const metadata = {
        FileIndex: 0,
        name: 'vacation-photo',
        tags: [4, 8],
        labels: '123'
      };
      
      const result = await (fileUpload as any).nodeUpload(file, { metaData: [metadata] });
      
      expect(result).toHaveProperty('cid');
      // Contract creator is used instead of direct API call
      expect(mockAccount.sign).toHaveBeenCalled();
    });

    it('should handle chunked upload for large Node.js files', async () => {
      const largeBuffer = Buffer.alloc(2 * 1024 * 1024); // 2MB
      const file: NodeFileObject = {
        name: 'large.bin',
        size: largeBuffer.length,
        buffer: largeBuffer
      };
      
      await (fileUpload as any).nodeUpload(file);
      
      // Should have called fetch for authorization and upload
      expect(fetch).toHaveBeenCalled();
      expect(fetch).toHaveBeenCalledTimes(2); // Authorization + chunk upload
    });

    it('should validate Node.js file structure', async () => {
      const invalidFile = {
        name: 'test.txt',
        // Missing required properties
      };
      
      await expect((fileUpload as any).nodeUpload(invalidFile))
        .rejects.toThrow('Invalid file: must have buffer property or be a Buffer');
    });

    it('should handle encryption for Node.js files', async () => {
      const file: NodeFileObject = {
        name: 'secret.txt',
        size: 100,
        buffer: Buffer.from('secret content')
      };
      
      await (fileUpload as any).nodeUpload(file, { encrypt: ['alice', 'bob'] });
      
      // Contract creator is used, encryption is handled in metadata
      expect(mockAccount.sign).toHaveBeenCalled();
    });

    it('should handle progress callback for Node.js uploads', async () => {
      const file: NodeFileObject = {
        name: 'test.txt',
        size: 1000,
        buffer: Buffer.from('x'.repeat(1000))
      };
      
      const progressValues: number[] = [];
      
      await (fileUpload as any).nodeUpload(file, {
        onProgress: (percent: number) => progressValues.push(percent)
      });
      
      // Progress should be reported
      expect(progressValues.length).toBeGreaterThan(0);
    });

    it('should reject invalid file types', async () => {
      await expect((fileUpload as any).nodeUpload(null))
        .rejects.toThrow('No files provided');
      
      await expect((fileUpload as any).nodeUpload([]))
        .rejects.toThrow('No files provided');
    });

    it('should handle file slicing for chunked uploads', async () => {
      const buffer = Buffer.from('x'.repeat(3 * 1024 * 1024)); // 3MB
      const file: NodeFileObject = {
        name: 'large.txt',
        size: buffer.length,
        buffer: buffer
      };
      
      // Mock buffer slicing
      buffer.slice = jest.fn((start?: number, end?: number) => {
        const s = start || 0;
        const e = end || buffer.length;
        return Buffer.from('x'.repeat(e - s));
      });
      
      await (fileUpload as any).nodeUpload(file);
      
      // Buffer should be sliced for chunks
      expect(buffer.slice).toHaveBeenCalled();
    });
  });
});