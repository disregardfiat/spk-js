// eslint-disable-next-line @typescript-eslint/no-var-requires
const MockTroleServer = require('./mock-trole-server');

describe('Simple E2E Test to verify E2E runs on GitHub', () => {
  let mockServer: any;
  const TEST_PORT = 3336;
  
  beforeAll(async () => {
    mockServer = new MockTroleServer(TEST_PORT);
    await mockServer.start();
  });
  
  afterAll(async () => {
    await mockServer.stop();
  });
  
  it('should start mock server and respond to health check', async () => {
    // Simple health check
    const response = await fetch(`http://localhost:${TEST_PORT}/upload-stats`);
    expect(response.ok).toBe(true);
    
    const data = await response.json();
    expect(data).toHaveProperty('node', 'mock-trole');
    expect(data).toHaveProperty('contracts', 0);
    expect(data).toHaveProperty('files', 0);
  });
  
  it('should create a contract via API', async () => {
    const response = await fetch(`http://localhost:${TEST_PORT}/api/new_contract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'testuser',
        s: 1000000
      })
    });
    
    expect(response.ok).toBe(true);
    const contract = await response.json();
    expect(contract).toHaveProperty('id');
    expect(contract).toHaveProperty('t', 'testuser');
    expect(contract).toHaveProperty('api', `http://localhost:${TEST_PORT}`);
  });
});