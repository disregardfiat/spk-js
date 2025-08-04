import { SPKFile } from '../../../src/storage/file';
import { SPKAccount } from '../../../src/core/account';
import Hash from 'ipfs-only-hash';

jest.mock('../../../src/core/account');
jest.mock('ipfs-only-hash');

// Mock FileReader for Jest environment
const mockFileReader = {
  onload: null as any,
  result: null as any,
  readAsArrayBuffer: function(file: File) {
    // Convert file content to ArrayBuffer
    const content = (file as any).content || file.name; // Use content or fallback to name
    const buffer = new ArrayBuffer(content.length);
    const view = new Uint8Array(buffer);
    for (let i = 0; i < content.length; i++) {
      view[i] = content.charCodeAt(i);
    }
    this.result = buffer;
    if (this.onload) this.onload();
  }
};

(global as any).FileReader = jest.fn(() => mockFileReader);

// Polyfill File.arrayBuffer for Jest environment
if (!File.prototype.arrayBuffer) {
  File.prototype.arrayBuffer = function() {
    return new Promise((resolve) => {
      const reader = new (global as any).FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.readAsArrayBuffer(this);
    });
  };
}

// Mock keychain
const mockKeychain = {
  requestCustomJson: jest.fn()
};

Object.defineProperty(window, 'hive_keychain', {
  value: mockKeychain,
  writable: true
});

// Mock fetch
global.fetch = jest.fn() as jest.Mock;

