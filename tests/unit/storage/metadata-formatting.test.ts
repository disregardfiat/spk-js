import { SPKFileMetadata } from '../../../src/storage/file-metadata';
import { SPKFileUpload } from '../../../src/storage/file-upload';

describe('Metadata String Formatting', () => {
  describe('SPKFileMetadata toSPKFormat', () => {
    it('should format tags as base64 string', () => {
      const metadata = new SPKFileMetadata({
        tags: [4, 8] // NSFW + Executable = 12
      });
      
      const formatted = metadata.toSPKFormat();
      expect(formatted.flag).toBe('C'); // Base64 of 12
    });

    it('should handle single tag value', () => {
      const metadata = new SPKFileMetadata({
        tags: 4 // Just NSFW
      });
      
      const formatted = metadata.toSPKFormat();
      expect(formatted.flag).toBe('4'); // Base64 of 4
    });

    it('should handle zero tags', () => {
      const metadata = new SPKFileMetadata({
        tags: 0
      });
      
      const formatted = metadata.toSPKFormat();
      expect(formatted.flag).toBeUndefined(); // Should not include flag if 0
    });

    it('should format labels as string', () => {
      const metadata = new SPKFileMetadata({
        labels: '125' // Important, Favorite, Orange
      });
      
      const formatted = metadata.toSPKFormat();
      expect(formatted.labels).toBe('125');
      expect(typeof formatted.labels).toBe('string');
    });

    it('should format license as string', () => {
      const metadata = new SPKFileMetadata({
        license: '7' // CC0
      });
      
      const formatted = metadata.toSPKFormat();
      expect(formatted.license).toBe('7');
      expect(typeof formatted.license).toBe('string');
    });

    it('should include name and ext as strings', () => {
      const metadata = new SPKFileMetadata({
        name: 'vacation-photo',
        ext: 'jpg'
      });
      
      const formatted = metadata.toSPKFormat();
      expect(formatted.name).toBe('vacation-photo');
      expect(formatted.ext).toBe('jpg');
    });

    it('should include thumb as string', () => {
      const metadata = new SPKFileMetadata({
        thumb: 'QmThumbnailCID123'
      });
      
      const formatted = metadata.toSPKFormat();
      expect(formatted.thumb).toBe('QmThumbnailCID123');
    });

    it('should handle complete metadata object', () => {
      const metadata = new SPKFileMetadata({
        name: 'document',
        ext: 'pdf',
        thumb: 'https://example.com/thumb.jpg',
        tags: [4, 8], // 12 in decimal
        labels: '123',
        license: '2'
      });
      
      const formatted = metadata.toSPKFormat();
      expect(formatted).toEqual({
        name: 'document',
        ext: 'pdf',
        thumb: 'https://example.com/thumb.jpg',
        flag: 'C', // Base64 of 12
        labels: '123',
        license: '2'
      });
    });

    it('should only include non-empty fields', () => {
      const metadata = new SPKFileMetadata({
        name: 'test',
        tags: 0,
        labels: '',
        license: ''
      });
      
      const formatted = metadata.toSPKFormat();
      expect(formatted).toEqual({
        name: 'test'
      });
      expect(formatted.flag).toBeUndefined();
      expect(formatted.labels).toBeUndefined();
      expect(formatted.license).toBeUndefined();
    });
  });

  describe('SPKFileMetadata fromSPKFormat', () => {
    it('should parse base64 flag to tags number', () => {
      const spkData = {
        flag: 'C' // Base64 of 12
      };
      
      const metadata = SPKFileMetadata.fromSPKFormat(spkData);
      expect(metadata.tags).toBe(12);
    });

    it('should handle all fields correctly', () => {
      const spkData = {
        name: 'video',
        ext: 'mp4',
        thumb: 'ipfs://QmThumb',
        flag: '8', // Base64 of 8
        labels: '246',
        license: '5'
      };
      
      const metadata = SPKFileMetadata.fromSPKFormat(spkData);
      expect(metadata.name).toBe('video');
      expect(metadata.ext).toBe('mp4');
      expect(metadata.thumb).toBe('ipfs://QmThumb');
      expect(metadata.tags).toBe(8);
      expect(metadata.labels).toBe('246');
      expect(metadata.license).toBe('5');
    });
  });

  describe('FileMetadataItem conversion in uploads', () => {
    let mockAccount: any;
    let fileUpload: SPKFileUpload;
    
    beforeEach(() => {
      mockAccount = {
        username: 'testuser',
        registerPublicKey: jest.fn().mockResolvedValue(undefined),
        sign: jest.fn().mockResolvedValue({ signature: 'mock-sig' }),
        calculateBroca: jest.fn().mockResolvedValue(1000),
        api: {
          post: jest.fn().mockResolvedValue({ 
            id: 'contract-123',
            df: ['QmTestHash123'],
            i: 'contract-123',
            t: 'testuser',
            fosig: 'mock-sig',
            api: 'https://ipfs.dlux.io'
          }),
          get: jest.fn().mockResolvedValue({ 
            df: ['QmTestHash123'], 
            i: 'contract-123'
          })
        },
        node: 'https://spktest.dlux.io'
      };
      
      fileUpload = new SPKFileUpload(mockAccount);
      
      // Mock file hashing
      fileUpload['hashFile'] = jest.fn().mockResolvedValue('QmTestHash');
      
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

    it('should convert tags array to base64 flag', async () => {
      const file = new File(['test'], 'test.txt');
      const metadata = {
        FileIndex: 0,
        tags: [4, 8] // Should be combined to 12, then Base64 encoded
      };
      
      try {
        await fileUpload.upload(file, { metaData: [metadata] });
      } catch {
        // Ignore upload errors, just check the contract creation
      }
      
      expect(mockAccount.api.post).toHaveBeenCalledWith(
        '/api/new_contract',
        expect.objectContaining({
          metadata: expect.objectContaining({
            flag: 'C' // Base64 of 12
          })
        }),
        expect.any(Object)
      );
    });

    it('should convert single tag number to base64 flag', async () => {
      const file = new File(['test'], 'test.txt');
      const metadata = {
        FileIndex: 0,
        tags: 8 // Just executable
      };
      
      try {
        await fileUpload.upload(file, { metaData: [metadata] });
      } catch {
        // Ignore upload errors
      }
      
      expect(mockAccount.api.post).toHaveBeenCalledWith(
        '/api/new_contract',
        expect.objectContaining({
          metadata: expect.objectContaining({
            flag: '8' // Base64 of 8
          })
        }),
        expect.any(Object)
      );
    });

    it('should pass labels as string', async () => {
      const file = new File(['test'], 'test.txt');
      const metadata = {
        FileIndex: 0,
        labels: '12579' // Multiple labels
      };
      
      try {
        await fileUpload.upload(file, { metaData: [metadata] });
      } catch {
        // Ignore upload errors
      }
      
      expect(mockAccount.api.post).toHaveBeenCalledWith(
        '/api/new_contract',
        expect.objectContaining({
          metadata: expect.objectContaining({
            labels: '12579'
          })
        }),
        expect.any(Object)
      );
    });

    it('should pass license as string', async () => {
      const file = new File(['test'], 'test.txt');
      const metadata = {
        FileIndex: 0,
        license: '3' // CC BY-ND
      };
      
      try {
        await fileUpload.upload(file, { metaData: [metadata] });
      } catch {
        // Ignore upload errors
      }
      
      expect(mockAccount.api.post).toHaveBeenCalledWith(
        '/api/new_contract',
        expect.objectContaining({
          metadata: expect.objectContaining({
            license: '3'
          })
        }),
        expect.any(Object)
      );
    });

    it('should handle complete metadata with all fields', async () => {
      const file = new File(['test'], 'document.pdf');
      const metadata = {
        FileIndex: 0,
        name: 'important-document',
        ext: 'pdf',
        path: '/Documents/Work',
        thumbnail: 'QmCustomThumb123',
        tags: [4, 8], // 12 total
        labels: '14789',
        license: '1'
      };
      
      try {
        await fileUpload.upload(file, { metaData: [metadata] });
      } catch {
        // Ignore upload errors
      }
      
      expect(mockAccount.api.post).toHaveBeenCalledWith(
        '/api/new_contract',
        expect.objectContaining({
          metadata: expect.objectContaining({
            name: 'important-document',
            ext: 'pdf',
            path: '/Documents/Work',
            thumb: 'QmCustomThumb123',
            flag: 'C', // Base64 of 12
            labels: '14789',
            license: '1'
          })
        }),
        expect.any(Object)
      );
    });

    it('should not include empty metadata fields', async () => {
      const file = new File(['test'], 'test.txt');
      const metadata = {
        FileIndex: 0,
        name: 'test',
        tags: 0, // No tags
        labels: '', // No labels
        license: '' // No license
      };
      
      try {
        await fileUpload.upload(file, { metaData: [metadata] });
      } catch {
        // Ignore upload errors
      }
      
      const callArgs = mockAccount.api.post.mock.calls[0];
      const contractData = callArgs[1];
      
      expect(contractData.metadata).toEqual({
        name: 'test'
        // No flag, labels, or license should be present
      });
      expect(contractData.metadata.flag).toBeUndefined();
      expect(contractData.metadata.labels).toBeUndefined();
      expect(contractData.metadata.license).toBeUndefined();
    });
  });

  describe('Base64 encoding edge cases', () => {
    it('should handle various tag combinations', () => {
      // Using custom Base64 alphabet: "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz+="
      const testCases = [
        { tags: 0, expected: undefined },
        { tags: 1, expected: '1' },
        { tags: 4, expected: '4' },
        { tags: 8, expected: '8' },
        { tags: 12, expected: 'C' }, // 4 + 8
        { tags: 15, expected: 'F' }, // All flags
        { tags: 255, expected: '3=' }, // 255 = 3*64 + 63, so "3="
      ];
      
      testCases.forEach(({ tags, expected }) => {
        const metadata = new SPKFileMetadata({ tags });
        const formatted = metadata.toSPKFormat();
        
        // Use a single expect with conditional value
        const actualFlag = formatted.flag;
        expect(actualFlag).toBe(expected);
      });
    });
  });

  describe('Label string formatting', () => {
    it('should maintain label order', () => {
      const metadata = new SPKFileMetadata();
      metadata.addLabel('1');
      metadata.addLabel('5');
      metadata.addLabel('3');
      metadata.addLabel('9');
      
      expect(metadata.labels).toBe('21539'); // Default '2' + added labels in order
    });

    it('should not duplicate labels', () => {
      const metadata = new SPKFileMetadata();
      metadata.addLabel('1');
      metadata.addLabel('1'); // Duplicate
      metadata.addLabel('5');
      metadata.addLabel('5'); // Duplicate
      
      expect(metadata.labels).toBe('215'); // Default '2' + unique labels
    });
  });
});