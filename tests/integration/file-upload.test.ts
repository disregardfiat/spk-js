import { SPKFileUpload, BatchUploadResult } from '../../src/storage/file-upload';

describe('SPKFileUpload Integration', () => {
  let mockAccount: any;
  let fileUpload: SPKFileUpload;
  
  beforeEach(() => {
    // Create mock account with basic functionality
    mockAccount = {
      username: 'testuser',
      registerPublicKey: jest.fn().mockResolvedValue(undefined),
      sign: jest.fn().mockResolvedValue({ signature: 'mock-sig' }),
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
      
      // First file should have metadata
      expect(mockAccount.api.post).toHaveBeenCalledWith(
        '/api/new_contract',
        expect.objectContaining({
          metadata: expect.objectContaining({
            name: 'important-doc',
            license: '1'
          })
        }),
        expect.any(Object)
      );
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
      
      expect(mockAccount.api.post).toHaveBeenCalledWith(
        '/api/new_contract',
        expect.objectContaining({
          metadata: expect.objectContaining({
            name: 'test-file',
            labels: '123',
            license: '7',
            flag: expect.any(String) // Base64 encoded tags
          })
        }),
        expect.any(Object)
      );
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