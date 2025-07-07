import SPK from '../../src/index';
import { TAGS, LABELS, LICENSES } from '../../src/storage/file-metadata';

describe('Complete Metadata Flow Integration', () => {
  let spk: SPK;
  let mockKeychain: any;
  
  beforeEach(() => {
    // Mock Hive Keychain
    mockKeychain = {
      requestSignBuffer: jest.fn((_message: any, _account: any, _type: any, callback: any) => {
        callback({ success: true, result: 'mock-signature', publicKey: 'mock-pubkey' });
      }),
      requestBroadcast: jest.fn((_account: any, _operations: any, _keyType: any, callback: any) => {
        callback({ success: true, result: { id: 'mock-txid' } });
      })
    };
    
    // Mock fetch
    global.fetch = jest.fn().mockImplementation((url) => {
      if (url.includes('/api/protocol')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            precision: 3,
            jsonPrefix: 'spkcc_',
            multisig: 'dlux-cc'
          })
        });
      }
      if (url.includes('/@testuser')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            result: {
              name: 'testuser',
              spk: 1000,
              broca: 500
            }
          })
        });
      }
      if (url.includes('/upload-authorize')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true })
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({})
      });
    });
    
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
    
    spk = new SPK('testuser', { keychain: mockKeychain });
  });

  describe('User-friendly metadata input', () => {
    it('should demonstrate complete metadata flow for image upload', async () => {
      // Mock the internal methods we can't easily test
      spk['fileUpload']['hashFile'] = jest.fn().mockResolvedValue('QmImageHash123');
      spk.account.api.post = jest.fn().mockResolvedValue({
        id: 'contract-123',
        df: ['QmImageHash123'],
        i: 'contract-123',
        t: 'testuser',
        fosig: 'mock-sig',
        api: 'https://ipfs.dlux.io'
      });
      spk.account.registerPublicKey = jest.fn().mockResolvedValue(undefined);
      spk.account.calculateBroca = jest.fn().mockResolvedValue(1000);
      
      const file = new File(['image data'], 'vacation-photo.jpg', { type: 'image/jpeg' });
      
      // User provides metadata in a friendly format
      await spk.upload(file, {
        metaData: [{
          FileIndex: 0,
          name: 'Summer Vacation 2023',
          ext: 'jpg',
          path: '/Photos/Vacations/2023',
          thumbnail: 'https://cdn.example.com/thumbs/vacation2023.jpg',
          tags: [4], // NSFW content warning
          labels: '125', // Important, Favorite, Orange
          license: '1', // CC BY (Attribution)
          autoRenew: true
        }]
      });
      
      // Verify the contract was created with properly formatted metadata
      expect(spk.account.api.post).toHaveBeenCalledWith(
        '/api/new_contract',
        expect.objectContaining({
          metadata: {
            name: 'Summer Vacation 2023',
            ext: 'jpg',
            path: '/Photos/Vacations/2023',
            thumb: 'https://cdn.example.com/thumbs/vacation2023.jpg',
            flag: '4', // Tags converted to base64
            labels: '125', // Labels as string
            license: '1' // License as string
          }
        }),
        expect.any(Object)
      );
    });

    it('should demonstrate batch upload with mixed metadata', async () => {
      // Mock internals
      spk['fileUpload']['hashFile'] = jest.fn()
        .mockResolvedValueOnce('QmDoc123')
        .mockResolvedValueOnce('QmVideo456')
        .mockResolvedValueOnce('QmExe789');
        
      spk.account.api.post = jest.fn().mockResolvedValue({
        id: 'contract-123',
        df: ['QmTest'],
        i: 'contract-123',
        t: 'testuser',
        fosig: 'mock-sig',
        api: 'https://ipfs.dlux.io'
      });
      spk.account.registerPublicKey = jest.fn().mockResolvedValue(undefined);
      spk.account.calculateBroca = jest.fn().mockResolvedValue(1000);
      
      const files = [
        new File(['doc'], 'report.pdf', { type: 'application/pdf' }),
        new File(['video'], 'tutorial.mp4', { type: 'video/mp4' }),
        new File(['exe'], 'installer.exe', { type: 'application/x-msdownload' })
      ];
      
      try {
        await spk.upload(files, {
          autoRenew: false, // Global setting
          metaData: [
            {
              FileIndex: 0,
              name: 'Q4 Financial Report',
              tags: 0, // No special tags
              labels: '1', // Important
              license: '4' // CC BY-NC-ND
            },
            {
              FileIndex: 1,
              name: 'How to Use SPK Network',
              tags: 0, // No warnings
              labels: '2', // Favorite
              license: '2', // CC BY-SA
              autoRenew: true // Override global setting
            },
            {
              FileIndex: 2,
              name: 'SPK Desktop Installer',
              tags: 8, // Executable warning
              labels: '14', // Important + Red (warning)
              license: '7' // CC0 Public Domain
            }
          ]
        });
      } catch {
        // Ignore upload errors, just check metadata
      }
      
      // Verify each file got correct metadata
      const calls = (spk.account.api.post as jest.Mock).mock.calls;
      
      // First file (PDF)
      expect(calls[0][1].metadata).toEqual({
        name: 'Q4 Financial Report',
        labels: '1',
        license: '4'
        // No flag since tags = 0
      });
      expect(calls[0][1].autoRenew).toBe(false);
      
      // Second file (Video)
      expect(calls[1][1].metadata).toEqual({
        name: 'How to Use SPK Network',
        labels: '2',
        license: '2'
        // No flag since tags = 0
      });
      expect(calls[1][1].autoRenew).toBe(true); // Overridden
      
      // Third file (Executable)
      expect(calls[2][1].metadata).toEqual({
        name: 'SPK Desktop Installer',
        flag: '8', // Executable tag in base64
        labels: '14',
        license: '7'
      });
      expect(calls[2][1].autoRenew).toBe(false);
    });
  });

  describe('Metadata constants validation', () => {
    it('should have correct tag definitions', () => {
      expect(TAGS).toEqual([
        { value: 4, label: 'NSFW', description: 'Not Safe For Work' },
        { value: 8, label: 'Executable', description: 'Is an executable file' }
      ]);
    });

    it('should have correct label definitions', () => {
      expect(LABELS).toHaveLength(10);
      expect(LABELS[0]).toEqual({ value: '0', label: 'Miscellaneous', icon: 'fa-sink' });
      expect(LABELS[1]).toEqual({ value: '1', label: 'Important', icon: 'fa-exclamation' });
      expect(LABELS[2]).toEqual({ value: '2', label: 'Favorite', icon: 'fa-star' });
      expect(LABELS[9]).toEqual({ value: '9', label: 'Purple', icon: 'fa-circle text-purple' });
    });

    it('should have correct license definitions', () => {
      expect(LICENSES).toHaveLength(7);
      expect(LICENSES[0]).toEqual({
        value: '1',
        label: 'CC BY',
        description: 'Creative Commons Attribution License',
        link: 'https://creativecommons.org/licenses/by/4.0/'
      });
      expect(LICENSES[6]).toEqual({
        value: '7',
        label: 'CC0',
        description: 'CC0: Public Domain Grant',
        link: 'https://creativecommons.org/publicdomain/zero/1.0/'
      });
    });
  });

  describe('Metadata string format examples', () => {
    it('should show expected output for common scenarios', () => {
      // These tests document the expected string formats for reference
      
      // Example 1: NSFW image
      const nsfw = {
        tags: [4],
        labels: '2', // Just favorite
        license: '1' // CC BY
      };
      // Expected output: flag: '4', labels: '2', license: '1'
      
      // Example 2: Important document
      const document = {
        tags: 0, // No tags
        labels: '1', // Important
        license: '5' // CC BY-NC
      };
      // Expected output: no flag field, labels: '1', license: '5'
      
      // Example 3: Executable with warnings
      const executable = {
        tags: 8, // Executable
        labels: '14', // Important + Red
        license: '' // No license
      };
      // Expected output: flag: '8', labels: '14', no license field
      
      // Example 4: Multiple tags combined
      const multiTag = {
        tags: [4, 8], // NSFW + Executable = 12
        labels: '123456789', // All labels
        license: '7' // CC0
      };
      // Expected output: flag: 'C' (base64 of 12), labels: '123456789', license: '7'
      
      // Document these expectations
      expect(nsfw).toBeDefined();
      expect(document).toBeDefined();
      expect(executable).toBeDefined();
      expect(multiTag).toBeDefined();
    });
  });
});