describe('SPKFile Direct Upload', () => {
  let mockAccount: jest.Mocked<SPKAccount>;
  let spkFile: SPKFile;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    mockAccount = {
      username: 'testuser',
      node: 'https://spktest.dlux.io',
      hasKeychain: true,
      calculateBroca: jest.fn().mockResolvedValue(10000),
      registerPublicKey: jest.fn().mockResolvedValue(undefined)
    } as any;
    
    spkFile = new SPKFile(mockAccount);
    
    (Hash.of as jest.Mock).mockResolvedValue('QmTestHash123');
    
    mockKeychain.requestCustomJson.mockImplementation((_username, _networkId, _keyType, _json, _displayName, callback) => {
      // Simulate successful transaction
      setTimeout(() => callback({ result: { id: 'tx123' } }), 10);
    });
    
    // Mock fetch for authorization and upload
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ authorization: 'mock-auth' }),
      text: jest.fn().mockResolvedValue('success')
    });
    
    // Mock the uploadToIPFS method to avoid actual uploads
    spkFile['uploadToIPFS'] = jest.fn().mockResolvedValue(true);
    
    // Mock the delay method to speed up tests
    spkFile['delay'] = jest.fn().mockResolvedValue(undefined);
  });

  describe('directUpload metadata calculation', () => {
    it('should calculate proper metadata string for single file', async () => {
      const fileData = [{ cid: 'QmTestHash123', size: 12, name: 'test.txt' }];
      const metadata = {
        files: [{
          name: 'test-file',
          ext: 'txt',
          tags: [4, 8],
          labels: '123',
          license: '7'
        }]
      };

      await spkFile.directUpload(fileData, { metadata });

      // Verify keychain call
      expect(mockKeychain.requestCustomJson).toHaveBeenCalled();
      const jsonArg = mockKeychain.requestCustomJson.mock.calls[0][3];
      const parsedJson = JSON.parse(jsonArg);
      
      expect(parsedJson).toMatchObject({
        op: 'direct_upload',
        c: 'QmTestHash123',
        s: '12'
      });
      
      // Verify metadata is properly formatted
      expect(parsedJson.m).toBeTruthy();
      
      // Verify metadata format matches honeycomb expectations (comma-separated string)
      const metaParts = parsedJson.m.split(',');
      
      // Should be: contractData, then 4 parts per file (cid, name, ext, flag, labels, license, etc.)
      expect(metaParts.length).toBe(5); // 1 contract data + 4 file metadata parts
      expect(metaParts[0]).toBe('1'); // Contract data (simple case)
      expect(metaParts[1]).toBe('QmTestHash123'); // CID
      expect(metaParts[2]).toBe('test-file'); // Name
      expect(metaParts[3]).toBe('txt'); // Extension
      // Flag should be Base64 encoded 12 (4|8)
    });

    it('should calculate proper metadata string for multiple files', async () => {
      const fileData = [
        { cid: 'QmTestHash123', size: 8, name: 'file1.txt' },
        { cid: 'QmTestHash456', size: 8, name: 'file2.jpg' }
      ];
      
      const metadata = {
        files: [
          { name: 'doc', ext: 'txt', tags: [4] },
          { name: 'photo', ext: 'jpg', tags: [8], license: '1' }
        ]
      };

      await spkFile.directUpload(fileData, { metadata });

      const jsonArg = mockKeychain.requestCustomJson.mock.calls[0][3];
      const parsedJson = JSON.parse(jsonArg);
      
      expect(parsedJson.c).toBe('QmTestHash123,QmTestHash456');
      expect(parsedJson.s).toBe('8,8');
      
      const metaParts = parsedJson.m.split(',');
      
      // Should be: 1 contract data + (4 parts * 2 files) = 9 parts
      expect(metaParts.length).toBe(9);
      expect(metaParts[0]).toBe('1'); // Contract data
    });

    it('should handle empty metadata correctly', async () => {
      const fileData = [{ cid: 'QmTestHash123', size: 4, name: 'test.txt' }];

      await spkFile.directUpload(fileData, {});

      const jsonArg = mockKeychain.requestCustomJson.mock.calls[0][3];
      const parsedJson = JSON.parse(jsonArg);
      
      expect(parsedJson.m).toBeTruthy();
      
      const metaParts = parsedJson.m.split(',');
      
      // Should be: 1 contract data + 4 file parts = 5 parts
      expect(metaParts.length).toBe(5);
      expect(metaParts[0]).toBe('1'); // Contract data
      expect(metaParts[1]).toBe('QmTestHash123'); // CID
      expect(metaParts[2]).toBe('test'); // Name (from filename)
      expect(metaParts[3]).toBe('txt'); // Extension
      expect(metaParts[4]).toBe(''); // Empty metadata
    });
  });

  describe('JSON payload chunking', () => {
    it('should handle small payloads without chunking', async () => {
      const fileData = [{ cid: 'QmTestHash123', size: 5, name: 'small.txt' }];
      
      await spkFile.directUpload(fileData, {});
      
      // Should only have one keychain call (no chunking)
      expect(mockKeychain.requestCustomJson).toHaveBeenCalledTimes(1);
    });

    it('should chunk large metadata payloads over 7800 bytes', async () => {
      const largeFileData = Array.from({ length: 100 }, (_, i) => ({
        cid: `QmTestHash${i.toString().padStart(3, '0')}`,
        size: 7,
        name: `file${i}.txt`
      }));
      
      const largeMetadata = {
        files: largeFileData.map((_, i) => ({
          name: `file-${i}`,
          ext: 'txt',
          tags: [4, 8],
          labels: '123456789'.repeat(20), // Make each file metadata large
          license: '7'
        }))
      };

      await spkFile.directUpload(largeFileData, { metadata: largeMetadata });

      // Should have multiple keychain calls due to chunking
      expect(mockKeychain.requestCustomJson).toHaveBeenCalledTimes(3);
      
      // First call should be the initial chunk
      const firstCall = mockKeychain.requestCustomJson.mock.calls[0][3];
      const firstJson = JSON.parse(firstCall);
      expect(firstJson.op).toBe('direct_upload');
      
      // Second call should be the next chunk
      const secondCall = mockKeychain.requestCustomJson.mock.calls[1][3];
      const secondJson = JSON.parse(secondCall);
      expect(secondJson.op).toBe('direct_upload');
    });

    it('should properly format chunked uploads', async () => {
      // Create a scenario that will definitely require chunking
      const manyFileData = Array.from({ length: 50 }, (_, i) => ({
        cid: `QmTestHash${i.toString().padStart(3, '0')}`,
        size: 7,
        name: `file${i}.txt`
      }));
      
      const metadata = {
        files: manyFileData.map((_, i) => ({
          name: `very-long-file-name-${i}`.repeat(10),
          ext: 'txt',
          tags: [4, 8, 16, 32],
          labels: '123456789'.repeat(50),
          license: '7'
        }))
      };

      await spkFile.directUpload(manyFileData, { metadata });

      // Verify all chunks have proper format
      mockKeychain.requestCustomJson.mock.calls.forEach((call) => {
        const json = JSON.parse(call[3]);
        expect(json.op).toBe('direct_upload');
        
        // Each chunk should have properly formatted metadata
        expect(json.m).toBeTruthy();
        expect(json.m.split(',').length % 4).toBe(1); // Contract data + (4 * n files)
        
        // Ensure chunk payload is under 7800 bytes
        expect(JSON.stringify(json).length).toBeLessThan(7800);
      });
    });

    it('should split files across chunks when metadata is too large', async () => {
      const fileData = Array.from({ length: 30 }, (_, i) => ({
        cid: `QmTestHash${i.toString().padStart(3, '0')}`,
        size: 7,
        name: `file${i}.txt`
      }));
      
      const largeMetadata = {
        files: fileData.map(() => ({
          name: 'x'.repeat(200), // Very long names
          ext: 'txt',
          tags: [4, 8, 16, 32, 64, 128, 256, 512], // Many tags
          labels: '123456789'.repeat(30),
          license: '7'
        }))
      };

      await spkFile.directUpload(fileData, { metadata: largeMetadata });

      expect(mockKeychain.requestCustomJson).toHaveBeenCalledTimes(2);
      
      // Verify files are split across chunks
      const firstCall = JSON.parse(mockKeychain.requestCustomJson.mock.calls[0][3]);
      const secondCall = JSON.parse(mockKeychain.requestCustomJson.mock.calls[1][3]);
      
      const firstCids = firstCall.c.split(',');
      const secondCids = secondCall.c.split(',');
      
      expect(firstCids.length + secondCids.length).toBe(30);
      expect(firstCids.length).toBeGreaterThan(0);
      expect(secondCids.length).toBeGreaterThan(0);
    });

    it('should add delays between chunked transactions', async () => {
      const fileData = Array.from({ length: 50 }, (_, i) => ({
        cid: `QmTestHash${i.toString().padStart(3, '0')}`,
        size: 7,
        name: `file${i}.txt`
      }));
      
      const largeMetadata = {
        files: fileData.map(() => ({
          name: 'x'.repeat(200),
          ext: 'txt',
          tags: [4, 8, 16, 32],
          labels: '123456789'.repeat(30),
          license: '7'
        }))
      };

      await spkFile.directUpload(fileData, { metadata: largeMetadata });

      // Should have called delay method (chunks - 1) times
      const chunkCount = mockKeychain.requestCustomJson.mock.calls.length;
      expect(spkFile['delay']).toHaveBeenCalledTimes(chunkCount - 1);
      expect(spkFile['delay']).toHaveBeenCalledWith(5000);
    });
  });

  describe('error handling', () => {
    it('should handle keychain errors', async () => {
      mockKeychain.requestCustomJson.mockImplementation((_username, _networkId, _keyType, _json, _displayName, callback) => {
        callback({ error: 'User denied transaction' });
      });

      const fileData = [{ cid: 'QmTestHash123', size: 4, name: 'test.txt' }];
      
      await expect(spkFile.directUpload(fileData, {})).rejects.toThrow('User denied transaction');
    });

    it('should handle insufficient BROCA', async () => {
      mockAccount.calculateBroca.mockResolvedValue(10); // Very low BROCA
      
      const largeFileData = [{ cid: 'QmTestHash123', size: 1024 * 1024, name: 'large.txt' }]; // 1MB file
      
      await expect(spkFile.directUpload(largeFileData, {})).rejects.toThrow(/Insufficient BROCA/);
    });

    it('should handle missing keychain', async () => {
      mockAccount.hasKeychain = false;
      
      const fileData = [{ cid: 'QmTestHash123', size: 4, name: 'test.txt' }];
      
      await expect(spkFile.directUpload(fileData, {})).rejects.toThrow('Hive Keychain not available');
    });
  });

  describe('network ID selection', () => {
    it('should use spktest network for test nodes', async () => {
      mockAccount.node = 'https://spktest.dlux.io';
      
      const fileData = [{ cid: 'QmTestHash123', size: 4, name: 'test.txt' }];
      await spkFile.directUpload(fileData, {});
      
      expect(mockKeychain.requestCustomJson).toHaveBeenCalledWith(
        'testuser',
        'spkcc_spktest',
        'Active',
        expect.any(String),
        expect.any(String),
        expect.any(Function)
      );
    });

    it('should use main network for production nodes', async () => {
      mockAccount.node = 'https://dlux.io';
      
      const fileData = [{ cid: 'QmTestHash123', size: 4, name: 'test.txt' }];
      await spkFile.directUpload(fileData, {});
      
      expect(mockKeychain.requestCustomJson).toHaveBeenCalledWith(
        'testuser',
        'spkcc_dlux',
        'Active',
        expect.any(String),
        expect.any(String),
        expect.any(Function)
      );
    });
  });
});