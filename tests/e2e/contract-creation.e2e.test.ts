// eslint-disable-next-line @typescript-eslint/no-var-requires
const TroleMockServer = require('./mock-trole-server');
import { SPKAPI } from '../../src/core/api';
import { SPKAccount } from '../../src/core/account';

describe('Contract Creation E2E Test', () => {
  let mockServer: any;
  const TEST_PORT = 3337;
  
  beforeAll(async () => {
    mockServer = new TroleMockServer(TEST_PORT);
    await mockServer.start();
  });
  
  afterAll(async () => {
    await mockServer.stop();
  });
  
  it('should create a storage contract', async () => {
    // Create API and account
    const api = new SPKAPI(`http://localhost:${TEST_PORT}`);
    const account = new SPKAccount('testuser', api);
    
    // Mock the sign method
    account.sign = jest.fn().mockResolvedValue({
      signature: 'mock-signature'
    });
    
    // Create contract using API directly
    const contractData = {
      cid: 'QmTest123',
      size: 1000,
      duration: 30,
      username: 'testuser'
    };
    
    const response = await api.post('/api/new_contract', contractData, {
      signature: 'mock-signature',
      account: 'testuser',
      timestamp: Date.now()
    });
    
    expect(response).toBeDefined();
    expect(response.id).toBeDefined();
    expect(response.t).toBe('testuser');
    expect(response.api).toBe(`http://localhost:${TEST_PORT}`);
    
    // Verify contract was stored in mock server
    const contracts = mockServer.getContracts();
    expect(contracts).toHaveLength(0); // Should be 0 because we haven't authorized yet
  });
  
  it('should authorize file upload', async () => {
    // Direct authorization test
    const authResponse = await fetch(`http://localhost:${TEST_PORT}/upload-authorize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Account': 'testuser',
        'X-Sig': 'mock-sig',
        'X-Contract': 'test-contract-123',
        'X-Cid': 'QmTest123'
      },
      body: JSON.stringify({
        files: 'QmTest123',
        meta: {}
      })
    });
    
    expect(authResponse.ok).toBe(true);
    const authData = await authResponse.json();
    expect(authData.authorized).toContain('QmTest123');
    expect(authData.cid).toBe('QmTest123');
    
    // Now check contracts
    const contracts = mockServer.getContracts();
    expect(contracts).toHaveLength(1);
    expect(contracts[0].id).toBe('test-contract-123');
  });
});