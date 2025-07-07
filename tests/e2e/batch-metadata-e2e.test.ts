import { BatchMetadataEncoder } from '../../src/storage/batch-metadata-encoder';
import { SPKFileMetadata } from '../../src/storage/file-metadata';

describe('Batch Metadata E2E - Trole Integration', () => {
  describe('Metadata encoding for trole upload', () => {
    it('should encode files for trole upload-authorize endpoint', () => {
      const encoder = new BatchMetadataEncoder();
      
      // Simulate files that would be uploaded
      const files = [
        {
          cid: 'QmPDF123abc',
          name: 'quarterly-report',
          ext: 'pdf',
          path: '/Documents',
          metadata: new SPKFileMetadata({
            tags: 0,
            license: '7', // CC0
            labels: '1'   // Important
          })
        },
        {
          cid: 'QmJPG456def',
          name: 'team-photo',
          ext: 'jpg',
          path: '/Images/2023',
          thumb: 'QmThumb789',
          metadata: new SPKFileMetadata({
            tags: 4,      // NSFW
            license: '1', // CC BY
            labels: '25'  // Favorite + Orange
          })
        },
        {
          cid: 'QmEXE789ghi',
          name: 'app-installer',
          ext: 'exe',
          path: '/Software',
          metadata: new SPKFileMetadata({
            tags: 8,      // Executable
            labels: '147' // Important + Red + Green
          })
        }
      ];
      
      // Encode to compact string
      const metaString = encoder.encode(files);
      console.log('Encoded metadata string:', metaString);
      
      // This is what would be sent to trole
      const trolePayload = {
        files: files.map(f => f.cid).join(','),
        meta: metaString
      };
      
      console.log('Trole upload-authorize payload:', trolePayload);
      
      // Verify the format
      expect(metaString).toMatch(/^1\|/); // Version 1 with custom folders
      expect(metaString).toContain('Software'); // Custom folder
      expect(metaString).toContain('3/2023');   // Images subfolder
      
      // Decode and verify
      const decoded = encoder.decode(metaString);
      expect(decoded.files).toHaveLength(3);
      
      // Verify file order (sorted by CID)
      expect(decoded.files[0].name).toBe('app-installer');  // QmEXE... comes first
      expect(decoded.files[1].name).toBe('team-photo');     // QmJPG... comes second
      expect(decoded.files[2].name).toBe('quarterly-report'); // QmPDF... comes third
      
      // Verify metadata preservation
      expect(decoded.files[0].metadata.tags).toBe(8);
      expect(decoded.files[1].metadata.license).toBe('1');
      expect(decoded.files[2].metadata.labels).toBe('1');
    });
    
    it('should handle minimal metadata for maximum compression', () => {
      const encoder = new BatchMetadataEncoder();
      
      // Files with no metadata
      const files = [
        { cid: 'Qm1', name: 'file1', ext: 'txt' },
        { cid: 'Qm2', name: 'file2', ext: 'dat' },
        { cid: 'Qm3', name: 'file3', ext: 'log' }
      ];
      
      const metaString = encoder.encode(files);
      console.log('Minimal metadata:', metaString);
      
      // Should be very compact - no metadata fields
      expect(metaString).toBe('1,file1,txt.0,,,file2,dat.0,,,file3,log.0,,');
      
      // Each file takes only: name,ext.folder,, (4 fields)
      const fields = metaString.split(',');
      expect(fields.length).toBe(13); // header + 3 files * 4 fields
    });
    
    it('should generate metadata for real-world batch upload scenario', () => {
      const encoder = new BatchMetadataEncoder();
      
      // Realistic file batch
      const projectFiles = [
        {
          cid: 'QmReadme123',
          name: 'README',
          ext: 'md',
          path: '/',
          metadata: new SPKFileMetadata({ labels: '1' })
        },
        {
          cid: 'QmIndex456',
          name: 'index',
          ext: 'html',
          path: '/src',
          metadata: new SPKFileMetadata({ labels: '2' })
        },
        {
          cid: 'QmStyle789',
          name: 'style',
          ext: 'css',
          path: '/src/css',
          metadata: new SPKFileMetadata()
        },
        {
          cid: 'QmScript012',
          name: 'app',
          ext: 'js',
          path: '/src/js',
          metadata: new SPKFileMetadata({ 
            tags: 8, // Executable
            labels: '7' // Green (tested)
          })
        },
        {
          cid: 'QmLogo345',
          name: 'logo',
          ext: 'png',
          path: '/assets',
          thumb: 'QmLogoThumb',
          metadata: new SPKFileMetadata({ license: '7' }) // CC0
        }
      ];
      
      const metaString = encoder.encode(projectFiles);
      console.log('Project upload metadata:', metaString);
      
      // Calculate size efficiency
      const jsonSize = JSON.stringify(projectFiles.map(f => ({
        name: f.name,
        ext: f.ext,
        path: f.path,
        thumb: f.thumb,
        tags: f.metadata?.tags || 0,
        license: f.metadata?.license || '',
        labels: f.metadata?.labels || ''
      }))).length;
      
      const compactSize = metaString.length;
      const compressionRatio = ((jsonSize - compactSize) / jsonSize * 100).toFixed(1);
      
      console.log(`Compression: JSON ${jsonSize} bytes → Compact ${compactSize} bytes (${compressionRatio}% smaller)`);
      
      // Verify all custom paths are in header
      expect(metaString).toContain('src');
      expect(metaString).toContain('src/css');
      expect(metaString).toContain('src/js');
      expect(metaString).toContain('assets');
      
      // For trole, this would be sent as:
      const troleRequest = {
        headers: {
          'X-Account': 'developer',
          'X-Contract': 'developer_1234567_project',
          'X-Sig': 'signature...'
        },
        body: {
          files: projectFiles.map(f => f.cid).join(','),
          meta: metaString
        }
      };
      
      console.log('Complete trole request structure:', JSON.stringify(troleRequest, null, 2));
    });
  });
});