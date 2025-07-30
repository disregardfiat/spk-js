import SPK from '../../src';

describe('Storage Node Integration', () => {
  let spk: SPK;

  beforeEach(() => {
    spk = new SPK('testuser', {
      node: 'https://spktest.dlux.io',
      honeygraphUrl: 'https://honeygraph.dlux.io'
    });
  });

  describe('NodeOperations integration', () => {
    it('should have node operations available', () => {
      expect(spk.nodeOps).toBeDefined();
      expect(spk.registerAuthority).toBeDefined();
      expect(spk.storeFiles).toBeDefined();
      expect(spk.removeFiles).toBeDefined();
      expect(spk.extendContract).toBeDefined();
      expect(spk.getNodeStatus).toBeDefined();
      expect(spk.getStoredContracts).toBeDefined();
      expect(spk.getAvailableContracts).toBeDefined();
      expect(spk.batchStore).toBeDefined();
      expect(spk.calculateStorageEarnings).toBeDefined();
    });

    it('should calculate storage earnings correctly', () => {
      const earnings = spk.calculateStorageEarnings({
        size: 1024 * 1024, // 1MB
        providers: 3,
        duration: 28800 * 30 // 30 days
      }, 500);

      expect(earnings).toHaveProperty('totalBroca');
      expect(earnings).toHaveProperty('dailyBroca');
      expect(earnings).toHaveProperty('monthlyBroca');
      expect(earnings.totalBroca).toBeGreaterThan(0);
      expect(earnings.dailyBroca).toBeGreaterThan(0);
      expect(earnings.monthlyBroca).toBeGreaterThan(0);
    });

    it('should have proper TypeScript types', () => {
      // This test ensures TypeScript compilation works with the new methods
      const testAsync = async () => {
        // These should all have proper typing
        const status = await spk.getNodeStatus();
        expect(status).toBeDefined();

        const contracts = await spk.getStoredContracts();
        expect(Array.isArray(contracts)).toBe(true);

        const available = await spk.getAvailableContracts(10);
        expect(Array.isArray(available)).toBe(true);
      };

      // Test passes if it compiles
      expect(testAsync).toBeDefined();
    });
  });

  describe('Storage node workflow', () => {
    it('should follow complete storage node workflow', async () => {
      // Mock the API responses for the workflow
      const mockApi = spk.account.api;
      
      // Mock node status check
      jest.spyOn(mockApi, 'get').mockImplementation((path: string) => {
        if (path.includes('/services/')) {
          return Promise.resolve({
            IPFS: {
              a: 'https://test-node.com',
              b: 500,
              t: Date.now()
            }
          });
        }
        if (path.includes('/api/contracts/available')) {
          return Promise.resolve({
            contract1: { t: 'alice', u: 1024, p: 3, e: '100000:0' },
            contract2: { t: 'bob', u: 2048, p: 3, e: '110000:0' }
          });
        }
        if (path.includes('/@testuser/storing')) {
          return Promise.resolve({
            contract1: { 
              t: 'alice', 
              u: 1024, 
              p: 3, 
              e: '100000:0',
              n: { '1': 'testuser', '2': 'othernode' }
            }
          });
        }
        return Promise.resolve({});
      });

      // 1. Check node status
      const status = await spk.getNodeStatus();
      expect(status.registered).toBe(true);
      expect(status.service).toBe('IPFS');
      expect(status.domain).toBe('https://test-node.com');

      // 2. Get available contracts
      const available = await spk.getAvailableContracts(10);
      expect(available.length).toBeGreaterThan(0);

      // 3. Get stored contracts
      const stored = await spk.getStoredContracts();
      expect(stored.length).toBeGreaterThan(0);
      expect(stored[0].isStoring).toBe(true);

      // 4. Calculate earnings
      const earnings = spk.calculateStorageEarnings({
        size: stored[0].size,
        providers: stored[0].providers,
        duration: 28800 * 30
      });
      expect(earnings.monthlyBroca).toBeGreaterThan(0);
    });
  });
});