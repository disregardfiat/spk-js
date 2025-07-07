import { SPKFileUpload } from '../../src/storage/file-upload';

describe('Batch Metadata Integration - Contract Creation', () => {
  let fileUpload: SPKFileUpload;
  let mockAccount: any;
  let capturedContractData: any[] = [];
  
  beforeEach(() => {
    capturedContractData = [];
    
    mockAccount = {
      username: 'testuser',
      registerPublicKey: jest.fn().mockResolvedValue(undefined),
      sign: jest.fn().mockResolvedValue({ signature: 'mock-sig' }),
      calculateBroca: jest.fn().mockResolvedValue(10000),
      api: {
        post: jest.fn().mockImplementation((endpoint, data) => {
          // Capture contract creation data
          if (endpoint === '/api/new_contract') {
            capturedContractData.push(data);
          }
          return Promise.resolve({
            id: `contract-${Date.now()}`,
            df: ['QmTest'],
            i: 'contract-123',
            t: 'testuser',
            fosig: 'mock-sig',
            api: 'https://ipfs.dlux.io'
          });
        }),
        get: jest.fn().mockResolvedValue({ df: ['QmTest'], i: 'contract-123' })
      },
      node: 'https://spktest.dlux.io'
    };
    
    fileUpload = new SPKFileUpload(mockAccount);
    
    // Mock file hashing
    let hashCounter = 100;
    fileUpload['hashFile'] = jest.fn().mockImplementation(() => {
      return Promise.resolve(`Qm${hashCounter++}`);
    });
    
    // Mock XMLHttpRequest
    global.XMLHttpRequest = jest.fn(() => ({
      open: jest.fn(),
      send: jest.fn(),
      setRequestHeader: jest.fn(),
      upload: { addEventListener: jest.fn() },
      addEventListener: jest.fn((event, callback) => {
        if (event === 'load') setTimeout(() => callback(), 10);
      }),
      status: 200,
      responseText: ''
    })) as any;
    
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ success: true })
    });
  });
  
  describe('Batch metadata structure', () => {
    it('should create individual contracts with proper metadata for each file', async () => {
      const files = [
        new File(['content1'], 'report.pdf', { type: 'application/pdf' }),
        new File(['content2'], 'photo.jpg', { type: 'image/jpeg' }),
        new File(['content3'], 'video.mp4', { type: 'video/mp4' })
      ];
      
      const metaData = [
        {
          FileIndex: 0,
          name: 'Q4-Financial-Report',
          ext: 'pdf',
          path: '/Documents/Reports',
          tags: 0,
          labels: '1', // Important
          license: '4' // CC BY-NC-ND
        },
        {
          FileIndex: 1,
          name: 'Vacation-2023',
          ext: 'jpg',
          path: '/Images/Trips',
          thumbnail: 'QmThumb123',
          tags: [4], // NSFW
          labels: '25', // Favorite + Orange
          license: '1' // CC BY
        },
        {
          FileIndex: 2,
          name: 'Tutorial-Video',
          ext: 'mp4',
          path: '/Videos/Educational',
          tags: 0,
          labels: '2', // Favorite
          license: '2' // CC BY-SA
        }
      ];
      
      try {
        await fileUpload.upload(files, { metaData });
      } catch {
        // Ignore upload errors
      }
      
      // Should create 3 separate contracts
      expect(capturedContractData).toHaveLength(3);
      
      // Check each contract has correct metadata
      expect(capturedContractData[0]).toMatchObject({
        cid: 'Qm100',
        metadata: {
          name: 'Q4-Financial-Report',
          ext: 'pdf',
          path: '/Documents/Reports',
          labels: '1',
          license: '4'
          // No flag since tags = 0
        }
      });
      
      expect(capturedContractData[1]).toMatchObject({
        cid: 'Qm101',
        metadata: {
          name: 'Vacation-2023',
          ext: 'jpg',
          path: '/Images/Trips',
          thumb: 'QmThumb123',
          flag: '4', // Base64 of 4
          labels: '25',
          license: '1'
        }
      });
      
      expect(capturedContractData[2]).toMatchObject({
        cid: 'Qm102',
        metadata: {
          name: 'Tutorial-Video',
          ext: 'mp4',
          path: '/Videos/Educational',
          labels: '2',
          license: '2'
          // No flag since tags = 0
        }
      });
    });
    
    it('should include batchId for related files', async () => {
      const files = [
        new File(['doc1'], 'part1.doc'),
        new File(['doc2'], 'part2.doc'),
        new File(['doc3'], 'part3.doc')
      ];
      
      try {
        await fileUpload.upload(files);
      } catch {
        // Ignore errors
      }
      
      // All contracts should have same batchId
      expect(capturedContractData).toHaveLength(3);
      const batchIds = capturedContractData.map(c => c.batchId);
      expect(batchIds[0]).toBeDefined();
      expect(batchIds[0]).toBe(batchIds[1]);
      expect(batchIds[0]).toBe(batchIds[2]);
      expect(batchIds[0]).toMatch(/testuser_\d+_/);
    });
  });
  
  describe('SPK Network transaction format', () => {
    it('should demonstrate expected blockchain transaction format', () => {
      // This test documents what the final blockchain transaction might look like
      // when multiple files are uploaded together
      
      // Example of what might be sent to the blockchain:
      const exampleTransaction = {
        json_metadata: {
          app: 'spk/0.1.0',
          files: [
            {
              cid: 'QmDoc123',
              size: 1024,
              name: 'report',
              ext: 'pdf',
              path: '/Documents',
              flag: '0',
              license: '7',
              labels: '1'
            },
            {
              cid: 'QmImg456',
              size: 2048,
              name: 'photo',
              ext: 'jpg',
              path: '/Images',
              thumb: 'QmThumb789',
              flag: '4',
              license: '1',
              labels: '25'
            }
          ],
          // Compact string format alternative:
          meta: '1,report,pdf.2,,0-7-1,photo,jpg.3,QmThumb789,4-1-25'
        }
      };
      
      expect(exampleTransaction).toBeDefined();
    });
  });
  
  describe('Metadata validation', () => {
    it('should properly format complex metadata combinations', async () => {
      const files = [
        new File(['exe'], 'dangerous.exe', { type: 'application/x-msdownload' })
      ];
      
      const metaData = [{
        FileIndex: 0,
        name: 'suspicious-file',
        ext: 'exe',
        tags: [4, 8], // NSFW + Executable = 12
        labels: '14789', // Multiple warnings
        license: '' // No license
      }];
      
      try {
        await fileUpload.upload(files, { metaData });
      } catch {
        // Ignore errors
      }
      
      expect(capturedContractData[0].metadata).toEqual({
        name: 'suspicious-file',
        ext: 'exe',
        flag: 'C', // Base64 of 12
        labels: '14789'
        // No license field when empty
      });
    });
    
    it('should handle files with minimal metadata', async () => {
      const files = [
        new File(['txt'], 'simple.txt')
      ];
      
      try {
        await fileUpload.upload(files);
      } catch {
        // Ignore errors
      }
      
      // Should have minimal metadata
      expect(capturedContractData[0].metadata).toEqual({});
    });
  });
});