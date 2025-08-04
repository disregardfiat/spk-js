import { DirectUpload, DirectUploadOptions, FileMetadataObject } from '../../../src/storage/direct-upload';
import { SPKAccount } from '../../../src/core/account';
import { SPKAPI } from '../../../src/core/api';
import { KeychainAdapter } from '../../../src/core/keychain-adapter';

describe('DirectUpload Metadata Array Support', () => {
  let directUpload: DirectUpload;
  let mockAccount: jest.Mocked<SPKAccount>;
  let mockApi: jest.Mocked<SPKAPI>;
  let mockKeychain: jest.Mocked<KeychainAdapter>;

  beforeEach(() => {
    // Mock account
    mockAccount = {
      username: 'testuser',
      calculateBroca: jest.fn().mockResolvedValue(100000),
    } as any;

    // Mock API
    mockApi = {
      get: jest.fn(),
    } as any;

    // Mock keychain adapter
    mockKeychain = {
      isAvailable: jest.fn().mockReturnValue(true),
      broadcastCustomJson: jest.fn().mockResolvedValue({ id: 'tx123' }),
    } as any;

    directUpload = new DirectUpload(mockAccount, mockApi, mockKeychain);
  });

  describe('metadata array to string conversion', () => {
    it('should accept metadata as array of objects', async () => {
      const options: DirectUploadOptions = {
        cids: ['QmTest1', 'QmTest2'],
        sizes: [100, 200],
        id: 'upload-123',
        metadata: [
          {
            name: 'video',
            ext: 'mp4',
            path: 'Videos/movie.mp4',
            thumbnail: 'QmThumb1',
            flag: 1,
            license: 'CC-BY',
            labels: 'movie,action'
          },
          {
            name: 'segment',
            ext: 'ts',
            path: '',
            flag: 2, // hidden
          }
        ]
      };

      const result = await directUpload.upload(options);

      expect(result.success).toBe(true);
      expect(mockKeychain.broadcastCustomJson).toHaveBeenCalled();
      
      // Check the custom JSON that was broadcast
      const callArgs = mockKeychain.broadcastCustomJson.mock.calls[0];
      const json = callArgs[3];
      
      // Metadata should be converted to string
      expect(typeof json.m).toBe('string');
      expect(json.m).toContain('video');
      expect(json.m).toContain('mp4');
    });

    it('should handle video transcoding metadata correctly', async () => {
      const videoMetadata: FileMetadataObject[] = [
        {
          name: 'my-video',
          ext: 'm3u8',
          path: 'master.m3u8',
          description: 'Main playlist',
          thumbnail: 'QmThumb123',
          flag: 1 // visible
        },
        {
          name: '',
          ext: '',
          path: '',
          flag: 2 // hidden segment
        },
        {
          name: '',
          ext: '',
          path: '',
          flag: 2 // hidden segment
        }
      ];

      const options: DirectUploadOptions = {
        cids: ['QmPlaylist', 'QmSegment1', 'QmSegment2'],
        sizes: [500, 1000, 1000],
        id: 'video-upload-123',
        metadata: videoMetadata
      };

      const result = await directUpload.upload(options);

      expect(result.success).toBe(true);
      
      const json = mockKeychain.broadcastCustomJson.mock.calls[0][3];
      expect(json.c).toBe('QmPlaylist,QmSegment1,QmSegment2');
      expect(json.s).toBe('500,1000,1000');
      
      // Verify metadata string contains proper formatting
      const metadataParts = json.m.split(',');
      expect(metadataParts.length).toBeGreaterThan(4); // At least header + 1 file
    });

    it('should still accept string metadata for backward compatibility', async () => {
      const options: DirectUploadOptions = {
        cids: ['QmTest1'],
        sizes: [100],
        id: 'upload-123',
        metadata: '1,file1,txt,0,0-MIT-test'
      };

      const result = await directUpload.upload(options);

      expect(result.success).toBe(true);
      
      const json = mockKeychain.broadcastCustomJson.mock.calls[0][3];
      expect(json.m).toBe('1,file1,txt,0,0-MIT-test');
    });

    it('should validate metadata array length matches CIDs', async () => {
      const options: DirectUploadOptions = {
        cids: ['QmTest1', 'QmTest2'],
        sizes: [100, 200],
        id: 'upload-123',
        metadata: [
          { name: 'file1', ext: 'txt' }
          // Missing second metadata object
        ]
      };

      const result = await directUpload.upload(options);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Metadata array length (1) must match CIDs length (2)');
    });

    it('should handle boolean flags correctly', async () => {
      const options: DirectUploadOptions = {
        cids: ['QmTest1', 'QmTest2'],
        sizes: [100, 200],
        id: 'upload-123',
        metadata: [
          {
            name: 'encrypted-file',
            ext: 'enc',
            encrypted: true,
            hidden: false,
            nsfw: false,
            executable: false
          },
          {
            name: 'hidden-file',
            ext: 'dat',
            encrypted: false,
            hidden: true,
            nsfw: false,
            executable: false
          }
        ]
      };

      const result = await directUpload.upload(options);

      expect(result.success).toBe(true);
      
      const json = mockKeychain.broadcastCustomJson.mock.calls[0][3];
      // Verify the metadata string was created with proper flag encoding
      expect(json.m).toBeTruthy();
      expect(typeof json.m).toBe('string');
    });

    it('should handle complex folder structures', async () => {
      const options: DirectUploadOptions = {
        cids: ['QmTest1', 'QmTest2', 'QmTest3'],
        sizes: [100, 200, 300],
        id: 'upload-123',
        metadata: [
          {
            name: 'doc',
            ext: 'pdf',
            path: 'Documents/Work/report.pdf'
          },
          {
            name: 'image',
            ext: 'jpg',
            path: 'Images/Vacation/photo.jpg'
          },
          {
            name: 'video',
            ext: 'mp4',
            path: 'Videos/movie.mp4'
          }
        ]
      };

      const result = await directUpload.upload(options);

      expect(result.success).toBe(true);
      
      const json = mockKeychain.broadcastCustomJson.mock.calls[0][3];
      // The metadata should include folder structure information
      expect(json.m).toContain('Documents');
      expect(json.m).toContain('Images');
      expect(json.m).toContain('Videos');
    });

    it('should handle empty metadata objects with defaults', async () => {
      const options: DirectUploadOptions = {
        cids: ['QmTest1', 'QmTest2'],
        sizes: [100, 200],
        id: 'upload-123',
        metadata: [
          {}, // Empty metadata
          { name: 'file2' } // Partial metadata
        ]
      };

      const result = await directUpload.upload(options);

      expect(result.success).toBe(true);
      expect(mockKeychain.broadcastCustomJson).toHaveBeenCalled();
    });
  });

  describe('batch uploads with metadata arrays', () => {
    it('should handle batch uploads with different metadata formats', async () => {
      const uploads: DirectUploadOptions[] = [
        {
          cids: ['QmTest1'],
          sizes: [100],
          id: 'upload-1',
          metadata: [{ name: 'file1', ext: 'txt' }]
        },
        {
          cids: ['QmTest2'],
          sizes: [200],
          id: 'upload-2',
          metadata: '1,file2,pdf,0,0--'
        },
        {
          cids: ['QmTest3'],
          sizes: [300],
          id: 'upload-3',
          metadata: [{ name: 'file3', ext: 'jpg', hidden: true }]
        }
      ];

      const results = await directUpload.batchUpload(uploads);

      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);
      expect(mockKeychain.broadcastCustomJson).toHaveBeenCalledTimes(3);
    });
  });

  describe('error handling', () => {
    it('should reject invalid metadata types', async () => {
      const options: DirectUploadOptions = {
        cids: ['QmTest1'],
        sizes: [100],
        id: 'upload-123',
        metadata: 123 as any // Invalid type
      };

      const result = await directUpload.upload(options);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Metadata must be either a string or an array of objects');
    });

    it('should handle keychain errors gracefully', async () => {
      mockKeychain.broadcastCustomJson.mockRejectedValue(new Error('User cancelled'));

      const options: DirectUploadOptions = {
        cids: ['QmTest1'],
        sizes: [100],
        id: 'upload-123',
        metadata: [{ name: 'file1', ext: 'txt' }]
      };

      const result = await directUpload.upload(options);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Direct upload failed: User cancelled');
    });

    it('should check for insufficient BROCA with metadata arrays', async () => {
      mockAccount.calculateBroca.mockResolvedValue(50); // Not enough

      const options: DirectUploadOptions = {
        cids: ['QmTest1'],
        sizes: [100],
        id: 'upload-123',
        metadata: [{ name: 'file1', ext: 'txt' }]
      };

      const result = await directUpload.upload(options);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Insufficient BROCA');
    });
  });
});