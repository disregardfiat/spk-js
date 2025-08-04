import { buildMetadataFromFiles, buildMetadataString, validateFolderName, SimpleFileData, FileMetadata, FolderInfo } from '../../../src/storage/metadata';

describe('Metadata String Generation - Fixed Issues', () => {
  describe('buildMetadataFromFiles', () => {
    it('should not include pipe when no custom folders exist', () => {
      const files: SimpleFileData[] = [
        {
          cid: 'QmTestDocument123456',
          name: 'document',
          ext: 'pdf',
          // No path - should be in root
        },
        {
          cid: 'QmTestImage789012',
          name: 'photo',
          ext: 'jpg',
          // No path - should be in root
        }
      ];

      const result = buildMetadataFromFiles(files);
      
      // Should start with "1" (version) and NOT include "|"
      expect(result).toMatch(/^1,/);
      expect(result).not.toContain('|');
      expect(result).toContain('document,pdf');
      expect(result).toContain('photo,jpg');
    });

    it('should include pipe only when custom folders exist', () => {
      const files: SimpleFileData[] = [
        {
          cid: 'QmTestDocument123456',
          name: 'document',
          ext: 'pdf',
          path: 'MyFolder/document.pdf',
        }
      ];

      const result = buildMetadataFromFiles(files);
      
      // Should include "|" because we have a custom folder
      expect(result).toMatch(/^1\|MyFolder,/);
      expect(result).toContain('document,pdf.');
    });

    it('should preserve empty file entries as commas', () => {
      const files: SimpleFileData[] = [
        {
          cid: 'QmTestDocument123456',
          name: 'document',
          ext: 'pdf',
        },
        {
          cid: 'QmTestEmpty789012',
          name: '', // Empty name
          ext: '',  // Empty extension
        },
        {
          cid: 'QmTestPhoto345678',
          name: 'photo',
          ext: 'jpg',
        }
      ];

      const result = buildMetadataFromFiles(files);
      
      // Should contain all files including empty ones
      expect(result).toContain('document,pdf');
      expect(result).toContain('photo,jpg');
      // Should contain empty entries represented as commas
      expect(result).toContain(',,,0--'); // Empty file with default flags
    });

    it('should handle preset folders without custom folder syntax', () => {
      const files: SimpleFileData[] = [
        {
          cid: 'QmTestDocument123456',
          name: 'document',
          ext: 'pdf',
          path: 'Documents/document.pdf',
        },
        {
          cid: 'QmTestImage789012',
          name: 'photo',
          ext: 'jpg',
          path: 'Images/photo.jpg',
        }
      ];

      const result = buildMetadataFromFiles(files);
      
      // Should start with "1" without custom folders since Documents and Images are presets
      expect(result).toMatch(/^1,/);
      expect(result).not.toContain('|');
      expect(result).toContain('document,pdf.2'); // Documents = index 2
      expect(result).toContain('photo,jpg.3');    // Images = index 3
    });
  });

  describe('buildMetadataString', () => {
    it('should not include pipe when no custom folders', () => {
      const files = new Map<string, FileMetadata>();
      files.set('QmTestDocument123456', {
        name: 'document',
        ext: 'pdf',
        pathIndex: '2', // Documents preset
        thumb: '',
        flags: '0',
        license: '',
        labels: '',
      });

      const folders: FolderInfo[] = []; // No custom folders
      
      const result = buildMetadataString(files, folders);
      
      expect(result).toMatch(/^1,/);
      expect(result).not.toContain('|');
    });

    it('should include pipe only with custom folders', () => {
      const files = new Map<string, FileMetadata>();
      files.set('QmTestDocument123456', {
        name: 'document',
        ext: 'pdf',
        pathIndex: '1', // Custom folder
        thumb: '',
        flags: '0',
        license: '',
        labels: '',
      });

      const folders: FolderInfo[] = [{
        index: '1',
        name: 'MyFolder',
        parent: '0',
        fullPath: 'MyFolder'
      }];
      
      const result = buildMetadataString(files, folders);
      
      expect(result).toMatch(/^1\|MyFolder,/);
    });
  });

  describe('validateFolderName', () => {
    it('should accept valid folder names', () => {
      expect(validateFolderName('MyFolder')).toBe('MyFolder');
      expect(validateFolderName('AB')).toBe('AB'); // Minimum length
      expect(validateFolderName('1234567890123456')).toBe('1234567890123456'); // Maximum length
    });

    it('should reject folder names that are too short', () => {
      expect(() => validateFolderName('A')).toThrow('must be at least 2 characters');
      expect(() => validateFolderName('')).toThrow('must be at least 2 characters');
    });

    it('should reject folder names that are too long', () => {
      expect(() => validateFolderName('12345678901234567')).toThrow('must be no more than 16 characters');
    });

    it('should reject folder names with commas', () => {
      expect(() => validateFolderName('My,Folder')).toThrow('cannot contain commas');
      expect(() => validateFolderName('Folder,Name')).toThrow('cannot contain commas');
    });
  });

  describe('Real-world scenario fixes', () => {
    it('should fix the pipe character issue but preserve empty entries', () => {
      // This test recreates the scenario that was producing "1|,,,,2--,Gutter,m3u8.4,,0--,,,,2--"
      const files: SimpleFileData[] = [
        {
          cid: 'QmTestVideo123456789',
          name: 'Gutter',
          ext: 'm3u8',
          path: 'Videos/Gutter.m3u8',
        },
        // Empty entries should be preserved as commas
        {
          cid: 'QmTestEmpty123456789',
          name: '',
          ext: '',
        }
      ];

      const result = buildMetadataFromFiles(files);
      
      // Should fix the main issue: no pipe when using preset folders
      expect(result).toMatch(/^1,/); // Starts with version, no pipe
      expect(result).toContain('Gutter,m3u8.4'); // Videos preset folder (index 4)
      expect(result).not.toContain('|'); // No custom folders needed
      
      // But empty entries should still be present as commas
      expect(result).toContain(',,,0--'); // Empty file with default flags
    });
  });
});