import { SPKFileMetadata } from '../../../src/storage/file-metadata';
import { NumberToBase64, Base64toNumber } from '../../../src/utils/base64';

describe('Metadata Edge Cases and String Validation', () => {
  describe('Custom Base64 alphabet validation', () => {
    it('should use correct custom alphabet', () => {
      // The custom alphabet is: "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz+="
      // This is different from standard Base64
      
      const testCases = [
        { num: 0, base64: '0' },
        { num: 1, base64: '1' },
        { num: 9, base64: '9' },
        { num: 10, base64: 'A' },
        { num: 35, base64: 'Z' },
        { num: 36, base64: 'a' },
        { num: 61, base64: 'z' },
        { num: 62, base64: '+' },
        { num: 63, base64: '=' },
        { num: 64, base64: '10' },
        { num: 100, base64: '1a' },
        { num: 255, base64: '3=' },
        { num: 256, base64: '40' },
        { num: 1000, base64: 'Fe' },
      ];
      
      testCases.forEach(({ num, base64 }) => {
        expect(NumberToBase64(num)).toBe(base64);
        expect(Base64toNumber(base64)).toBe(num);
      });
    });
  });

  describe('Tags bitwise operations', () => {
    it('should correctly combine multiple tags', () => {
      const metadata = new SPKFileMetadata();
      
      // Add NSFW (4)
      metadata.addTag(4);
      expect(metadata.tags).toBe(4);
      expect(metadata.toSPKFormat().flag).toBe('4');
      
      // Add Executable (8)
      metadata.addTag(8);
      expect(metadata.tags).toBe(12); // 4 | 8 = 12
      expect(metadata.toSPKFormat().flag).toBe('C');
      
      // Try to add same tag again (should not change)
      metadata.addTag(4);
      expect(metadata.tags).toBe(12);
      
      // Remove NSFW
      metadata.removeTag(4);
      expect(metadata.tags).toBe(8);
      expect(metadata.toSPKFormat().flag).toBe('8');
    });

    it('should handle tag array initialization correctly', () => {
      // Test with array of tags
      const metadata1 = new SPKFileMetadata({ tags: [4, 8] });
      expect(metadata1.tags).toBe(12);
      
      // Test with single number
      const metadata2 = new SPKFileMetadata({ tags: 12 });
      expect(metadata2.tags).toBe(12);
      
      // Both should produce same output
      expect(metadata1.toSPKFormat().flag).toBe(metadata2.toSPKFormat().flag);
    });
  });

  describe('Labels string handling', () => {
    it('should initialize with default label', () => {
      const metadata = new SPKFileMetadata();
      expect(metadata.labels).toBe(''); // Empty by default
      
      // When adding first label, it should initialize with default '2'
      metadata.addLabel('1');
      expect(metadata.labels).toBe('21');
    });

    it('should handle label removal correctly', () => {
      const metadata = new SPKFileMetadata({ labels: '12345' });
      
      metadata.removeLabel('3');
      expect(metadata.labels).toBe('1245');
      
      metadata.removeLabel('1');
      expect(metadata.labels).toBe('245');
      
      // Remove all labels should reset to default
      metadata.removeLabel('2');
      metadata.removeLabel('4');
      metadata.removeLabel('5');
      expect(metadata.labels).toBe('2'); // Back to default
    });

    it('should not allow duplicate labels', () => {
      const metadata = new SPKFileMetadata({ labels: '123' });
      
      metadata.addLabel('2'); // Already exists
      expect(metadata.labels).toBe('123');
      
      metadata.addLabel('5'); // New label
      expect(metadata.labels).toBe('1235');
    });
  });

  describe('Empty and null value handling', () => {
    it('should not include empty strings in output', () => {
      const metadata = new SPKFileMetadata({
        name: '',
        ext: '',
        thumb: '',
        tags: 0,
        labels: '',
        license: ''
      });
      
      const formatted = metadata.toSPKFormat();
      expect(Object.keys(formatted)).toHaveLength(0);
    });

    it('should handle partial metadata correctly', () => {
      const metadata = new SPKFileMetadata({
        name: 'test',
        tags: 4,
        labels: '', // Empty
        license: '7'
      });
      
      const formatted = metadata.toSPKFormat();
      expect(formatted).toEqual({
        name: 'test',
        flag: '4',
        license: '7'
        // No labels field
      });
    });
  });

  describe('Path field handling', () => {
    it('should include path in converted metadata', () => {
      // Path is not part of SPKFileMetadata but can be included in FileMetadataItem
      const metadata = {
        FileIndex: 0,
        name: 'document',
        path: '/Documents/Work/Reports'
      };
      
      // Create metadata and convert
      const spkMetadata = new SPKFileMetadata(metadata);
      const formatted = spkMetadata.toSPKFormat();
      
      // Path should be added separately in the upload process
      expect(formatted.path).toBeUndefined(); // SPKFileMetadata doesn't handle path
    });
  });

  describe('Special characters in strings', () => {
    it('should handle special characters in name', () => {
      const metadata = new SPKFileMetadata({
        name: 'my-file_2023 (final).v2',
        ext: 'pdf'
      });
      
      const formatted = metadata.toSPKFormat();
      expect(formatted.name).toBe('my-file_2023 (final).v2');
    });

    it('should handle URLs in thumb field', () => {
      const metadata = new SPKFileMetadata({
        thumb: 'https://ipfs.io/ipfs/QmXxxxYYYzzz?filename=thumb.jpg'
      });
      
      const formatted = metadata.toSPKFormat();
      expect(formatted.thumb).toBe('https://ipfs.io/ipfs/QmXxxxYYYzzz?filename=thumb.jpg');
    });
  });

  describe('Round-trip conversion', () => {
    it('should maintain data integrity through conversion', () => {
      const originalData = {
        name: 'test-document',
        ext: 'pdf',
        thumb: 'QmThumb123',
        flag: 'C', // 12 in decimal
        labels: '12689',
        license: '5'
      };
      
      // Convert from SPK format
      const metadata = SPKFileMetadata.fromSPKFormat(originalData);
      
      // Convert back to SPK format
      const converted = metadata.toSPKFormat();
      
      expect(converted).toEqual(originalData);
    });
  });

  describe('Real-world metadata examples', () => {
    it('should format video metadata correctly', () => {
      const metadata = new SPKFileMetadata({
        name: 'tutorial-video',
        ext: 'mp4',
        thumb: 'https://cdn.example.com/thumbs/abc123.jpg',
        tags: [4], // NSFW
        labels: '25', // Favorite + Orange
        license: '1' // CC BY
      });
      
      const formatted = metadata.toSPKFormat();
      expect(formatted).toEqual({
        name: 'tutorial-video',
        ext: 'mp4',
        thumb: 'https://cdn.example.com/thumbs/abc123.jpg',
        flag: '4',
        labels: '25',
        license: '1'
      });
    });

    it('should format document metadata correctly', () => {
      const metadata = new SPKFileMetadata({
        name: 'whitepaper',
        ext: 'pdf',
        tags: 0, // No special tags
        labels: '1', // Important
        license: '7' // CC0
      });
      
      const formatted = metadata.toSPKFormat();
      expect(formatted).toEqual({
        name: 'whitepaper',
        ext: 'pdf',
        labels: '1',
        license: '7'
        // No flag field when tags = 0
      });
    });

    it('should format executable metadata correctly', () => {
      const metadata = new SPKFileMetadata({
        name: 'installer',
        ext: 'exe',
        tags: 8, // Executable
        labels: '14', // Important + Red (warning)
        license: '' // No license
      });
      
      const formatted = metadata.toSPKFormat();
      expect(formatted).toEqual({
        name: 'installer',
        ext: 'exe',
        flag: '8',
        labels: '14'
        // No license field when empty
      });
    });
  });
});