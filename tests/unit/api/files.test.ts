import { FileSearchAPI } from '../../../src/api/files';
import { HoneygraphClient } from '../../../src/api/honeygraph';

// Mock the HoneygraphClient
jest.mock('../../../src/api/honeygraph');

describe('FileSearchAPI', () => {
  let fileAPI: FileSearchAPI;
  let mockClient: jest.Mocked<HoneygraphClient>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = new HoneygraphClient() as jest.Mocked<HoneygraphClient>;
    fileAPI = new FileSearchAPI(mockClient);
  });

  describe('searchFiles', () => {
    it('should search files by query string', async () => {
      const mockResults = {
        files: [
          {
            cid: 'QmTest123',
            name: 'tutorial-video.mp4',
            size: 104857600,
            path: '/Videos/tutorial-video.mp4',
            tags: ['tutorial', 'education'],
            owner: { username: 'alice' },
            contract: {
              expiresBlock: 98000000,
              status: 'ACTIVE'
            },
            uploadedAt: '2024-01-01T00:00:00Z'
          }
        ]
      };

      mockClient.searchFiles.mockResolvedValueOnce(mockResults);

      const result = await fileAPI.searchFiles({ q: 'tutorial' });

      expect(mockClient.searchFiles).toHaveBeenCalledWith({ q: 'tutorial' });
      expect(result).toEqual(mockResults.files);
    });

    it('should search files by tags', async () => {
      const mockResults = {
        files: [
          { cid: 'QmTest1', name: 'video1.mp4', tags: ['tutorial', 'video'] },
          { cid: 'QmTest2', name: 'video2.mp4', tags: ['tutorial', 'education'] }
        ]
      };

      mockClient.searchFiles.mockResolvedValueOnce(mockResults);

      const result = await fileAPI.searchFiles({ tags: ['tutorial', 'video'] });

      expect(mockClient.searchFiles).toHaveBeenCalledWith({ tags: 'tutorial,video' });
      expect(result).toHaveLength(2);
    });

    it('should search files by owner', async () => {
      const mockResults = {
        files: [
          { cid: 'QmTest1', name: 'file1.pdf', owner: { username: 'alice' } },
          { cid: 'QmTest2', name: 'file2.pdf', owner: { username: 'alice' } }
        ]
      };

      mockClient.searchFiles.mockResolvedValueOnce(mockResults);

      const result = await fileAPI.searchFiles({ owner: 'alice' });

      expect(mockClient.searchFiles).toHaveBeenCalledWith({ owner: 'alice' });
      expect(result).toHaveLength(2);
      expect(result.every(f => f.owner.username === 'alice')).toBe(true);
    });

    it('should support combined search criteria', async () => {
      mockClient.searchFiles.mockResolvedValueOnce({ files: [] });

      await fileAPI.searchFiles({
        q: 'tutorial',
        tags: ['video', 'education'],
        owner: 'alice',
        limit: 25
      });

      expect(mockClient.searchFiles).toHaveBeenCalledWith({
        q: 'tutorial',
        tags: 'video,education',
        owner: 'alice',
        limit: 25
      });
    });

    it('should handle empty results', async () => {
      mockClient.searchFiles.mockResolvedValueOnce({ files: [] });

      const result = await fileAPI.searchFiles({ q: 'nonexistent' });

      expect(result).toEqual([]);
    });
  });

  describe('getFileProviders', () => {
    it('should get storage providers for a file', async () => {
      const mockProviders = {
        cid: 'QmTest123',
        providers: [
          {
            username: 'node1',
            nodeId: 'node1-ipfs',
            status: 'ACTIVE',
            lastValidation: '2024-01-01T00:00:00Z',
            reliability: 99.9
          },
          {
            username: 'node2',
            nodeId: 'node2-ipfs',
            status: 'ACTIVE',
            lastValidation: '2024-01-01T01:00:00Z',
            reliability: 98.5
          }
        ],
        totalProviders: 2,
        minRequired: 3
      };

      mockClient.getFileProviders.mockResolvedValueOnce(mockProviders);

      const result = await fileAPI.getFileProviders('QmTest123');

      expect(mockClient.getFileProviders).toHaveBeenCalledWith('QmTest123');
      expect(result).toEqual(mockProviders);
      expect(result.providers).toHaveLength(2);
    });

    it('should handle files with no providers', async () => {
      const mockProviders = {
        cid: 'QmTest123',
        providers: [],
        totalProviders: 0,
        minRequired: 3
      };

      mockClient.getFileProviders.mockResolvedValueOnce(mockProviders);

      const result = await fileAPI.getFileProviders('QmTest123');

      expect(result.providers).toEqual([]);
      expect(result.totalProviders).toBe(0);
    });
  });

  describe('getFileMetadata', () => {
    it('should get detailed file metadata', async () => {
      const mockMetadata = {
        cid: 'QmTest123',
        name: 'document.pdf',
        size: 1048576,
        mimeType: 'application/pdf',
        uploadedAt: '2024-01-01T00:00:00Z',
        owner: { username: 'alice' },
        contract: {
          id: 'alice:0:12345-abc',
          expiresBlock: 98000000,
          status: 'ACTIVE',
          autoRenew: true
        },
        tags: ['important', 'work'],
        labels: ['confidential'],
        license: 'CC-BY-4.0',
        metadata: {
          description: 'Important work document',
          author: 'Alice Smith'
        },
        versions: [
          {
            cid: 'QmOld123',
            uploadedAt: '2023-12-01T00:00:00Z',
            contractId: 'alice:0:12344-xyz'
          }
        ]
      };

      // Mock through general get method since getFileMetadata might not exist on client
      mockClient.get = jest.fn().mockResolvedValueOnce(mockMetadata);

      const result = await fileAPI.getFileMetadata('QmTest123');

      expect(mockClient.get).toHaveBeenCalledWith('/api/spk/file/QmTest123');
      expect(result).toEqual(mockMetadata);
    });
  });

  describe('getRecentUploads', () => {
    it('should get recently uploaded files', async () => {
      const mockRecent = {
        files: [
          {
            cid: 'QmNew1',
            name: 'new-file1.jpg',
            uploadedAt: '2024-01-02T12:00:00Z'
          },
          {
            cid: 'QmNew2',
            name: 'new-file2.pdf',
            uploadedAt: '2024-01-02T11:00:00Z'
          }
        ]
      };

      mockClient.get = jest.fn().mockResolvedValueOnce(mockRecent);

      const result = await fileAPI.getRecentUploads(10);

      expect(mockClient.get).toHaveBeenCalledWith('/api/spk/files/recent', { limit: 10 });
      expect(result).toEqual(mockRecent.files);
    });

    it('should use default limit if not specified', async () => {
      mockClient.get = jest.fn().mockResolvedValueOnce({ files: [] });

      await fileAPI.getRecentUploads();

      expect(mockClient.get).toHaveBeenCalledWith('/api/spk/files/recent', { limit: 50 });
    });
  });

  describe('searchByTags', () => {
    it('should search files by specific tags', async () => {
      const mockResults = {
        files: [
          { cid: 'Qm1', tags: ['nft', 'art'] },
          { cid: 'Qm2', tags: ['nft', 'music'] }
        ]
      };

      mockClient.searchFiles.mockResolvedValueOnce(mockResults);

      const result = await fileAPI.searchByTags(['nft']);

      expect(mockClient.searchFiles).toHaveBeenCalledWith({ tags: 'nft', tagLogic: 'OR' });
      expect(result).toHaveLength(2);
    });

    it('should support multiple tags with AND logic', async () => {
      mockClient.searchFiles.mockResolvedValueOnce({ files: [] });

      await fileAPI.searchByTags(['video', 'tutorial', 'spk'], 'AND');

      expect(mockClient.searchFiles).toHaveBeenCalledWith({ 
        tags: 'video,tutorial,spk',
        tagLogic: 'AND'
      });
    });
  });

  describe('getFilesByPath', () => {
    it('should get files in a specific path', async () => {
      const mockFiles = {
        files: [
          { cid: 'Qm1', path: '/Documents/work/report.pdf' },
          { cid: 'Qm2', path: '/Documents/work/presentation.pptx' }
        ]
      };

      mockClient.get = jest.fn().mockResolvedValueOnce(mockFiles);

      const result = await fileAPI.getFilesByPath('alice', '/Documents/work');

      expect(mockClient.get).toHaveBeenCalledWith('/api/spk/files/by-path', {
        owner: 'alice',
        path: '/Documents/work'
      });
      expect(result).toHaveLength(2);
    });
  });

  describe('getFileStats', () => {
    it('should get file statistics for a CID', async () => {
      const mockStats = {
        cid: 'QmTest123',
        totalDownloads: 150,
        uniqueDownloads: 75,
        bandwidth: 157286400, // 150MB
        lastAccessed: '2024-01-02T00:00:00Z',
        popularityScore: 85,
        storageNodes: 3,
        replicationFactor: 3
      };

      mockClient.get = jest.fn().mockResolvedValueOnce(mockStats);

      const result = await fileAPI.getFileStats('QmTest123');

      expect(mockClient.get).toHaveBeenCalledWith('/api/spk/file/QmTest123/stats');
      expect(result).toEqual(mockStats);
    });
  });

  describe('searchSimilarFiles', () => {
    it('should find files similar to a given file', async () => {
      const mockSimilar = {
        basedOn: 'QmTest123',
        similar: [
          {
            cid: 'QmSimilar1',
            name: 'related-doc.pdf',
            similarity: 0.85,
            reason: 'same owner and tags'
          },
          {
            cid: 'QmSimilar2',
            name: 'another-doc.pdf',
            similarity: 0.72,
            reason: 'similar tags'
          }
        ]
      };

      mockClient.get = jest.fn().mockResolvedValueOnce(mockSimilar);

      const result = await fileAPI.searchSimilarFiles('QmTest123');

      expect(mockClient.get).toHaveBeenCalledWith('/api/spk/file/QmTest123/similar');
      expect(result).toEqual(mockSimilar.similar);
    });
  });
});