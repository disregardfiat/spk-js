import { 
  SPKFileMetadata, 
  TAGS, 
  LICENSES, 
  LABELS,
  FileMetadataOptions 
} from '../../../src/storage/file-metadata';

describe('SPKFileMetadata', () => {
  describe('constructor', () => {
    it('should create empty metadata', () => {
      const metadata = new SPKFileMetadata();
      expect(metadata.name).toBe('');
      expect(metadata.ext).toBe('');
      expect(metadata.thumb).toBe('');
      expect(metadata.tags).toBe(0);
      expect(metadata.labels).toBe('');
      expect(metadata.license).toBe('');
    });

    it('should create metadata with options', () => {
      const options: FileMetadataOptions = {
        name: 'myfile',
        ext: 'jpg',
        thumb: 'https://example.com/thumb.jpg',
        tags: [4, 8], // NSFW + Executable
        labels: '123',
        license: '7' // CC0
      };
      
      const metadata = new SPKFileMetadata(options);
      expect(metadata.name).toBe('myfile');
      expect(metadata.ext).toBe('jpg');
      expect(metadata.thumb).toBe('https://example.com/thumb.jpg');
      expect(metadata.tags).toBe(12); // 4 | 8 = 12
      expect(metadata.labels).toBe('123');
      expect(metadata.license).toBe('7');
    });

    it('should handle single tag value', () => {
      const metadata = new SPKFileMetadata({ tags: 4 });
      expect(metadata.tags).toBe(4);
    });
  });

  describe('tag operations', () => {
    let metadata: SPKFileMetadata;

    beforeEach(() => {
      metadata = new SPKFileMetadata();
    });

    it('should add tags', () => {
      metadata.addTag(4); // NSFW
      expect(metadata.hasTag(4)).toBe(true);
      expect(metadata.tags).toBe(4);

      metadata.addTag(8); // Executable
      expect(metadata.hasTag(8)).toBe(true);
      expect(metadata.tags).toBe(12); // 4 | 8
    });

    it('should not duplicate tags', () => {
      metadata.addTag(4);
      metadata.addTag(4); // Add same tag again
      expect(metadata.tags).toBe(4);
    });

    it('should remove tags', () => {
      metadata.tags = 12; // Both NSFW and Executable
      
      metadata.removeTag(4); // Remove NSFW
      expect(metadata.hasTag(4)).toBe(false);
      expect(metadata.hasTag(8)).toBe(true);
      expect(metadata.tags).toBe(8);
    });

    it('should handle removing non-existent tags', () => {
      metadata.tags = 4;
      metadata.removeTag(8); // Remove tag that wasn't set
      expect(metadata.tags).toBe(4);
    });

    it('should get active tags', () => {
      metadata.tags = 12; // NSFW + Executable
      const activeTags = metadata.getActiveTags();
      expect(activeTags).toEqual([4, 8]);
    });
  });

  describe('label operations', () => {
    let metadata: SPKFileMetadata;

    beforeEach(() => {
      metadata = new SPKFileMetadata();
    });

    it('should add labels', () => {
      metadata.addLabel('1'); // Important
      expect(metadata.hasLabel('1')).toBe(true);
      expect(metadata.labels).toBe('21'); // Default '2' + '1'
    });

    it('should not duplicate labels', () => {
      metadata.labels = '123';
      metadata.addLabel('2'); // Already exists
      expect(metadata.labels).toBe('123');
    });

    it('should remove labels', () => {
      metadata.labels = '123';
      
      metadata.removeLabel('2');
      expect(metadata.hasLabel('2')).toBe(false);
      expect(metadata.labels).toBe('13');
    });

    it('should reset to default when all labels removed', () => {
      metadata.labels = '1';
      metadata.removeLabel('1');
      expect(metadata.labels).toBe('2'); // Default
    });

    it('should get active labels', () => {
      metadata.labels = '135';
      const activeLabels = metadata.getActiveLabels();
      expect(activeLabels).toEqual(['1', '3', '5']);
    });
  });

  describe('license operations', () => {
    let metadata: SPKFileMetadata;

    beforeEach(() => {
      metadata = new SPKFileMetadata();
    });

    it('should set license', () => {
      metadata.setLicense('7'); // CC0
      expect(metadata.license).toBe('7');
    });

    it('should clear license', () => {
      metadata.license = '5';
      metadata.clearLicense();
      expect(metadata.license).toBe('');
    });

    it('should get license details', () => {
      metadata.setLicense('1'); // CC BY
      const details = metadata.getLicenseDetails();
      expect(details).toBeDefined();
      expect(details?.label).toBe('CC BY');
      expect(details?.description).toContain('Attribution');
    });

    it('should return undefined for invalid license', () => {
      metadata.setLicense('99');
      const details = metadata.getLicenseDetails();
      expect(details).toBeUndefined();
    });
  });

  describe('SPK format conversion', () => {
    it('should convert to SPK format', () => {
      const metadata = new SPKFileMetadata({
        name: 'test',
        ext: 'mp4',
        thumb: 'QmThumb...',
        tags: 12, // 4 + 8
        labels: '123',
        license: '7'
      });

      const spkFormat = metadata.toSPKFormat();
      expect(spkFormat.name).toBe('test');
      expect(spkFormat.ext).toBe('mp4');
      expect(spkFormat.thumb).toBe('QmThumb...');
      expect(spkFormat.flag).toBe('C'); // Base64 of 12
      expect(spkFormat.labels).toBe('123');
      expect(spkFormat.license).toBe('7');
    });

    it('should handle empty metadata', () => {
      const metadata = new SPKFileMetadata();
      const spkFormat = metadata.toSPKFormat();
      expect(Object.keys(spkFormat).length).toBe(0);
    });

    it('should create from SPK format', () => {
      const spkData = {
        name: 'video',
        ext: 'webm',
        thumb: 'https://example.com/t.jpg',
        flag: 'C', // Base64 of 12
        labels: '246',
        license: '2'
      };

      const metadata = SPKFileMetadata.fromSPKFormat(spkData);
      expect(metadata.name).toBe('video');
      expect(metadata.ext).toBe('webm');
      expect(metadata.thumb).toBe('https://example.com/t.jpg');
      expect(metadata.tags).toBe(12);
      expect(metadata.labels).toBe('246');
      expect(metadata.license).toBe('2');
    });
  });

  describe('constants', () => {
    it('should have correct tag values', () => {
      expect(TAGS).toHaveLength(2);
      expect(TAGS[0].value).toBe(4);
      expect(TAGS[0].label).toBe('NSFW');
      expect(TAGS[1].value).toBe(8);
      expect(TAGS[1].label).toBe('Executable');
    });

    it('should have correct license values', () => {
      expect(LICENSES).toHaveLength(7);
      expect(LICENSES[0].value).toBe('1');
      expect(LICENSES[0].label).toBe('CC BY');
      expect(LICENSES[6].value).toBe('7');
      expect(LICENSES[6].label).toBe('CC0');
    });

    it('should have correct label values', () => {
      expect(LABELS).toHaveLength(10);
      expect(LABELS[0].value).toBe('0');
      expect(LABELS[0].label).toBe('Miscellaneous');
      expect(LABELS[9].value).toBe('9');
      expect(LABELS[9].label).toBe('Purple');
    });
  });
});