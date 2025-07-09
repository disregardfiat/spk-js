// Example: Upload with automatic provider selection
const SPK = require('../dist/spk-js.cjs.js');

async function main() {
  try {
    // Initialize SPK with test account
    const spk = new SPK.default('testuser', {
      node: 'https://spktest.dlux.io'
    });

    console.log('Initializing SPK account...');
    await spk.init();

    // Check BROCA balance
    const balances = await spk.getBalances();
    console.log('\nCurrent BROCA balance:', balances.broca);

    // Create some test files
    const files = [
      new File(['Hello World'], 'hello.txt', { type: 'text/plain' }),
      new File(['Test content'], 'test.txt', { type: 'text/plain' })
    ];

    // Calculate total size
    const totalSize = files.reduce((sum, f) => sum + f.size, 0);
    console.log('\nTotal file size:', totalSize, 'bytes');

    // Calculate BROCA cost
    const costInfo = await spk.calculateStorageCost(totalSize, 30);
    console.log('Required BROCA:', costInfo.broca);
    console.log('Can afford:', costInfo.canAfford);

    if (!costInfo.canAfford) {
      console.error('Insufficient BROCA!');
      return;
    }

    // Upload files - spk-js will automatically:
    // 1. Fetch available providers
    // 2. Check their health and available space
    // 3. Select the best provider
    // 4. Create a blockchain contract
    // 5. Upload the files
    console.log('\nStarting upload...');
    const result = await spk.upload(files, {
      duration: 30,
      metadata: {
        path: 'Documents',
        tags: ['test', 'example'],
        license: 'CC0'
      },
      onProgress: (percent) => {
        console.log(`Upload progress: ${percent}%`);
      }
    });

    console.log('\nUpload complete!');
    if ('results' in result) {
      // Batch upload result
      console.log('Contract ID:', result.contractId);
      console.log('Total BROCA cost:', result.totalBrocaCost);
      console.log('Files uploaded:');
      result.results.forEach((file, i) => {
        console.log(`  ${files[i].name}: ${file.cid}`);
        console.log(`    URL: ${file.url}`);
      });
    } else {
      // Single file result
      console.log('CID:', result.cid);
      console.log('URL:', result.url);
      console.log('Contract:', result.contract);
    }

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  }
}

// Direct access to provider selector if needed
async function checkProviders() {
  const { StorageProviderSelector } = require('../dist/spk-js.cjs.js');
  
  const selector = new StorageProviderSelector('https://spktest.dlux.io');
  
  console.log('Fetching providers...');
  await selector.fetchProviders();
  
  console.log('Fetching provider stats...');
  await selector.fetchAllProviderStats();
  
  console.log('\nHealthy providers for 100MB file:');
  const providers = selector.getHealthyProviders(100 * 1024 * 1024);
  
  providers.forEach(p => {
    console.log(`- ${p.nodeId}:`);
    console.log(`  Free space: ${selector.formatBytes(p.freeSpace)}`);
    console.log(`  Free ratio: ${(p.freeSpaceRatio * 100).toFixed(1)}%`);
    console.log(`  API: ${p.api}`);
  });
}

// Uncomment to run provider check
// checkProviders();

// Run the upload example
main();