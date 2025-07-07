// eslint-disable-next-line @typescript-eslint/no-var-requires
const MockTroleServer = require('./mock-trole-server');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const NodeFormData = require('form-data');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const IpfsOnlyHash = require('ipfs-only-hash');

describe('Simple String Upload E2E Test', () => {
  let mockServer: any;
  const TEST_PORT = 3339;
  
  beforeAll(async () => {
    mockServer = new MockTroleServer(TEST_PORT);
    await mockServer.start();
  });
  
  afterAll(async () => {
    await mockServer.stop();
  });
  
  it('should upload a string as a file using direct HTTP calls', async () => {
    const content = 'Hello, SPK Network! This is a test string.';
    const buffer = Buffer.from(content);
    const cid = await IpfsOnlyHash.of(buffer); // Calculate real CID
    
    // Step 1: Create contract
    console.log('Creating contract...');
    const contractResponse = await fetch(`http://localhost:${TEST_PORT}/api/new_contract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'testuser',
        cid: cid,
        size: buffer.length,
        duration: 30
      })
    });
    
    expect(contractResponse.ok).toBe(true);
    const contract = await contractResponse.json();
    console.log('Contract created:', contract.id);
    
    // Step 2: Authorize upload
    console.log('Authorizing upload...');
    const authResponse = await fetch(`http://localhost:${TEST_PORT}/upload-authorize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Account': 'testuser',
        'X-Sig': contract.fosig,
        'X-Contract': contract.i,
        'X-Cid': cid
      },
      body: JSON.stringify({
        files: cid,
        meta: {}
      })
    });
    
    expect(authResponse.ok).toBe(true);
    await authResponse.json(); // Just consume the response
    console.log('Upload authorized');
    
    // Step 3: Upload the string as a file
    console.log('Uploading string as file...');
    const formData = new NodeFormData();
    formData.append('chunk', buffer, {
      filename: 'test.txt',
      contentType: 'text/plain',
      knownLength: buffer.length  // We know the size!
    });
    
    const uploadResponse = await fetch(`http://localhost:${TEST_PORT}/upload`, {
      method: 'POST',
      headers: {
        'X-Cid': cid,
        'X-Contract': contract.i,
        'X-Sig': contract.fosig,
        'X-Account': 'testuser',
        'Content-Range': `bytes 0-${buffer.length - 1}/${buffer.length}`,
        ...formData.getHeaders()
      },
      body: formData.getBuffer() // Get the complete buffer!
    });
    
    const uploadResult = await uploadResponse.text();
    console.log('Upload response:', uploadResponse.status, uploadResult);
    
    expect(uploadResponse.ok).toBe(true);
    
    // Verify the file was uploaded
    const uploadedFiles = mockServer.getUploadedFiles();
    console.log('Uploaded files:', uploadedFiles.length);
    
    // With real CID, the upload should be verified
    expect(uploadedFiles).toHaveLength(1);
    expect(uploadedFiles[0].contract).toBe(contract.i);
    expect(uploadedFiles[0].size).toBe(buffer.length);
    
    console.log('Test completed successfully!');
  }, 5000); // 5 second timeout should be plenty
});