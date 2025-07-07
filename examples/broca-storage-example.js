// Example: BROCA Storage Calculation with SPK-JS

const SPK = require('../dist/spk-js.cjs.js');

async function main() {
  try {
    // Initialize SPK with test account
    const spk = new SPK.default('disregardfiat', {
      node: 'https://spktest.dlux.io'
    });

    console.log('Initializing SPK account...');
    await spk.init();

    // Get extended balances including BROCA storage
    console.log('\nFetching token balances with BROCA storage calculation...');
    const balances = await spk.getBalances();
    
    console.log('\nToken Balances:');
    console.log('  LARYNX:', balances.larynx);
    console.log('  SPK:', balances.spk);
    console.log('  BROCA Credits:', balances.broca);
    console.log('  BROCA Power (BP):', balances.BP || 0);
    console.log('  BROCA Storage Capacity:', balances.BRC || '0MB');
    
    // Get BROCA storage directly from account
    console.log('\nDirect BROCA storage calculation:');
    const brocaStorage = await spk.account.getBrocaStorage();
    console.log('  Storage Capacity:', brocaStorage);
    
    // Show the calculation details
    console.log('\nBROCA Storage Calculation:');
    console.log('  Formula: BROCA Credits × channel_bytes = Total Bytes');
    console.log('  BROCA Credits:', balances.broca);
    console.log('  Channel Bytes: 1024 (1KB per BROCA credit)');
    console.log('  Total Bytes:', balances.broca * 1024);
    
    // Show how BROCA credits regenerate
    console.log('\nBROCA Credit Regeneration:');
    console.log('  BROCA Power:', balances.BP || 0);
    console.log('  Max BROCA Credits:', (balances.BP || 0) * 1000);
    console.log('  Regeneration Rate: Based on block production (144,000 blocks for full refill)');
    
    // Show liquid BROCA
    console.log('\nBROCA Tokens:');
    console.log('  Liquid BROCA:', spk.account.liq_broca || 0);
    console.log('  BROCA Power:', spk.account.pow_broca || 0);
    console.log('  Total BROCA Value:', (spk.account.liq_broca || 0) + (spk.account.pow_broca || 0));

  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Run the example
main();