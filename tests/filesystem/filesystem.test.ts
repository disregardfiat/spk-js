import { FileSystem } from '../../src/filesystem';
import { Api } from '../../src/core/api';

describe('FileSystem', () => {
  let filesystem: FileSystem;
  let mockApi: jest.Mocked<Api>;

  beforeEach(() => {
    mockApi = {} as jest.Mocked<Api>;
    filesystem = new FileSystem(mockApi);
  });

  describe('browse', () => {
    it('should fetch directory listing for root path', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          path: '/',
          username: 'testuser',
          type: 'directory',
          contents: [
            {
              name: 'Documents',
              type: 'directory',
              path: '/Documents',
              itemCount: 5
            },
            {
              name: 'test.txt',
              type: 'file',
              path: '/test.txt',
              cid: 'QmTest123',
              size: 1024,
              mimeType: 'text/plain',
              contract: {
                id: 'testuser:0:12345',
                blockNumber: 12345
              }
            }
          ]
        })
      });

      const result = await filesystem.browse('testuser');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://honeygraph.dlux.io/fs/testuser/',
        expect.objectContaining({
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          redirect: 'manual'
        })
      );

      expect(result).toMatchObject({
        path: '/',
        username: 'testuser',
        type: 'directory',
        contents: expect.arrayContaining([
          expect.objectContaining({ name: 'Documents' }),
          expect.objectContaining({ name: 'test.txt' })
        ])
      });
    });

    it('should handle file redirects', async () => {
      const headers = new Map([
        ['Location', 'https://ipfs.dlux.io/ipfs/QmTest123'],
        ['X-IPFS-CID', 'QmTest123'],
        ['X-Contract-ID', 'testuser:0:12345'],
        ['X-Block-Number', '12345'],
        ['X-Storage-Node', 'storagenode1'],
        ['X-Gateway-Priority', 'storage-node']
      ]);

      global.fetch = jest.fn().mockResolvedValue({
        status: 302,
        headers: {
          get: (key: string) => headers.get(key)
        }
      });

      const result = await filesystem.browse('testuser', '/test.txt');

      expect(result).toMatchObject({
        cid: 'QmTest123',
        contractId: 'testuser:0:12345',
        blockNumber: 12345,
        storageNode: 'storagenode1',
        gatewayUrl: 'https://ipfs.dlux.io/ipfs/QmTest123',
        gatewayPriority: 'storage-node'
      });
    });
  });

  describe('getSharedWithMe', () => {
    it('should fetch files shared with user', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          path: '/',
          username: 'testuser',
          type: 'directory',
          contents: [
            {
              name: 'shared-doc.pdf',
              type: 'file',
              path: '/shared-doc.pdf',
              cid: 'QmShared123',
              size: 2048,
              mimeType: 'application/pdf',
              metadata: {
                encrypted: true,
                sharedBy: 'otheruser'
              }
            }
          ]
        })
      });

      const result = await filesystem.getSharedWithMe('testuser');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://honeygraph.dlux.io/fse/testuser/',
        expect.objectContaining({
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        })
      );

      expect(result.contents[0]).toMatchObject({
        name: 'shared-doc.pdf',
        metadata: {
          encrypted: true,
          sharedBy: 'otheruser'
        }
      });
    });
  });

  describe('getFileUrl', () => {
    it('should return the gateway URL for a file', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        status: 302,
        headers: {
          get: (key: string) => {
            const headers: Record<string, string> = {
              'Location': 'https://ipfs.dlux.io/ipfs/QmTest123',
              'X-IPFS-CID': 'QmTest123',
              'X-Contract-ID': 'testuser:0:12345',
              'X-Block-Number': '12345',
              'X-Storage-Node': 'storagenode1',
              'X-Gateway-Priority': 'storage-node'
            };
            return headers[key];
          }
        }
      });

      const url = await filesystem.getFileUrl('testuser', '/test.txt');
      expect(url).toBe('https://ipfs.dlux.io/ipfs/QmTest123');
    });
  });

  describe('searchFiles', () => {
    it('should search files by pattern', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          path: '/',
          username: 'testuser',
          type: 'directory',
          contents: [
            { name: 'test.txt', type: 'file', path: '/test.txt' },
            { name: 'test.pdf', type: 'file', path: '/test.pdf' },
            { name: 'image.png', type: 'file', path: '/image.png' }
          ]
        })
      });

      const results = await filesystem.searchFiles('testuser', 'test*');
      
      expect(results).toHaveLength(2);
      expect(results[0].name).toBe('test.txt');
      expect(results[1].name).toBe('test.pdf');
    });
  });

  describe('exists', () => {
    it('should return true if path exists', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ path: '/Documents', type: 'directory' })
      });

      const exists = await filesystem.exists('testuser', '/Documents');
      expect(exists).toBe(true);
    });

    it('should return false if path does not exist', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Not found'));

      const exists = await filesystem.exists('testuser', '/nonexistent');
      expect(exists).toBe(false);
    });
  });

  describe('getPresetFolders', () => {
    it('should return only preset folders', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          path: '/',
          username: 'testuser',
          type: 'directory',
          contents: [
            { name: 'Documents', type: 'directory', path: '/Documents', itemCount: 5 },
            { name: 'Images', type: 'directory', path: '/Images', itemCount: 10 },
            { name: 'CustomFolder', type: 'directory', path: '/CustomFolder', itemCount: 2 },
            { name: 'file.txt', type: 'file', path: '/file.txt' }
          ]
        })
      });

      const folders = await filesystem.getPresetFolders('testuser');
      
      expect(folders).toHaveLength(2);
      expect(folders[0].name).toBe('Documents');
      expect(folders[1].name).toBe('Images');
    });
  });
});