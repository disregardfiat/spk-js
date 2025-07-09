import { SPKFileUpload, BatchUploadResult } from '../../src/storage/file-upload';

// Mock provider selector
jest.mock('../../src/storage/provider-selector', () => ({
  StorageProviderSelector: jest.fn().mockImplementation(() => ({
    selectBestProvider: jest.fn().mockResolvedValue({
      nodeId: 'node1',
      api: 'https://ipfs.dlux.io',
      freeSpace: 1000000000
    }),
    formatBytes: jest.fn().mockImplementation(bytes => `${bytes} Bytes`)
  }))
}));

// Mock contract creator
const mockCreateStorageContract = jest.fn();
const mockGetContractDetails = jest.fn();

jest.mock('../../src/storage/contract-creator', () => ({
  SPKContractCreator: jest.fn().mockImplementation(() => ({
    createStorageContract: mockCreateStorageContract,
    getContractDetails: mockGetContractDetails
  }))
}));

describe('Batch Metadata Integration - Contract Creation', () => {
  let fileUpload: SPKFileUpload;
  let mockAccount: any;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock returns
    mockCreateStorageContract.mockResolvedValue({
      success: true,
      contractId: 'contract-123',
      transactionId: 'tx-123',
      provider: {
        nodeId: 'node1',
        api: 'https://ipfs.dlux.io'
      },
      brocaCost: 100,
      size: 100
    });
    
    mockGetContractDetails.mockResolvedValue({
      i: 'contract-123',
      t: 'testuser',
      b: 'node1',
      api: 'https://ipfs.dlux.io',
      a: 100000,
      u: 0,
      c: 1,
      e: 1000000,
      r: 1
    });
    
    mockAccount = {
      username: 'testuser',
      registerPublicKey: jest.fn().mockResolvedValue(undefined),
      sign: jest.fn().mockResolvedValue('mock-sig'),
      calculateBroca: jest.fn().mockResolvedValue(10000),
      api: {
        post: jest.fn().mockResolvedValue({
          id: 'contract-123',
          df: ['QmTest'],
          i: 'contract-123',
          t: 'testuser',
          fosig: 'mock-sig',
          api: 'https://ipfs.dlux.io'
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
    it('should create a single contract with metadata array for batch uploads', async () => {
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
      
      const result = await fileUpload.upload(files, { metaData }) as BatchUploadResult;
      
      // Should create only 1 contract for the batch
      expect(mockCreateStorageContract).toHaveBeenCalledTimes(1);
      
      // Should create 1 batch authorization signature
      expect(mockAccount.sign).toHaveBeenCalledTimes(1);
      
      // Check the contract has metadata array
      expect(result.results).toHaveLength(3);
      const contract = result.results[0].contract;
      expect(contract.metadata).toBeInstanceOf(Array);
      expect(contract.metadata).toHaveLength(3);
      
      // Check each file's metadata in the array
      expect(contract.metadata[0]).toMatchObject({
        cid: 'Qm100',
        name: 'Q4-Financial-Report',
        ext: 'pdf',
        labels: '1',
        license: '4'
        // No flag since tags = 0
      });
      
      expect(contract.metadata[1]).toMatchObject({
        cid: 'Qm101',
        name: 'Vacation-2023',
        ext: 'jpg',
        thumb: 'QmThumb123',
        flag: '4', // Base64 of 4
        labels: '25',
        license: '1'
      });
      
      expect(contract.metadata[2]).toMatchObject({
        cid: 'Qm102',
        name: 'Tutorial-Video',
        ext: 'mp4',
        labels: '2',
        license: '2'
        // No flag since tags = 0
      });
    });
    
    it('should use same contract for all files in batch', async () => {
      const files = [
        new File(['doc1'], 'part1.doc'),
        new File(['doc2'], 'part2.doc'),
        new File(['doc3'], 'part3.doc')
      ];
      
      const result = await fileUpload.upload(files) as BatchUploadResult;
      
      // All files should share the same contract
      expect(result.results).toHaveLength(3);
      const contractIds = result.results.map(r => r.contract.i);
      expect(contractIds[0]).toBe('contract-123');
      expect(contractIds[0]).toBe(contractIds[1]);
      expect(contractIds[1]).toBe(contractIds[2]);
      
      // Should have created only one contract
      expect(mockCreateStorageContract).toHaveBeenCalledTimes(1);
      
      // Contract ID format follows pattern
      expect(result.contractId).toBe('contract-123');
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
      
      const result = await fileUpload.upload(files, { metaData });
      
      // For single file, metadata is stored directly in contract
      expect(result).toHaveProperty('contract');
      expect((result as any).contract.metadata).toEqual({
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
      
      const result = await fileUpload.upload(files);
      
      // Should have minimal metadata
      expect(result).toHaveProperty('contract');
      expect((result as any).contract.metadata).toEqual({});
    });
  });
});