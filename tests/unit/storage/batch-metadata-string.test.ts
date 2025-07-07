import { BatchMetadataEncoder, FileWithMetadata } from '../../../src/storage/batch-metadata-encoder';
import { SPKFileMetadata } from '../../../src/storage/file-metadata';

describe('Batch Metadata String Generation', () => {
  let encoder: BatchMetadataEncoder;
  
  beforeEach(() => {
    encoder = new BatchMetadataEncoder();
  });
  
  describe('Exact string output tests', () => {
    it('should produce exact string for simple batch', () => {
      const files: FileWithMetadata[] = [
        {
          cid: 'QmDoc123',
          name: 'report',
          ext: 'pdf',
          path: 'Documents',
          metadata: new SPKFileMetadata({
            tags: 0,
            license: '7', // CC0
            labels: '1'   // Important
          })
        },
        {
          cid: 'QmImg456', 
          name: 'photo',
          ext: 'jpg',
          path: 'Images',
          thumb: 'QmThumb789',
          metadata: new SPKFileMetadata({
            tags: 4,      // NSFW
            license: '1', // CC BY
            labels: '25'  // Favorite + Orange
          })
        }
      ];
      
      const result = encoder.encode(files);
      
      // Files sorted by CID: QmDoc123, QmImg456
      expect(result).toBe('1,report,pdf.2,,0-7-1,photo,jpg.3,QmThumb789,4-1-25');
    });
    
    it('should produce exact string with custom folders', () => {
      const files: FileWithMetadata[] = [
        {
          cid: 'QmA',
          name: 'project',
          ext: 'zip',
          path: 'MyProjects',
          metadata: new SPKFileMetadata({
            tags: 0,
            license: '2',
            labels: '1'
          })
        },
        {
          cid: 'QmB',
          name: 'backup',
          ext: 'tar',
          path: 'Backups',
          thumb: '',
          metadata: new SPKFileMetadata({
            tags: 0,
            license: '',
            labels: '3'
          })
        },
        {
          cid: 'QmC',
          name: 'photo',
          ext: 'jpg',
          path: 'Images/Vacation',
          thumb: 'QmVacThumb',
          metadata: new SPKFileMetadata({
            tags: 4,
            labels: '25'
          })
        }
      ];
      
      const result = encoder.encode(files);
      
      // Custom folders: MyProjects (1), Backups (A), Images/Vacation (B)
      // Files sorted by CID: QmA, QmB, QmC
      expect(result).toBe('1|MyProjects|Backups|Images/Vacation,project,zip.1,,0-2-1,backup,tar.A,,0--3,photo,jpg.B,QmVacThumb,4--25');
    });
    
    it('should produce exact string with encryption', () => {
      const files: FileWithMetadata[] = [
        {
          cid: 'QmSecret1',
          name: 'confidential',
          ext: 'doc',
          path: 'Documents',
          metadata: new SPKFileMetadata({
            tags: 0,
            license: '4', // CC BY-NC-ND
            labels: '1'
          })
        }
      ];
      
      const result = encoder.encode(files, { encrypt: ['alice', 'bob', 'charlie'] });
      
      expect(result).toBe('1#alice:bob:charlie,confidential,doc.2,,0-4-1');
    });
    
    it('should produce exact string for complex real-world batch', () => {
      const files: FileWithMetadata[] = [
        {
          cid: 'QmExe789',
          name: 'installer',
          ext: 'exe',
          path: 'Software',
          metadata: new SPKFileMetadata({
            tags: 8,      // Executable
            labels: '14'  // Important + Red
          })
        },
        {
          cid: 'QmPhoto456',
          name: 'vacation-photo',
          ext: 'jpg', 
          path: 'Images/2023',
          thumb: 'QmThumbVac',
          metadata: new SPKFileMetadata({
            tags: 4,      // NSFW
            license: '1', // CC BY
            labels: '25'  // Favorite + Orange
          })
        },
        {
          cid: 'QmReport123',
          name: 'Q4-Report',
          ext: 'pdf',
          path: 'Documents',
          metadata: new SPKFileMetadata({
            tags: 0,
            labels: '1'   // Important
          })
        }
      ];
      
      const result = encoder.encode(files);
      
      // Custom folders: Software (1), Images/2023 (A)
      // Files sorted by CID: QmExe789, QmPhoto456, QmReport123
      expect(result).toBe('1|Software|Images/2023,installer,exe.1,,8--14,vacation-photo,jpg.A,QmThumbVac,4-1-25,Q4-Report,pdf.2,,0--1');
    });
    
    it('should handle files with minimal metadata', () => {
      const files: FileWithMetadata[] = [
        {
          cid: 'Qm1',
          name: 'file1',
          ext: 'txt'
        },
        {
          cid: 'Qm2',
          name: 'file2', 
          ext: 'dat',
          path: 'Misc'
        },
        {
          cid: 'Qm3',
          name: 'file3',
          ext: 'log',
          metadata: new SPKFileMetadata()
        }
      ];
      
      const result = encoder.encode(files);
      
      // All in Misc folder (9), no metadata
      expect(result).toBe('1,file1,txt.9,,0--,file2,dat.9,,0--,file3,log.9,,0--');
    });
    
    it('should handle maximum metadata values', () => {
      const files: FileWithMetadata[] = [
        {
          cid: 'QmMax',
          name: 'maxed-out',
          ext: 'bin',
          path: 'TestFolder',
          thumb: 'https://very-long-url.example.com/thumbnails/1234567890/image.jpg',
          metadata: new SPKFileMetadata({
            tags: 255,           // Max 8-bit value = '3=' in base64
            labels: '0123456789', // All labels
            license: '7'         // CC0
          })
        }
      ];
      
      const result = encoder.encode(files);
      
      expect(result).toBe('1|TestFolder,maxed-out,bin.1,https://very-long-url.example.com/thumbnails/1234567890/image.jpg,3=-7-0123456789');
    });
    
    it('should handle deeply nested folders', () => {
      const files: FileWithMetadata[] = [
        {
          cid: 'QmNested1',
          name: 'deep',
          ext: 'file',
          path: 'Root/Level1/Level2/Level3'
        }
      ];
      
      const result = encoder.encode(files);
      
      expect(result).toBe('1|Root/Level1/Level2/Level3,deep,file.1,,0--');
    });
    
    it('should handle many custom folders', () => {
      const files: FileWithMetadata[] = [];
      
      // Create 20 files in different custom folders
      for (let i = 0; i < 20; i++) {
        files.push({
          cid: `Qm${i.toString().padStart(3, '0')}`,
          name: `file${i}`,
          ext: 'dat',
          path: `Folder${i}`,
          metadata: new SPKFileMetadata({
            labels: i.toString()
          })
        });
      }
      
      const result = encoder.encode(files);
      
      // Check header has all 20 custom folders
      expect(result.startsWith('1|Folder0|Folder1|Folder2|Folder3|Folder4|Folder5|Folder6|Folder7|Folder8|Folder9|Folder10|Folder11|Folder12|Folder13|Folder14|Folder15|Folder16|Folder17|Folder18|Folder19,')).toBe(true);
      
      // Check first few files have correct indices
      expect(result).toContain('file0,dat.1,,0--0');     // Folder0 = 1
      expect(result).toContain('file1,dat.A,,0--1');     // Folder1 = A
      expect(result).toContain('file9,dat.J,,0--9');     // Folder9 = J
      expect(result).toContain('file10,dat.K,,0--10');   // Folder10 = K
      expect(result).toContain('file19,dat.U,,0--19');   // Folder19 = U
    });
  });
  
  describe('Round-trip encoding/decoding', () => {
    it('should decode back to original data', () => {
      const files: FileWithMetadata[] = [
        {
          cid: 'QmTest1',
          name: 'document',
          ext: 'pdf',
          path: 'Documents',
          thumb: 'QmThumb1',
          metadata: new SPKFileMetadata({
            tags: [4, 8], // 12
            labels: '125',
            license: '3'
          })
        },
        {
          cid: 'QmTest2',
          name: 'image',
          ext: 'png',
          path: 'CustomFolder',
          metadata: new SPKFileMetadata({
            tags: 0,
            labels: '9'
          })
        }
      ];
      
      const encoded = encoder.encode(files, { encrypt: ['alice'] });
      const decoded = encoder.decode(encoded);
      
      expect(decoded.version).toBe('1');
      expect(decoded.encrypt).toEqual(['alice']);
      expect(decoded.files).toHaveLength(2);
      
      // First file
      expect(decoded.files[0]).toMatchObject({
        name: 'document',
        ext: 'pdf',
        path: 'Documents',
        thumb: 'QmThumb1'
      });
      expect(decoded.files[0].metadata.tags).toBe(12);
      expect(decoded.files[0].metadata.labels).toBe('125');
      expect(decoded.files[0].metadata.license).toBe('3');
      
      // Second file
      expect(decoded.files[1]).toMatchObject({
        name: 'image',
        ext: 'png',
        path: 'CustomFolder',
        thumb: undefined
      });
      expect(decoded.files[1].metadata.tags).toBe(0);
      expect(decoded.files[1].metadata.labels).toBe('9');
      expect(decoded.files[1].metadata.license).toBe('');
    });
  });
  
  describe('Edge cases', () => {
    it('should handle empty files array', () => {
      const result = encoder.encode([]);
      expect(result).toBe('1,');
    });
    
    it('should handle special characters in folder names', () => {
      const files: FileWithMetadata[] = [
        {
          cid: 'QmSpecial',
          name: 'test',
          ext: 'txt',
          path: 'My Folder/Sub-Folder_2023'
        }
      ];
      
      const result = encoder.encode(files);
      expect(result).toBe('1|My Folder/Sub-Folder_2023,test,txt.1,,');
    });
    
    it('should maintain stable folder indices across multiple encodings', () => {
      const files1: FileWithMetadata[] = [
        { cid: 'Qm1', name: 'a', ext: 'txt', path: 'FolderA' },
        { cid: 'Qm2', name: 'b', ext: 'txt', path: 'FolderB' }
      ];
      
      const files2: FileWithMetadata[] = [
        { cid: 'Qm3', name: 'c', ext: 'txt', path: 'FolderB' },
        { cid: 'Qm4', name: 'd', ext: 'txt', path: 'FolderA' }
      ];
      
      // First encoding
      encoder = new BatchMetadataEncoder();
      const result1 = encoder.encode(files1);
      
      // Second encoding with same encoder would reuse indices
      // But we create new encoder to test fresh state
      encoder = new BatchMetadataEncoder();
      const result2 = encoder.encode(files2);
      
      // Both should have same folder structure
      expect(result1).toBe('1|FolderA|FolderB,a,txt,,,b,txt.A,,');
      expect(result2).toBe('1|FolderA|FolderB,a,txt,,,b,txt.A,,');
    });
  });
});