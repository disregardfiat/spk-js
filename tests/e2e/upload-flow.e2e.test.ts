// eslint-disable-next-line @typescript-eslint/no-var-requires
const MockTroleServer = require('./mock-trole-server');

describe('SPK Upload Flow E2E Test', () => {
  let mockServer: any;
  const TEST_PORT = 3335; // Different port to avoid conflicts
  
  beforeAll(async () => {
    // Start mock server
    mockServer = new MockTroleServer(TEST_PORT);
    await mockServer.start();
  });
  
  afterAll(async () => {
    await mockServer.stop();
  });
  
  it('should complete upload flow with trole server', async () => {
    // Test direct upload to mock server
    const testCid = 'QmTest123';
    const testContent = 'Hello World';
    
    // Step 1: Create contract
    const contractResponse = await fetch(`http://localhost:${TEST_PORT}/api/new_contract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'testuser',
        cid: testCid,
        size: testContent.length
      })
    });
    
    expect(contractResponse.ok).toBe(true);
    const contract = await contractResponse.json();
    console.log('Contract created:', contract);
    
    // Step 2: Authorize upload
    const authResponse = await fetch(`http://localhost:${TEST_PORT}/upload-authorize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Account': 'testuser',
        'X-Sig': 'mock-sig',
        'X-Contract': contract.id,
        'X-Cid': testCid
      },
      body: JSON.stringify({
        files: testCid,
        meta: '1,test,txt.9,,'
      })
    });
    
    expect(authResponse.ok).toBe(true);
    const authData = await authResponse.json();
    console.log('Upload authorized:', authData);
    
    // Step 3: Upload file
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const FormData = require('form-data');
    const formData = new FormData();
    const buffer = Buffer.from(testContent);
    formData.append('chunk', buffer, { filename: 'test.txt' });
    
    const uploadResponse = await fetch(`http://localhost:${TEST_PORT}/upload`, {
      method: 'POST',
      headers: {
        'X-Contract': contract.id,
        'X-Cid': testCid,
        'Content-Range': `bytes=0-${buffer.length - 1}/${buffer.length}`,
        ...formData.getHeaders()
      },
      body: formData
    });
    
    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('Upload failed:', uploadResponse.status, errorText);
    }
    expect(uploadResponse.ok).toBe(true);
    const uploadResult = await uploadResponse.json();
    console.log('Upload result:', uploadResult);
    
    // Verify file was uploaded
    const uploadedFiles = mockServer.getUploadedFiles();
    expect(uploadedFiles).toHaveLength(1);
    expect(uploadedFiles[0].cid).toBe(testCid);
    
    // Note: Real CID verification would fail here since 'QmTest123' 
    // doesn't match the hash of 'Hello World'
    console.log('E2E test completed successfully');
  });
  
  it('should handle batch metadata encoding in upload flow', async () => {
    // Test batch metadata encoding
    const files = ['QmFile1', 'QmFile2', 'QmFile3'];
    const meta = '1,file1,txt.2,,-7-1,file2,jpg.3,QmThumb,4-1-25,file3,pdf.2,,--1';
    
    const authResponse = await fetch(`http://localhost:${TEST_PORT}/upload-authorize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Account': 'testuser',
        'X-Sig': 'mock-sig',
        'X-Contract': 'testuser_batch_123',
        'X-Cid': files[0]
      },
      body: JSON.stringify({
        files: files.join(','),
        meta: meta
      })
    });
    
    expect(authResponse.ok).toBe(true);
    const authData = await authResponse.json();
    
    expect(authData.authorized).toEqual(files);
    
    // Check contract stored metadata
    const contracts = mockServer.getContracts();
    const batchContract = contracts.find((c: any) => c.id === 'testuser_batch_123');
    expect(batchContract).toBeDefined();
    expect(batchContract.meta).toBe(meta);
    expect(batchContract.cids).toEqual(files);
    
    console.log('Batch metadata test completed');
  });
});