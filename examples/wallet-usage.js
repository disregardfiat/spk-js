/**
 * Example usage of SPK wallet methods
 */

const SPK = require('@spknetwork/spk-js');
const AccountManager = require('@spknetwork/spk-js/core/account/manager');
const SPKClient = require('@spknetwork/spk-js/core/api/client');
const walletCalculations = require('@spknetwork/spk-js/wallet/calculations');
const precision = require('@spknetwork/spk-js/utils/precision');

async function example() {
  // Initialize SPK with username
  const spk = new SPK('username');
  await spk.init();
  
  // Method 1: Use SPKAccount methods directly
  console.log('=== Using SPKAccount methods ===');
  
  // Get basic token data
  await spk.account.getTokenUser();
  console.log('Balance:', spk.account.balance);
  console.log('SPK Power:', spk.account.spk_power);
  console.log('BROCA:', spk.account.broca);
  
  // Get full SPK data with rewards
  await spk.account.getSpkApi();
  console.log('SPK with rewards:', spk.account.spk);
  
  // Calculate current BROCA
  const currentBroca = await spk.account.calculateBroca();
  console.log('Available BROCA:', currentBroca);
  
  // Method 2: Use AccountManager for global state
  console.log('\n=== Using AccountManager ===');
  
  const client = new SPKClient({
    baseURL: 'https://spkinstant.hivehoneycomb.com'
  });
  const accountManager = new AccountManager(client);
  
  // Set current account
  await accountManager.setCurrentAccount('username');
  
  // Get wallet state
  const walletState = await accountManager.getWalletState();
  console.log('Wallet State:', JSON.stringify(walletState, null, 2));
  
  // Get formatted balances
  const formatted = await accountManager.getFormattedBalances();
  console.log('Formatted Balances:', formatted);
  
  // Method 3: Use wallet calculations directly
  console.log('\n=== Using wallet calculations ===');
  
  // Calculate BROCA
  const broca = walletCalculations.broca_calc(
    '100,A5', // current broca string
    144000,   // refill rate
    1000,     // spk_power
    50000     // head block
  );
  console.log('Calculated BROCA:', broca);
  
  // Calculate SPK rewards
  const accountData = {
    spk_block: 40000,
    head_block: 50000,
    gov: 1000,
    pow: 500,
    granted: { t: 2000 },
    granting: { t: 1000 }
  };
  const stats = {
    spk_rate_lgov: 0.1,
    spk_rate_lpow: 0.05,
    spk_rate_ldel: 0.08
  };
  const rewards = walletCalculations.calculateSpkReward(accountData, stats);
  console.log('Pending rewards:', rewards);
  
  // Method 4: Use precision utilities
  console.log('\n=== Using precision utilities ===');
  
  // Format amounts
  const amount = precision.formatTokenAmount(1234.567, 'SPK');
  console.log('Formatted:', amount);
  
  // Add amounts with precision
  const sum = precision.addTokenAmounts(10.123, 5.456, 'SPK');
  console.log('Sum:', sum);
  
  // Validate amount
  const validation = precision.validateAmount(100.1234, {
    token: 'SPK',
    min: 0.001,
    max: 1000000
  });
  console.log('Validation:', validation);
  
  // Clean up
  accountManager.destroy();
}

// Integration example for spk-desktop
function setupSPKWallet(username) {
  const client = new SPKClient({
    baseURL: 'https://spkinstant.hivehoneycomb.com'
  });
  const accountManager = new AccountManager(client);
  
  // Set up event listeners
  accountManager.on('account-changed', (data) => {
    console.log('Account changed:', data.username);
  });
  
  accountManager.on('account-refreshed', (data) => {
    console.log('Account refreshed:', data.username);
    // Update UI with new balances
  });
  
  accountManager.on('error', (error) => {
    console.error('Account error:', error);
  });
  
  // Initialize account
  accountManager.setCurrentAccount(username).then(() => {
    console.log('Wallet initialized for:', username);
  });
  
  // Start auto-refresh (every 30 seconds)
  accountManager.setRefreshInterval(30000);
  
  return accountManager;
}

// Export for use in other modules
module.exports = { setupSPKWallet };

// Run example if called directly
if (require.main === module) {
  example().catch(console.error);
}