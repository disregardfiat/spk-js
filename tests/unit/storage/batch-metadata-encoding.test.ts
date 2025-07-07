import { SPKFileMetadata } from '../../../src/storage/file-metadata';
import { NumberToBase64 } from '../../../src/utils/base64';

describe('Batch Metadata String Encoding', () => {
  // Mock the batch metadata encoder
  class BatchMetadataEncoder {
    private version = '1';
    private customFolders: string[] = [];
    private folderIndices: Map<string, string> = new Map();
    
    // Preset folder indices
    private presetFolders: { [key: string]: string } = {
      'Documents': '2',
      'Images': '3', 
      'Videos': '4',
      'Music': '5',
      'Archives': '6',
      'Code': '7',
      'Trash': '8',
      'Misc': '9'
    };
    
    // Custom folder index characters (excluding confusing ones)
    private customFolderChars = '1ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    private customFolderIndex = 0;
    
    constructor() {
      // Initialize folder indices with presets
      Object.entries(this.presetFolders).forEach(([name, index]) => {
        this.folderIndices.set(name, index);
      });
    }
    
    addCustomFolder(path: string): string {
      if (!this.folderIndices.has(path)) {
        const index = this.customFolderChars[this.customFolderIndex++];
        this.folderIndices.set(path, index);
        this.customFolders.push(path);
      }
      return this.folderIndices.get(path)!;
    }
    
    encodeFile(file: {
      name: string;
      ext: string;
      path?: string;
      thumb?: string;
      metadata?: SPKFileMetadata;
    }): string {
      // Get folder index
      const folderPath = file.path || 'Misc';
      let folderIndex = this.folderIndices.get(folderPath);
      
      if (!folderIndex) {
        folderIndex = this.addCustomFolder(folderPath);
      }
      
      // Build metadata flags string
      const meta = file.metadata || new SPKFileMetadata();
      const flagStr = meta.tags ? NumberToBase64(meta.tags) : '0';
      const metaStr = `${flagStr}-${meta.license || ''}-${meta.labels || ''}`;
      
      // Return comma-separated fields: name,ext.folder,thumb,metadata
      return [
        file.name,
        `${file.ext}.${folderIndex}`,
        file.thumb || '',
        metaStr
      ].join(',');
    }
    
    encode(files: any[], options: { encrypt?: string[] } = {}): string {
      // First process all files to collect custom folders
      files.forEach(f => {
        if (f.path && !this.folderIndices.has(f.path)) {
          this.addCustomFolder(f.path);
        }
      });
      
      // Sort files by CID for deterministic order
      const sortedFiles = [...files].sort((a, b) => (a.cid || '').localeCompare(b.cid || ''));
      
      // Build header
      let header = this.version;
      
      // Add encryption keys if present
      if (options.encrypt && options.encrypt.length > 0) {
        header += '#' + options.encrypt.join(':');
      }
      
      // Add custom folders
      if (this.customFolders.length > 0) {
        header += '|' + this.customFolders.join('|');
      }
      
      // Encode files
      const fileStrings = sortedFiles.map(f => this.encodeFile(f));
      
      // Combine header and files
      return header + ',' + fileStrings.join(',');
    }
  }
  
  describe('Basic batch encoding', () => {
    it('should encode single file with minimal metadata', () => {
      const encoder = new BatchMetadataEncoder();
      const files = [{
        name: 'document',
        ext: 'pdf',
        cid: 'QmDoc123'
      }];
      
      const result = encoder.encode(files);
      expect(result).toBe('1,document,pdf.9,,0--'); // Version 1, Misc folder (9), no thumb, no metadata
    });
    
    it('should encode multiple files in preset folders', () => {
      const encoder = new BatchMetadataEncoder();
      const files = [
        {
          name: 'report',
          ext: 'pdf',
          path: 'Documents',
          cid: 'QmDoc456'
        },
        {
          name: 'photo',
          ext: 'jpg', 
          path: 'Images',
          cid: 'QmImg789',
          thumb: 'QmThumb123'
        },
        {
          name: 'video',
          ext: 'mp4',
          path: 'Videos',
          cid: 'QmVid012',
          metadata: new SPKFileMetadata({ tags: 4 }) // NSFW
        }
      ];
      
      const result = encoder.encode(files);
      expect(result).toBe('1,report,pdf.2,,0--,photo,jpg.3,QmThumb123,0--,video,mp4.4,,4--');
    });
    
    it('should sort files by CID', () => {
      const encoder = new BatchMetadataEncoder();
      const files = [
        { name: 'c', ext: 'txt', cid: 'QmCCC' },
        { name: 'a', ext: 'txt', cid: 'QmAAA' },
        { name: 'b', ext: 'txt', cid: 'QmBBB' }
      ];
      
      const result = encoder.encode(files);
      expect(result).toBe('1,a,txt.9,,0--,b,txt.9,,0--,c,txt.9,,0--');
    });
  });
  
  describe('Custom folders', () => {
    it('should encode custom folders in header', () => {
      const encoder = new BatchMetadataEncoder();
      const files = [
        {
          name: 'project',
          ext: 'zip',
          path: 'MyProjects',
          cid: 'Qm123'
        },
        {
          name: 'backup',
          ext: 'tar',
          path: 'Backups',
          cid: 'Qm456'
        }
      ];
      
      const result = encoder.encode(files);
      expect(result).toBe('1|MyProjects|Backups,project,zip.1,,0--,backup,tar.A,,0--');
    });
    
    it('should handle nested folders', () => {
      const encoder = new BatchMetadataEncoder();
      const files = [
        {
          name: 'nested',
          ext: 'txt',
          path: 'Images/Vacation',
          cid: 'Qm789'
        }
      ];
      
      const result = encoder.encode(files);
      expect(result).toBe('1|Images/Vacation,nested,txt.1,,0--');
    });
  });
  
  describe('Complete metadata encoding', () => {
    it('should encode all metadata fields', () => {
      const encoder = new BatchMetadataEncoder();
      const metadata = new SPKFileMetadata({
        tags: [4, 8], // NSFW + Executable = 12
        labels: '125',
        license: '7' // CC0
      });
      
      const files = [{
        name: 'dangerous',
        ext: 'exe',
        path: 'Code',
        thumb: 'QmDanger',
        metadata,
        cid: 'QmExe'
      }];
      
      const result = encoder.encode(files);
      expect(result).toBe('1,dangerous,exe.7,QmDanger,C-7-125');
    });
    
    it('should handle empty metadata fields', () => {
      const encoder = new BatchMetadataEncoder();
      const files = [
        {
          name: 'test1',
          ext: 'txt',
          metadata: new SPKFileMetadata({ tags: 4 }), // Only tags
          cid: 'Qm1'
        },
        {
          name: 'test2',
          ext: 'txt',
          metadata: new SPKFileMetadata({ license: '1' }), // Only license
          cid: 'Qm2'
        },
        {
          name: 'test3',
          ext: 'txt',
          metadata: new SPKFileMetadata({ labels: '23' }), // Only labels
          cid: 'Qm3'
        }
      ];
      
      const result = encoder.encode(files);
      expect(result).toBe('1,test1,txt.9,,4--,test2,txt.9,,0-1-,test3,txt.9,,0--23');
    });
  });
  
  describe('Encryption support', () => {
    it('should encode encryption keys in header', () => {
      const encoder = new BatchMetadataEncoder();
      const files = [{
        name: 'secret',
        ext: 'doc',
        cid: 'QmSecret'
      }];
      
      const result = encoder.encode(files, { encrypt: ['alice', 'bob', 'charlie'] });
      expect(result).toBe('1#alice:bob:charlie,secret,doc.9,,0--');
    });
  });
  
  describe('Real-world batch examples', () => {
    it('should encode mixed file batch', () => {
      const encoder = new BatchMetadataEncoder();
      const files = [
        {
          name: 'Q4-Report',
          ext: 'pdf',
          path: 'Documents',
          metadata: new SPKFileMetadata({ labels: '1' }), // Important
          cid: 'QmReport123'
        },
        {
          name: 'vacation-photo',
          ext: 'jpg',
          path: 'Images/2023',
          thumb: 'QmThumbVac',
          metadata: new SPKFileMetadata({ 
            tags: 4, // NSFW
            labels: '25', // Favorite + Orange
            license: '1' // CC BY
          }),
          cid: 'QmPhoto456'
        },
        {
          name: 'installer',
          ext: 'exe',
          path: 'Software',
          metadata: new SPKFileMetadata({
            tags: 8, // Executable
            labels: '14' // Important + Red
          }),
          cid: 'QmExe789'
        }
      ];
      
      const result = encoder.encode(files);
      expect(result).toBe('1|Images/2023|Software,installer,exe.A,,8--14,vacation-photo,jpg.1,QmThumbVac,4-1-25,Q4-Report,pdf.2,,0--1');
    });
    
    it('should handle large batch with many custom folders', () => {
      const encoder = new BatchMetadataEncoder();
      const files = [];
      
      // Create files in many custom folders
      for (let i = 0; i < 10; i++) {
        files.push({
          name: `file${i}`,
          ext: 'dat',
          path: `Folder${i}`,
          cid: `Qm${i.toString().padStart(3, '0')}`
        });
      }
      
      const result = encoder.encode(files);
      
      // Check header has all custom folders
      expect(result.startsWith('1|Folder0|Folder1|Folder2|Folder3|Folder4|Folder5|Folder6|Folder7|Folder8|Folder9,')).toBe(true);
      
      // Check files use correct indices (1, A, B, C, D, E, F, G, H, I)
      expect(result).toContain('file0,dat.1,');
      expect(result).toContain('file1,dat.A,');
      expect(result).toContain('file9,dat.I,');
    });
  });
  
  describe('Edge cases', () => {
    it('should handle files with commas in names', () => {
      const encoder = new BatchMetadataEncoder();
      const files = [{
        name: 'file,with,commas',
        ext: 'csv',
        cid: 'QmComma'
      }];
      
      // Note: Real implementation would need to escape commas or use different separator
      const result = encoder.encode(files);
      expect(result).toContain('file,with,commas,csv.9,');
    });
    
    it('should handle maximum metadata values', () => {
      const encoder = new BatchMetadataEncoder();
      const metadata = new SPKFileMetadata({
        tags: 255, // Max 8-bit value
        labels: '0123456789', // All labels
        license: '7'
      });
      
      const files = [{
        name: 'maxed',
        ext: 'bin',
        metadata,
        cid: 'QmMax'
      }];
      
      const result = encoder.encode(files);
      expect(result).toBe('1,maxed,bin.9,,3=-7-0123456789'); // 255 = '3=' in custom base64
    });
  });
});