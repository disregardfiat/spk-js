// eslint-disable-next-line @typescript-eslint/no-var-requires
const MockTroleServer = require('./mock-trole-server');
import { SPKFileUpload } from '../../src/storage/file-upload';
import { UploadResult } from '../../src/storage/file';
import { SPKAccount } from '../../src/core/account';
import { SPKAPI } from '../../src/core/api';
import * as fs from 'fs';
import * as path from 'path';

describe('Real File Upload E2E Test', () => {
  let mockServer: any;
  let account: SPKAccount;
  let fileUpload: SPKFileUpload;
  const TEST_PORT = 3338;
  const TEST_DIR = path.join(__dirname, 'test-files');
  
  beforeAll(async () => {
    // Create test directory
    if (!fs.existsSync(TEST_DIR)) {
      fs.mkdirSync(TEST_DIR, { recursive: true });
    }
    
    // Start mock server
    mockServer = new MockTroleServer(TEST_PORT);
    await mockServer.start();
    
    // Create test account
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
  
  afterAll(async () => {
    // Clean up test files
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true });
    }
    
    await mockServer.stop();
  });
  
  it('should upload a real text file created from string', async () => {
    // Create a real file from string
    const content = 'Hello, SPK Network! This is a real file upload test.';
    const filePath = path.join(TEST_DIR, 'test-upload.txt');
    fs.writeFileSync(filePath, content);
    
    // Read it back as a buffer
    const fileBuffer = fs.readFileSync(filePath);
    
    // Create a File object (using our mocked File from tests/mocks/file.js)
    const file = new File([fileBuffer], 'test-upload.txt', { type: 'text/plain' });
    
    console.log('Created file:', {
      name: file.name,
      size: file.size,
      type: file.type
    });
    
    console.log('Starting upload...');
    
    // Upload the file
    const result = await fileUpload.upload(file);
    
    console.log('Upload completed! Result:', result);
    
    // Single file returns UploadResult
    const uploadResult = result as any; // Using any to bypass union type issues
    
    // Verify the upload
    expect(uploadResult).toBeDefined();
    expect(uploadResult.cid).toBeDefined();
    expect(uploadResult.contract).toBeDefined();
    expect(uploadResult.size).toBe(content.length);
    
    // Verify file was uploaded to mock server
    const uploadedFiles = mockServer.getUploadedFiles();
    expect(uploadedFiles).toHaveLength(1);
    expect(uploadedFiles[0].cid).toBe(uploadResult.cid);
    expect(uploadedFiles[0].size).toBe(content.length);
    expect(uploadedFiles[0].verified).toBe(true);
  }, 5000); // 5 second timeout - should be more than enough
  
  it('should upload multiple files as a batch', async () => {
    // Create multiple real files
    const files = [];
    const contents = [
      'First file content - SPK Network rocks!',
      'Second file content - Decentralized storage FTW!',
      'Third file content - IPFS integration is awesome!'
    ];
    
    for (let i = 0; i < contents.length; i++) {
      const filePath = path.join(TEST_DIR, `batch-file-${i}.txt`);
      fs.writeFileSync(filePath, contents[i]);
      
      const fileBuffer = fs.readFileSync(filePath);
      const file = new File([fileBuffer], `batch-file-${i}.txt`, { type: 'text/plain' });
      files.push(file);
    }
    
    console.log('Created batch of files:', files.map(f => ({
      name: f.name,
      size: f.size
    })));
    
    // Upload the batch
    const result = await fileUpload.upload(files);
    
    console.log('Batch upload result:', result);
    
    // Batch returns BatchUploadResult
    const batchResult = result as any;
    
    // Verify batch upload
    expect(batchResult.results).toHaveLength(3);
    expect(batchResult.totalSize).toBe(contents.reduce((sum, c) => sum + c.length, 0));
    expect(batchResult.contractId).toBeDefined();
    
    // Verify all files were uploaded
    const uploadedFiles = mockServer.getUploadedFiles();
    expect(uploadedFiles).toHaveLength(4); // 1 from previous test + 3 from this test
    
    // Check each file
    batchResult.results.forEach((fileResult: any, index: number) => {
      expect(fileResult.cid).toBeDefined();
      expect(fileResult.size).toBe(contents[index].length);
    });
  });
  
  it('should upload a file with metadata', async () => {
    // Create a file with some content
    const content = 'This is a document with metadata!';
    const filePath = path.join(TEST_DIR, 'document-with-meta.pdf');
    fs.writeFileSync(filePath, content);
    
    const fileBuffer = fs.readFileSync(filePath);
    const file = new File([fileBuffer], 'document-with-meta.pdf', { type: 'application/pdf' });
    
    // Define metadata
    const metadata = [{
      FileIndex: 0,
      name: 'Important-Document',
      ext: 'pdf',
      path: '/Documents',
      tags: 0,
      license: '7', // CC0
      labels: '1'   // Important
    }];
    
    // Upload with metadata - single file returns UploadResult, not BatchUploadResult
    const result = await fileUpload.upload(file, { metaData: metadata }) as UploadResult;
    
    console.log('Upload with metadata result:', result);
    
    // Verify the upload
    expect(result.cid).toBeDefined();
    expect(result.size).toBe(file.size);
    
    // Check that metadata was included in the contract
    const contracts = mockServer.getContracts();
    const latestContract = contracts[contracts.length - 1];
    expect(latestContract.meta).toBeDefined();
    
    console.log('Contract metadata:', latestContract.meta);
  });
});