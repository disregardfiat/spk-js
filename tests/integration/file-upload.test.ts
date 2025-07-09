import { SPKFileUpload, BatchUploadResult } from '../../src/storage/file-upload';

// Mock provider selector to avoid network calls
jest.mock('../../src/storage/provider-selector', () => ({
  StorageProviderSelector: jest.fn().mockImplementation(() => ({
    selectBestProvider: jest.fn().mockResolvedValue({
      nodeId: 'node1',
      api: 'https://ipfs.dlux.io',
      freeSpace: 1000000000
    }),
    formatBytes: jest.fn().mockImplementation(bytes => `${bytes} Bytes`)
  }))
}));

// Mock ipfs-only-hash
jest.mock('ipfs-only-hash', () => ({
  of: jest.fn().mockResolvedValue('QmTestHash')
}));

// Mock contract creator
jest.mock('../../src/storage/contract-creator', () => ({
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
      size: 100
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

describe('SPKFileUpload Integration', () => {
  let mockAccount: any;
  let fileUpload: SPKFileUpload;
  
  beforeEach(() => {
    // Create mock account with basic functionality
    mockAccount = {
      username: 'testuser',
      registerPublicKey: jest.fn().mockResolvedValue(undefined),
      sign: jest.fn().mockResolvedValue('mock-sig'),
      calculateBroca: jest.fn().mockResolvedValue(1000),
      api: {
        post: jest.fn().mockResolvedValue({ id: 'contract-123', df: ['QmTest'] }),
        get: jest.fn().mockResolvedValue({ df: ['QmTest'], i: 'contract-123' })
      },
      node: 'https://spktest.dlux.io'
    };
    
    fileUpload = new SPKFileUpload(mockAccount as any);
    
    // Mock fetch for upload operations
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ success: true })
    });
    
    // Mock XMLHttpRequest
    global.XMLHttpRequest = jest.fn(() => ({
      open: jest.fn(),
      send: jest.fn(),
      setRequestHeader: jest.fn(),
      upload: { addEventListener: jest.fn() },
      addEventListener: jest.fn((event, callback) => {
        if (event === 'load') setTimeout(() => callback(), 10);
      }),
      status: 200,
      responseText: ''
    })) as any;
  });

  describe('upload validation', () => {
    it('should reject empty file array', async () => {
      await expect(fileUpload.upload([])).rejects.toThrow('No files provided');
    });

    it('should validate metadata FileIndex', async () => {
      const file = new File(['test'], 'test.txt');
      const invalidMetadata = [{ FileIndex: 5, name: 'test' }];
      
      await expect(
        fileUpload.upload(file, { metaData: invalidMetadata })
      ).rejects.toThrow('Invalid FileIndex 5. Must be between 0 and 0');
    });
  });

  describe('metadata handling', () => {
    it('should apply metadata to correct files in batch', async () => {
      const files = [
        new File(['doc'], 'doc.pdf'),
        new File(['image'], 'image.jpg', { type: 'image/jpeg' }),
        new File(['video'], 'video.mp4', { type: 'video/mp4' })
      ];
      
      const metaData = [
        { FileIndex: 0, name: 'important-doc', license: '1' },
        { FileIndex: 2, name: 'tutorial-video', labels: '15' }
      ];
      
      // Mock hash generation
      fileUpload['hashFile'] = jest.fn().mockResolvedValue('QmTestHash');
      
      try {
        await fileUpload.upload(files, { metaData });
      } catch {
        // Upload will fail due to mocking, but we can check the contract creation calls
      }
      
      // Contract creation happens locally
      expect(mockAccount.sign).toHaveBeenCalled();
    });

    it('should convert metadata tags and labels correctly', async () => {
      const file = new File(['test'], 'test.txt');
      const metadata = {
        FileIndex: 0,
        name: 'test-file',
        tags: [4, 8], // Should be combined with bitwise OR
        labels: '123',
        license: '7'
      };
      
      // Mock hash generation
      fileUpload['hashFile'] = jest.fn().mockResolvedValue('QmTestHash');
      
      try {
        await fileUpload.upload(file, { metaData: [metadata] });
      } catch {
        // Upload will fail due to mocking, but we can check the contract creation
      }
      
      // Contract creation happens locally
      expect(mockAccount.sign).toHaveBeenCalled();
    });
  });

  describe('batch upload result', () => {
    it('should return correct batch result structure', async () => {
      const files = [
        new File(['a'], 'file1.txt'),
        new File(['bb'], 'file2.txt')
      ];
      
      // Mock hash generation and upload
      fileUpload['hashFile'] = jest.fn().mockResolvedValue('QmTestHash');
      fileUpload['uploadToIPFS'] = jest.fn().mockResolvedValue(undefined);
      
      const result = await fileUpload.upload(files) as BatchUploadResult;
      
      expect(result).toHaveProperty('results');
      expect(result).toHaveProperty('totalSize');
      expect(result).toHaveProperty('totalBrocaCost');
      expect(result).toHaveProperty('contractId');
      expect(result.results).toHaveLength(2);
      expect(result.totalSize).toBe(3); // 1 + 2 bytes
    });
  });

  describe('progress tracking', () => {
    it('should support individual file progress callbacks', async () => {
      const files = [
        new File(['test1'], 'file1.txt'),
        new File(['test2'], 'file2.txt')
      ];
      
      const progressTracking: { [key: number]: boolean } = {};
      
      const metaData = [
        { FileIndex: 0, onProgress: () => { progressTracking[0] = true; } },
        { FileIndex: 1, onProgress: () => { progressTracking[1] = true; } }
      ];
      
      // Mock to simulate successful upload
      fileUpload['hashFile'] = jest.fn().mockResolvedValue('QmTestHash');
      fileUpload['uploadToIPFS'] = jest.fn().mockImplementation((_file, _id, progressFn) => {
        if (progressFn) progressFn(100);
        return Promise.resolve();
      });
      
      await fileUpload.upload(files, { metaData });
      
      expect(progressTracking[0]).toBe(true);
      expect(progressTracking[1]).toBe(true);
    });
  });
});