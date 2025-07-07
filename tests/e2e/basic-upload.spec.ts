import { test, expect } from '@playwright/test';

test.describe('Basic Upload Example', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/basic-upload.html');
  });

  test('should load the page', async ({ page }) => {
    await expect(page).toHaveTitle('SPK-JS Basic Upload Example');
    await expect(page.locator('h1')).toHaveText('SPK Network File Upload');
  });

  test('should show error when no username entered', async ({ page }) => {
    await page.click('button:has-text("Connect")');
    await expect(page.locator('.error')).toHaveText('Please enter a username');
  });

  test('should show keychain warning if not installed', async ({ page }) => {
    // Check if warning is displayed
    const hasKeychain = await page.evaluate(() => !!(window as any).hive_keychain);
    if (!hasKeychain) {
      await expect(page.locator('.error')).toContainText('Hive Keychain not detected');
    }
  });

  test('should connect with valid username', async ({ page }) => {
    // Mock Hive Keychain
    await page.evaluate(() => {
      (window as any).hive_keychain = {
        requestSignBuffer: (_username: string, _message: string, _method: string, callback: Function) => {
          callback(null, {
            signature: 'mock_signature',
            publicKey: 'STM8MockPublicKey'
          });
        },
        requestCustomJson: (_username: string, _id: string, _method: string, _json: string, _display: string, callback: Function) => {
          callback(null, { success: true });
        }
      };
    });

    // Mock fetch for API calls
    await page.route('**/spktest.dlux.io/**', async route => {
      const url = route.request().url();
      if (url.includes('/@testuser')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            balance: 1000,
            spk: 500,
            broca: '250000,1000',
            poweredUp: 100,
            pubKey: 'STM8...',
            spk_power: 1000000,
            head_block: 2000
          })
        });
      } else {
        await route.continue();
      }
    });

    await page.fill('#username', 'testuser');
    await page.click('button:has-text("Connect")');

    await expect(page.locator('#accountInfo')).toBeVisible();
    await expect(page.locator('#larynxBalance')).toHaveText('1000.000');
    await expect(page.locator('#spkBalance')).toHaveText('500.000');
  });

  test('should calculate storage cost', async ({ page }) => {
    // Set up connection first
    await page.evaluate(() => {
      (window as any).spk = {
        calculateStorageCost: async (size: number, days: number) => ({
          broca: Math.ceil(size * days * 0.001),
          canAfford: true,
          currentBroca: 250000
        })
      };
    });

    // Create a test file
    const buffer = Buffer.from('test file content');
    const dataTransfer = await page.evaluateHandle((data) => {
      const dt = new DataTransfer();
      const file = new File([data], 'test.txt', { type: 'text/plain' });
      dt.items.add(file);
      return dt;
    }, buffer);

    const fileInput = page.locator('#fileInput');
    await fileInput.dispatchEvent('drop', { dataTransfer });

    const uploadBtn = page.locator('#uploadBtn');
    await expect(uploadBtn).toBeEnabled();
  });

  test('should show upload progress', async ({ page }) => {
    // Mock everything needed for upload
    await page.evaluate(() => {
      (window as any).spk = {
        calculateStorageCost: async () => ({
          broca: 100,
          canAfford: true,
          currentBroca: 250000
        }),
        upload: async (file: File, options: any) => {
          // Simulate progress
          for (let i = 0; i <= 100; i += 10) {
            options.onProgress(i);
            await new Promise(r => setTimeout(r, 50));
          }
          return {
            cid: 'QmTest123',
            contract: { id: 'contract123' },
            size: file.size,
            url: 'https://ipfs.dlux.io/ipfs/QmTest123'
          };
        },
        getBalances: async () => ({
          larynx: 1000,
          spk: 500,
          broca: 249900
        })
      };
    });

    // Create and select a file
    const buffer = Buffer.from('test file content');
    await page.setInputFiles('#fileInput', {
      name: 'test.txt',
      mimeType: 'text/plain',
      buffer
    });

    await page.click('#uploadBtn');

    // Check progress bar appears
    await expect(page.locator('#progressContainer')).toBeVisible();
    
    // Wait for upload to complete
    await expect(page.locator('.result')).toContainText('Upload Successful!');
    await expect(page.locator('.result')).toContainText('QmTest123');
  });
});