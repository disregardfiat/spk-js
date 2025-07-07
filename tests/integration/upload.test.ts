import SPK from '../../src/index';

// Integration tests run against a test node
const TEST_NODE = process.env.SPK_TEST_NODE || 'https://spktest.dlux.io';
const TEST_ACCOUNT = process.env.SPK_TEST_ACCOUNT || 'spk-js-test';

// Skip these tests in CI unless credentials are provided
const describeIntegration = process.env.SPK_TEST_ACCOUNT ? describe : describe.skip;

describeIntegration('Upload Integration', () => {
  let spk: SPK;

  beforeAll(async () => {
    spk = new SPK(TEST_ACCOUNT, { node: TEST_NODE });
    
    // Mock Hive Keychain for testing
    (global as any).window = {
      hive_keychain: {
        requestSignBuffer: jest.fn((username, message, method, callback) => {
          // Simulate successful signing
          callback(null, {
            signature: 'test_signature_' + Date.now(),
            publicKey: 'STM8TestPublicKey'
          });
        }),
        requestCustomJson: jest.fn((username, id, method, json, display, callback) => {
          // Simulate successful broadcast
          callback(null, { success: true });
        })
      }
    };

    await spk.init();
  });

  describe('File Upload Flow', () => {
    it('should complete full upload cycle', async () => {
      // Create a test file
      const content = 'Integration test file content ' + Date.now();
      const file = new File([content], 'integration-test.txt', { type: 'text/plain' });

      // Upload file
      const result = await spk.upload(file, {
        duration: 1, // 1 day for testing
        onProgress: (percent) => {
          expect(percent).toBeGreaterThanOrEqual(0);
          expect(percent).toBeLessThanOrEqual(100);
        }
      });

      // Verify result structure
      expect(result).toMatchObject({
        cid: expect.stringMatching(/^Qm[a-zA-Z0-9]{44}$/),
        contract: expect.objectContaining({
          id: expect.any(String),
          success: true
        }),
        size: file.size,
        url: expect.stringContaining('ipfs.dlux.io/ipfs/')
      });

      // Verify file is accessible
      const response = await fetch(result.url);
      expect(response.ok).toBe(true);
      
      const downloadedContent = await response.text();
      expect(downloadedContent).toBe(content);
    });

    it('should handle large file upload with chunks', async () => {
      // Create a 2MB file
      const largeContent = new Uint8Array(2 * 1024 * 1024);
      for (let i = 0; i < largeContent.length; i++) {
        largeContent[i] = i % 256;
      }
      
      const file = new File([largeContent], 'large-test.bin', { 
        type: 'application/octet-stream' 
      });

      const progressUpdates: number[] = [];
      
      const result = await spk.upload(file, {
        duration: 1,
        chunkSize: 512 * 1024, // 512KB chunks
        onProgress: (percent) => {
          progressUpdates.push(percent);
        }
      });

      expect(result.cid).toMatch(/^Qm[a-zA-Z0-9]{44}$/);
      expect(result.size).toBe(2 * 1024 * 1024);
      
      // Should have multiple progress updates
      expect(progressUpdates.length).toBeGreaterThan(4);
      expect(progressUpdates[progressUpdates.length - 1]).toBe(100);
    });

    it('should upload with metadata', async () => {
      const file = new File(['metadata test'], 'metadata-test.txt');
      
      const result = await spk.upload(file, {
        folder: 'Documents',
        tags: ['test', 'integration'],
        license: 'MIT',
        duration: 1
      });

      expect(result.cid).toBeTruthy();

      // Fetch file info to verify metadata
      const fileInfo = await spk.getFile(result.cid);
      expect(fileInfo.metadata).toMatchObject({
        folder: 'Documents',
        tags: ['test', 'integration'],
        license: 'MIT'
      });
    });

    it('should handle upload errors gracefully', async () => {
      // Create a file that will fail contract creation
      const file = new File(['x'.repeat(100 * 1024 * 1024)], 'too-large.bin');
      
      // Mock insufficient BROCA
      spk.account.calculateBroca = jest.fn().mockReturnValue(100);

      await expect(spk.upload(file)).rejects.toThrow('Insufficient BROCA');
    });
  });

  describe('Contract Management', () => {
    let uploadedFile: { cid: string; contract: any };

    beforeAll(async () => {
      // Upload a file for contract tests
      const file = new File(['contract test'], 'contract-test.txt');
      uploadedFile = await spk.upload(file, { duration: 1 });
    });

    it('should renew contract', async () => {
      const renewed = await spk.renewContract(uploadedFile.contract.id, {
        duration: 30
      });

      expect(renewed.success).toBe(true);
      expect(renewed.newExpiry).toBeDefined();
    });

    it('should list user contracts', async () => {
      const contracts = await spk.listContracts();

      expect(Array.isArray(contracts)).toBe(true);
      expect(contracts.length).toBeGreaterThan(0);
      
      const testContract = contracts.find(c => c.id === uploadedFile.contract.id);
      expect(testContract).toBeDefined();
      expect(testContract.cid).toBe(uploadedFile.cid);
    });

    it('should get contract details', async () => {
      const details = await spk.getContract(uploadedFile.contract.id);

      expect(details).toMatchObject({
        id: uploadedFile.contract.id,
        cid: uploadedFile.cid,
        owner: TEST_ACCOUNT,
        size: expect.any(Number),
        created: expect.any(Number),
        expires: expect.any(Number)
      });
    });
  });

  describe('File Operations', () => {
    it('should list files with filters', async () => {
      // Upload files to different folders
      const file1 = new File(['doc content'], 'doc1.txt');
      const file2 = new File(['image data'], 'image1.jpg');
      
      await spk.upload(file1, { folder: 'Documents', tags: ['work'] });
      await spk.upload(file2, { folder: 'Images', tags: ['personal'] });

      // List all files
      const allFiles = await spk.listFiles();
      expect(allFiles.length).toBeGreaterThanOrEqual(2);

      // Filter by folder
      const documents = await spk.listFiles({ folder: 'Documents' });
      expect(documents.every(f => f.metadata.folder === 'Documents')).toBe(true);

      // Filter by tags
      const workFiles = await spk.listFiles({ tags: ['work'] });
      expect(workFiles.every(f => f.metadata.tags.includes('work'))).toBe(true);
    });

    it('should delete file (stop renewal)', async () => {
      const file = new File(['to delete'], 'delete-me.txt');
      const uploaded = await spk.upload(file);

      const deleted = await spk.deleteFile(uploaded.cid);
      expect(deleted.success).toBe(true);

      // Verify contract is cancelled
      const contract = await spk.getContract(uploaded.contract.id);
      expect(contract.autoRenew).toBe(false);
      expect(contract.status).toBe('cancelled');
    });
  });

  describe('Token Operations', () => {
    it('should get current balances', async () => {
      const balances = await spk.getBalances();

      expect(balances).toMatchObject({
        larynx: expect.any(Number),
        spk: expect.any(Number),
        broca: expect.any(Number)
      });

      expect(balances.larynx).toBeGreaterThanOrEqual(0);
      expect(balances.spk).toBeGreaterThanOrEqual(0);
      expect(balances.broca).toBeGreaterThanOrEqual(0);
    });

    it('should calculate BROCA for storage', async () => {
      const fileSize = 10 * 1024 * 1024; // 10MB
      const days = 30;

      const cost = await spk.calculateStorageCost(fileSize, days);

      expect(cost).toMatchObject({
        broca: expect.any(Number),
        canAfford: expect.any(Boolean),
        currentBroca: expect.any(Number)
      });

      // 10MB * 30 days * 0.001 = 300,000 BROCA
      expect(cost.broca).toBe(307200);
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      const badSpk = new SPK(TEST_ACCOUNT, { 
        node: 'https://invalid.node.example' 
      });

      await expect(badSpk.init()).rejects.toThrow();
    });

    it('should handle invalid file', async () => {
      await expect(spk.upload(null as any)).rejects.toThrow('Invalid file');
    });

    it('should handle missing keychain', async () => {
      // Remove keychain
      delete (global as any).window.hive_keychain;
      
      const noKeychainSpk = new SPK(TEST_ACCOUNT, { node: TEST_NODE });
      await noKeychainSpk.init();

      await expect(noKeychainSpk.upload(new File(['test'], 'test.txt')))
        .rejects.toThrow('Hive Keychain not available');
    });
  });
});