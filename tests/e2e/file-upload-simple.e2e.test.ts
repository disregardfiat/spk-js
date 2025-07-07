import { SPKFileUpload, BatchUploadResult } from '../../src/storage/file-upload';
import { SPKAccount } from '../../src/core/account';
import { SPKAPI } from '../../src/core/api';
import { BatchMetadataEncoder } from '../../src/storage/batch-metadata-encoder';
import { UploadResult } from '../../src/storage/file';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const MockTroleServer = require('./mock-trole-server');

describe('File Upload E2E Tests - Simple', () => {
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
  
  describe('Basic upload functionality', () => {
    it('should upload a single file and verify CID', async () => {
      // Create test file
      const content = 'Hello, SPK Network!';
      const file = new File([content], 'hello.txt', { type: 'text/plain' });
      
      // Upload file
      const result = await fileUpload.upload(file);
      
      // Check result structure
      const uploadResult = result as UploadResult;
      expect(uploadResult.cid).toBeDefined();
      expect(uploadResult.size).toBe(content.length);
      expect(uploadResult.url).toBeDefined();
      expect(uploadResult.contract).toBeDefined();
      
      // Verify file was uploaded to mock server
      const uploadedFiles = mockServer.getUploadedFiles();
      expect(uploadedFiles).toHaveLength(1);
      expect(uploadedFiles[0].cid).toBe(uploadResult.cid);
      expect(uploadedFiles[0].verified).toBe(true);
      
      console.log('Single file upload successful:', {
        cid: uploadResult.cid,
        size: uploadResult.size,
        url: uploadResult.url
      });
    });
    
    it('should upload multiple files as batch', async () => {
      // Create test files
      const files = [
        new File(['Content 1'], 'file1.txt'),
        new File(['Content 2'], 'file2.txt'),
        new File(['Content 3'], 'file3.txt')
      ];
      
      const result = await fileUpload.upload(files);
      
      // Check batch result structure
      const batchResult = result as BatchUploadResult;
      expect(batchResult.results).toHaveLength(3);
      expect(batchResult.totalSize).toBeGreaterThan(0);
      expect(batchResult.totalBrocaCost).toBeGreaterThan(0);
      expect(batchResult.contractId).toBeDefined();
      
      // Verify all files have CIDs
      batchResult.results.forEach((fileResult, index) => {
        expect(fileResult.cid).toBeDefined();
        expect(fileResult.size).toBe(files[index].size);
      });
      
      // Verify files on server
      const uploadedFiles = mockServer.getUploadedFiles();
      expect(uploadedFiles).toHaveLength(3);
      
      console.log('Batch upload successful:', {
        fileCount: batchResult.results.length,
        totalSize: batchResult.totalSize,
        contractId: batchResult.contractId
      });
    });
    
    it('should generate compact metadata string for batch', async () => {
      const files = [
        new File(['PDF content'], 'report.pdf'),
        new File(['Image data'], 'photo.jpg')
      ];
      
      const metadata = [
        {
          FileIndex: 0,
          name: 'Q4-Report',
          ext: 'pdf',
          path: '/Documents',
          tags: 0,
          license: '7',
          labels: '1'
        },
        {
          FileIndex: 1,
          name: 'vacation',
          ext: 'jpg',
          path: '/Images/2023',
          thumbnail: 'QmThumb123',
          tags: 4,
          license: '1',
          labels: '25'
        }
      ];
      
      const result = await fileUpload.upload(files, { metaData: metadata });
      const batchResult = result as BatchUploadResult;
      
      expect(batchResult.results).toHaveLength(2);
      
      // Get contract from server and check metadata
      const contracts = mockServer.getContracts();
      expect(contracts).toHaveLength(1);
      
      const metaString = contracts[0].meta;
      console.log('Generated metadata string:', metaString);
      
      // Verify it's in compact format
      expect(metaString).toMatch(/^1/); // Version 1
      expect(metaString).toContain('3/2023'); // Custom folder
      
      // Decode and verify structure
      const encoder = new BatchMetadataEncoder();
      const decoded = encoder.decode(metaString);
      expect(decoded.files).toHaveLength(2);
      expect(decoded.files[0].name).toBe('Q4-Report');
      expect(decoded.files[1].name).toBe('vacation');
    });
  });
  
  describe('CID verification', () => {
    it('should verify file hash matches CID', async () => {
      const content = 'Test content for hashing';
      const file = new File([content], 'hash-test.txt');
      
      const result = await fileUpload.upload(file);
      const uploadResult = result as UploadResult;
      
      // Server should have verified the CID
      const uploadedFiles = mockServer.getUploadedFiles();
      expect(uploadedFiles[0].verified).toBe(true);
      
      console.log('CID verification passed for:', uploadResult.cid);
    });
    
    it('should handle upload with wrong CID', async () => {
      const file = new File(['test'], 'test.txt');
      
      // Override hash to return wrong CID
      const originalHash = fileUpload['hashFile'];
      fileUpload['hashFile'] = jest.fn().mockResolvedValue('QmWrongCID123');
      
      try {
        await fileUpload.upload(file);
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        // Expected to fail
        console.log('Upload correctly rejected with wrong CID');
      }
      
      // Restore original
      fileUpload['hashFile'] = originalHash;
      
      // No verified files should exist
      const uploadedFiles = mockServer.getUploadedFiles();
      expect(uploadedFiles.filter((f: any) => f.verified)).toHaveLength(0);
    });
  });
});