import { SPKFileUpload, BatchUploadResult } from '../../src/storage/file-upload';
import { SPKAccount } from '../../src/core/account';
import { SPKAPI } from '../../src/core/api';
import { BatchMetadataEncoder } from '../../src/storage/batch-metadata-encoder';
import { UploadResult } from '../../src/storage/file';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const MockTroleServer = require('./mock-trole-server');

describe('File Upload E2E Tests', () => {
  let mockServer: any;
  let account: SPKAccount;
  let fileUpload: SPKFileUpload;
  const TEST_PORT = 3334;
  
  beforeAll(async () => {
    // Start mock trole server
    mockServer = new MockTroleServer(TEST_PORT);
    await mockServer.start();
  });
  
  afterAll(async () => {
    // Stop mock server
    await mockServer.stop();
  });
  
  beforeEach(() => {
    // Create test account with mock API pointing to our server
    const mockApi = new SPKAPI(`http://localhost:${TEST_PORT}`);
    account = new SPKAccount('testuser', mockApi);
    
    // Mock account methods
    account.sign = jest.fn().mockResolvedValue({ 
      signature: 'mock-signature-12345' 
    });
    account.registerPublicKey = jest.fn().mockResolvedValue(undefined);
    account.calculateBroca = jest.fn().mockResolvedValue(10000);
    
    fileUpload = new SPKFileUpload(account);
  });
  
  describe('Single file upload', () => {
    it('should upload a single file successfully', async () => {
      // Create test file
      const content = 'Hello, SPK Network!';
      const file = new File([content], 'hello.txt', { type: 'text/plain' });
      
      // Upload file
      const result = await fileUpload.upload([file]);
      
      // Single file returns UploadResult
      const uploadResult = result as UploadResult;
      expect(uploadResult.success).toBe(true);
      expect(uploadResult.cid).toBeDefined();
      expect(uploadResult.contractId).toBeDefined();
      
      // Verify file was uploaded to mock server
      const uploadedFiles = mockServer.getUploadedFiles();
      expect(uploadedFiles).toHaveLength(1);
      expect(uploadedFiles[0].cid).toBe(uploadResult.cid);
      expect(uploadedFiles[0].verified).toBe(true);
    });
    
    it('should upload file with metadata', async () => {
      const content = 'Test document with metadata';
      const file = new File([content], 'document.pdf', { type: 'application/pdf' });
      
      const metadata = [{
        FileIndex: 0,
        name: 'Important-Document',
        ext: 'pdf',
        path: '/Documents',
        tags: 0,
        license: '7', // CC0
        labels: '1'   // Important
      }];
      
      const result = await fileUpload.upload([file], { metaData: metadata });
      
      const uploadResult = result as UploadResult;
      expect(uploadResult.success).toBe(true);
      
      // Check contract has metadata
      const contracts = mockServer.getContracts();
      expect(contracts).toHaveLength(1);
      expect(contracts[0].meta).toBeDefined();
      
      // Decode and verify metadata
      const encoder = new BatchMetadataEncoder();
      const decoded = encoder.decode(contracts[0].meta);
      expect(decoded.files).toHaveLength(1);
      expect(decoded.files[0].name).toBe('Important-Document');
      expect(decoded.files[0].metadata.license).toBe('7');
      expect(decoded.files[0].metadata.labels).toBe('1');
    });
  });
  
  describe('Batch file upload', () => {
    it('should upload multiple files in batch', async () => {
      // Create test files
      const files = [
        new File(['Content 1'], 'file1.txt', { type: 'text/plain' }),
        new File(['Content 2'], 'file2.txt', { type: 'text/plain' }),
        new File(['Content 3'], 'file3.txt', { type: 'text/plain' })
      ];
      
      const result = await fileUpload.upload(files);
      
      // Batch upload returns BatchUploadResult
      const batchResult = result as BatchUploadResult;
      expect(batchResult.success).toBe(true);
      expect(batchResult.results).toHaveLength(3);
      
      batchResult.results.forEach(fileResult => {
        expect(fileResult.success).toBe(true);
        expect(fileResult.cid).toBeDefined();
      });
      
      // All files should share the same batch ID
      expect(batchResult.batchId).toBeDefined();
      
      // Verify all files uploaded
      const uploadedFiles = mockServer.getUploadedFiles();
      expect(uploadedFiles).toHaveLength(3);
      uploadedFiles.forEach((file: any) => {
        expect(file.verified).toBe(true);
      });
    });
    
    it('should generate compact batch metadata string', async () => {
      const files = [
        new File(['Report content'], 'Q4-Report.pdf'),
        new File(['Photo data'], 'vacation.jpg'),
        new File(['Code file'], 'app.js')
      ];
      
      const metadata = [
        {
          FileIndex: 0,
          name: 'Q4-Financial-Report',
          ext: 'pdf',
          path: '/Documents',
          tags: 0,
          license: '7',
          labels: '1'
        },
        {
          FileIndex: 1,
          name: 'Beach-Vacation-2023',
          ext: 'jpg',
          path: '/Images/Travel',
          thumbnail: 'QmThumb123',
          tags: 4, // NSFW
          license: '1',
          labels: '25'
        },
        {
          FileIndex: 2,
          name: 'main-app',
          ext: 'js',
          path: '/Code',
          tags: 8, // Executable
          labels: '7' // Green
        }
      ];
      
      const result = await fileUpload.upload(files, { metaData: metadata });
      
      const batchResult = result as BatchUploadResult;
      expect(batchResult.success).toBe(true);
      expect(batchResult.results).toHaveLength(3);
      
      // Get the contract and verify metadata format
      const contracts = mockServer.getContracts();
      expect(contracts).toHaveLength(1);
      
      const metaString = contracts[0].meta;
      console.log('Generated metadata string:', metaString);
      
      // Should be compact format with custom folders
      expect(metaString).toMatch(/^1\|/); // Version 1 with custom folders
      expect(metaString).toContain('3/Travel'); // Images/Travel as custom folder
      
      // Decode and verify
      const encoder = new BatchMetadataEncoder();
      const decoded = encoder.decode(metaString);
      
      expect(decoded.files).toHaveLength(3);
      expect(decoded.files[0].name).toBe('Q4-Financial-Report');
      expect(decoded.files[1].thumb).toBe('QmThumb123');
      expect(decoded.files[2].metadata.tags).toBe(8);
    });
  });
  
  describe('Large file upload with chunks', () => {
    it('should upload large file in chunks', async () => {
      // Create a 2MB file (will be chunked)
      const largeContent = new Uint8Array(2 * 1024 * 1024);
      for (let i = 0; i < largeContent.length; i++) {
        largeContent[i] = i % 256;
      }
      
      const largeFile = new File([largeContent], 'large-file.bin', { 
        type: 'application/octet-stream' 
      });
      
      const result = await fileUpload.upload([largeFile]);
      
      const uploadResult = result as UploadResult;
      expect(uploadResult.success).toBe(true);
      
      // Verify file was uploaded and verified
      const uploadedFiles = mockServer.getUploadedFiles();
      expect(uploadedFiles).toHaveLength(1);
      expect(uploadedFiles[0].size).toBe(2 * 1024 * 1024);
      expect(uploadedFiles[0].verified).toBe(true);
    });
  });
  
  describe('Error handling', () => {
    it('should handle upload authorization failure', async () => {
      // Override the API to simulate auth failure
      account.api.post = jest.fn().mockRejectedValue(new Error('Unauthorized'));
      
      const file = new File(['test'], 'test.txt');
      
      await expect(fileUpload.upload([file])).rejects.toThrow('Unauthorized');
    });
    
    it('should handle CID mismatch', async () => {
      // Create a file but override hash calculation to cause mismatch
      const file = new File(['test content'], 'test.txt');
      
      // Override the hash function to return wrong CID
      const originalHash = fileUpload['hashFile'];
      fileUpload['hashFile'] = jest.fn().mockResolvedValue('QmWrongCID');
      
      try {
        await fileUpload.upload([file]);
      } catch (error) {
        // Expected to fail
      }
      
      // Restore original hash function
      fileUpload['hashFile'] = originalHash;
      
      // File should not be in uploaded files due to CID mismatch
      const uploadedFiles = mockServer.getUploadedFiles();
      expect(uploadedFiles.filter((f: any) => f.verified)).toHaveLength(0);
    });
  });
  
  describe('Encryption support', () => {
    it('should upload encrypted files', async () => {
      const content = 'Secret content';
      const file = new File([content], 'secret.txt');
      
      const result = await fileUpload.upload([file], {
        encrypt: ['alice', 'bob']
      });
      
      const uploadResult = result as UploadResult;
      expect(uploadResult.success).toBe(true);
      expect(uploadResult.encrypted).toBe(true);
      expect(uploadResult.encryptedFor).toEqual(['alice', 'bob']);
      
      // Verify metadata includes encryption info
      const contracts = mockServer.getContracts();
      const metaString = contracts[0].meta;
      expect(metaString).toContain('#alice:bob');
    });
  });
});