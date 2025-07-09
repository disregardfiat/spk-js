import { SPKFileMetadata } from '../../../src/storage/file-metadata';

describe('Metadata String Formatting', () => {
  describe('SPKFileMetadata toSPKFormat', () => {
    it('should format tags as base64 string', () => {
      const metadata = new SPKFileMetadata({
        tags: [4, 8]  // 4 | 8 = 12
      });
      
      const formatted = metadata.toSPKFormat();
      expect(formatted.flag).toBe('C'); // Base64 encoded 12
    });

    it('should handle single tag value', () => {
      const metadata = new SPKFileMetadata({
        tags: 8
      });
      
      const formatted = metadata.toSPKFormat();
      expect(formatted.flag).toBe('8'); // Base64 encoded 8
    });

    it('should handle zero tags', () => {
      const metadata = new SPKFileMetadata({
        tags: 0
      });
      
      const formatted = metadata.toSPKFormat();
      expect(formatted.flag).toBeUndefined();
    });

    it('should format labels as string', () => {
      const metadata = new SPKFileMetadata({
        labels: '12345'
      });
      
      const formatted = metadata.toSPKFormat();
      expect(formatted.labels).toBe('12345');
    });

    it('should format license as string', () => {
      const metadata = new SPKFileMetadata({
        license: '7'
      });
      
      const formatted = metadata.toSPKFormat();
      expect(formatted.license).toBe('7');
    });

    it('should include name and ext as strings', () => {
      const metadata = new SPKFileMetadata({
        name: 'my-document',
        ext: 'pdf'
      });
      
      const formatted = metadata.toSPKFormat();
      expect(formatted.name).toBe('my-document');
      expect(formatted.ext).toBe('pdf');
    });

    it('should include thumb as string', () => {
      const metadata = new SPKFileMetadata({
        thumb: 'QmThumbHash123'
      });
      
      const formatted = metadata.toSPKFormat();
      expect(formatted.thumb).toBe('QmThumbHash123');
    });

    it('should handle complete metadata object', () => {
      const metadata = new SPKFileMetadata({
        name: 'vacation-photo',
        ext: 'jpg',
        tags: [4, 8],
        labels: '125',
        license: '1',
        thumb: 'QmThumb123'
      });
      
      const formatted = metadata.toSPKFormat();
      expect(formatted).toEqual({
        name: 'vacation-photo',
        ext: 'jpg',
        flag: 'C',
        labels: '125',
        license: '1',
        thumb: 'QmThumb123'
      });
    });

    it('should only include non-empty fields', () => {
      const metadata = new SPKFileMetadata({
        name: 'simple',
        tags: 0,
        labels: '',
        license: ''
      });
      
      const formatted = metadata.toSPKFormat();
      expect(formatted).toEqual({
        name: 'simple'
      });
    });
  });

  describe('SPKFileMetadata fromSPKFormat', () => {
    it('should parse base64 flag to tags number', () => {
      const spkData = {
        flag: 'C', // Base64 encoded 12
        name: 'test'
      };
      
      const metadata = SPKFileMetadata.fromSPKFormat(spkData);
      expect(metadata.tags).toBe(12);
      expect(metadata.name).toBe('test');
    });

    it('should handle all fields correctly', () => {
      const spkData = {
        name: 'document',
        ext: 'pdf',
        flag: '8',
        labels: '12579',
        license: '3',
        thumb: 'QmThumb456'
      };
      
      const metadata = SPKFileMetadata.fromSPKFormat(spkData);
      expect(metadata).toEqual({
        name: 'document',
        ext: 'pdf',
        tags: 8,
        labels: '12579',
        license: '3',
        thumb: 'QmThumb456'
      });
    });
  });

  describe('FileMetadataItem conversion in uploads', () => {
    
    it('should convert tags array to base64 flag', () => {
      const metadata = new SPKFileMetadata({
        tags: [4, 8]
      });
      
      const formatted = metadata.toSPKFormat();
      expect(formatted.flag).toBe('C'); // Base64 of 12
    });

    it('should convert single tag number to base64 flag', () => {
      const metadata = new SPKFileMetadata({
        tags: 8
      });
      
      const formatted = metadata.toSPKFormat();
      expect(formatted.flag).toBe('8'); // Base64 of 8
    });

    it('should pass labels as string', () => {
      const metadata = new SPKFileMetadata({
        labels: '12579'
      });
      
      const formatted = metadata.toSPKFormat();
      expect(formatted.labels).toBe('12579');
    });

    it('should pass license as string', () => {
      const metadata = new SPKFileMetadata({
        license: '3'
      });
      
      const formatted = metadata.toSPKFormat();
      expect(formatted.license).toBe('3');
    });

    it('should handle complete metadata with all fields', () => {
      const metadata = new SPKFileMetadata({
        name: 'important-document',
        ext: 'pdf',
        tags: [4, 8],
        labels: '14789',
        license: '1',
        thumb: 'QmCustomThumb123'
      });
      
      const formatted = metadata.toSPKFormat();
      expect(formatted).toEqual({
        name: 'important-document',
        ext: 'pdf',
        flag: 'C',
        labels: '14789',
        license: '1',
        thumb: 'QmCustomThumb123'
      });
    });

    it('should not include empty metadata fields', () => {
      const metadata = new SPKFileMetadata({
        name: 'test',
        tags: 0,
        license: '',
        labels: ''
      });
      
      const formatted = metadata.toSPKFormat();
      expect(formatted).toEqual({
        name: 'test'
      });
    });
  });

  describe('Base64 encoding edge cases', () => {
    it('should handle various tag combinations', () => {
      // Test different tag combinations
      const testCases = [
        { tags: 1, expected: '1' },      // NSFW
        { tags: 2, expected: '2' },      // Encrypted
        { tags: 4, expected: '4' },      // Adult
        { tags: 8, expected: '8' },      // Executable
        { tags: 15, expected: 'F' },     // All flags (1|2|4|8 = 15)
        { tags: 10, expected: 'A' },     // Encrypted + Executable (2|8 = 10)
        { tags: 12, expected: 'C' },     // Adult + Executable (4|8 = 12)
      ];
      
      testCases.forEach(({ tags, expected }) => {
        const metadata = new SPKFileMetadata({ tags });
        const formatted = metadata.toSPKFormat();
        expect(formatted.flag).toBe(expected);
      });
    });
  });

  describe('Label string formatting', () => {
    it('should maintain label order', () => {
      const labels = '159267';
      const metadata = new SPKFileMetadata({ labels });
      const formatted = metadata.toSPKFormat();
      expect(formatted.labels).toBe('159267');
    });

    it('should not duplicate labels', () => {
      // This test is more about ensuring our implementation
      // doesn't process labels in a way that could duplicate them
      const metadata = new SPKFileMetadata({
        labels: '111222333'
      });
      const formatted = metadata.toSPKFormat();
      expect(formatted.labels).toBe('111222333');
    });
  });
});