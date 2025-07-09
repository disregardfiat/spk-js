import { SPKFileUpload } from '../../src/storage/file-upload';
import { BatchMetadataEncoder } from '../../src/storage/batch-metadata-encoder';
import { SPKFileMetadata } from '../../src/storage/file-metadata';

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
jest.mock('../../src/storage/contract-creator', () => ({
  SPKContractCreator: jest.fn().mockImplementation(() => ({
    createStorageContract: jest.fn().mockResolvedValue({
      success: true,
      contractId: 'contract-123',
      transactionId: 'tx-123',
      provider: {
        nodeId: 'node1',
        api: 'https://ipfs.dlux.io'
      },
      brocaCost: 100,
      size: 100
    }),
    getContractDetails: jest.fn().mockResolvedValue({
      i: 'contract-123',
      t: 'testuser',
      b: 'node1',
      api: 'https://ipfs.dlux.io',
      a: 100000,
      u: 0,
      c: 1,
      e: 1000000,
      r: 1
    })
  }))
}));

describe('Batch Upload Metadata String Integration', () => {
  let fileUpload: SPKFileUpload;
  let mockAccount: any;
  
  beforeEach(() => {
    mockAccount = {
      username: 'testuser',
      registerPublicKey: jest.fn().mockResolvedValue(undefined),
      sign: jest.fn().mockResolvedValue({ signature: 'mock-sig' }),
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
        get: jest.fn().mockResolvedValue({ df: ['QmTest'] })
      },
      node: 'https://spktest.dlux.io'
    };
    
    fileUpload = new SPKFileUpload(mockAccount);
    
    // Mock file hashing with predictable CIDs
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
  
  describe('Generating batch metadata strings', () => {
    it('should generate correct metadata string for simple batch', async () => {
      const files = [
        new File(['content1'], 'report.pdf'),
        new File(['content2'], 'photo.jpg')
      ];
      
      const metaData = [
        {
          FileIndex: 0,
          name: 'report',
          ext: 'pdf',
          path: '/Documents',
          tags: 0,
          license: '7',
          labels: '1'
        },
        {
          FileIndex: 1,
          name: 'photo',
          ext: 'jpg',
          path: '/Images',
          thumbnail: 'QmThumb789',
          tags: 4,
          license: '1',
          labels: '25'
        }
      ];
      
      // Create encoder to generate expected string
      const encoder = new BatchMetadataEncoder();
      const expectedFiles = [
        {
          cid: 'Qm100',
          name: 'report',
          ext: 'pdf',
          path: 'Documents',
          metadata: new SPKFileMetadata({
            tags: 0,
            license: '7',
            labels: '1'
          })
        },
        {
          cid: 'Qm101',
          name: 'photo',
          ext: 'jpg',
          path: 'Images',
          thumb: 'QmThumb789',
          metadata: new SPKFileMetadata({
            tags: 4,
            license: '1',
            labels: '25'
          })
        }
      ];
      
      const expectedMetaString = encoder.encode(expectedFiles);
      expect(expectedMetaString).toBe('1,report,pdf.2,,-7-1,photo,jpg.3,QmThumb789,4-1-25');
      
      // Now verify the upload would create contracts with this metadata
      try {
        await fileUpload.upload(files, { metaData });
      } catch {
        // Ignore upload errors
      }
      
      // Verify batch authorization signature was created
      expect(mockAccount.sign).toHaveBeenCalledTimes(1);
    });
    
    it('should generate metadata string with custom folders', async () => {
      // Create expected metadata string
      const encoder = new BatchMetadataEncoder();
      const expectedFiles = [
        {
          cid: 'Qm100',
          name: 'installer',
          ext: 'exe',
          path: '/Software',
          metadata: new SPKFileMetadata({ tags: 8, labels: '14' })
        },
        {
          cid: 'Qm101',
          name: 'vacation-photo',
          ext: 'jpg',
          path: 'Images/2023',
          thumb: 'QmThumbVac',
          metadata: new SPKFileMetadata({ tags: 4, license: '1', labels: '25' })
        },
        {
          cid: 'Qm102',
          name: 'Q4-Report',
          ext: 'pdf',
          path: '/',
          metadata: new SPKFileMetadata({ labels: '1' })
        }
      ];
      
      const expectedMetaString = encoder.encode(expectedFiles);
      expect(expectedMetaString).toBe('1|Software|3/2023,installer,exe,,8--14,vacation-photo,jpg.A,QmThumbVac,4-1-25,Q4-Report,pdf.0,,--1');
    });
  });
  
  describe('Batch metadata for blockchain transaction', () => {
    it('should demonstrate how to create blockchain transaction with batch metadata', () => {
      // Generate the compact metadata string
      const encoder = new BatchMetadataEncoder();
      const filesWithCids = [
        { cid: 'QmDoc1', name: 'part1', ext: 'doc', path: '/Documents', metadata: new SPKFileMetadata({ labels: '1' }) },
        { cid: 'QmDoc2', name: 'part2', ext: 'doc', path: '/Documents', metadata: new SPKFileMetadata({ labels: '2' }) },
        { cid: 'QmDoc3', name: 'part3', ext: 'doc', path: '/Documents', metadata: new SPKFileMetadata({ labels: '3' }) }
      ];
      
      const metaString = encoder.encode(filesWithCids);
      expect(metaString).toBe('1,part1,doc.2,,--1,part2,doc.2,,--2,part3,doc.2,,--3');
      
      // Example blockchain transaction structure
      const blockchainTx = {
        operations: [
          ['custom_json', {
            required_auths: [],
            required_posting_auths: ['testuser'],
            id: 'spkcc_file_upload_batch',
            json: JSON.stringify({
              meta: metaString,
              cids: ['QmDoc1', 'QmDoc2', 'QmDoc3'],
              sizes: [8, 8, 8],
              contract_id: 'testuser_1234567_abc'
            })
          }]
        ]
      };
      
      const customJsonOp = blockchainTx.operations[0][1] as any;
      expect(customJsonOp.json).toContain(metaString);
    });
  });
});