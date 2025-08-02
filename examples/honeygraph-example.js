/**
 * Example: Using SPK-JS with Honeygraph API
 * 
 * This example demonstrates how to use the new Honeygraph integration
 * to access enhanced SPK Network data.
 */

import SPK from '@disregardfiat/spk-js';

async function main() {
  // Initialize SPK with optional Honeygraph configuration
  const spk = new SPK('your-username', {
    node: 'https://spktest.dlux.io',
    honeygraphUrl: 'https://honeygraph.dlux.io', // Optional, this is the default
    enableHoneygraphCache: true,                 // Optional, default is true
    honeygraphCacheTTL: 60000                   // Optional, 1 minute default
  });

  // Initialize the SPK instance
  await spk.init();

  // ========== User Profile Examples ==========
  
  // Get your complete profile
  const myProfile = await spk.getUserProfile();
  console.log('My Profile:', myProfile);

  // Get another user's profile with specific data
  const aliceProfile = await spk.getUserProfile('alice', { 
    include: ['balances', 'contracts', 'services'] 
  });
  console.log('Alice Profile:', aliceProfile);

  // Get enhanced balances (more accurate than SPK node)
  const balances = await spk.getEnhancedBalances();
  console.log('My Balances:', {
    larynx: `${balances.larynx} LARYNX`,
    spk: `${balances.spk} SPK`,
    broca: `${balances.broca} BROCA`,
    power: `${balances.power} LP`
  });

  // Get user contracts
  const contracts = await spk.getUserContracts();
  console.log('My Contracts:', {
    owned: contracts.owned.length,
    storing: contracts.storing.length
  });

  // ========== File Search Examples ==========

  // Search files by query
  const searchResults = await spk.searchFiles({ 
    q: 'tutorial',
    limit: 10 
  });
  console.log('Search Results:', searchResults.length, 'files found');

  // Search files by tags
  const videoFiles = await spk.getFilesByTags(['video', 'tutorial'], 'AND');
  console.log('Video Tutorials:', videoFiles.length, 'files found');

  // Get recently uploaded files
  const recentFiles = await spk.getRecentFiles(20);
  console.log('Recent Files:', recentFiles);

  // Get storage providers for a specific file
  if (searchResults.length > 0) {
    const providers = await spk.getFileStorageProviders(searchResults[0].cid);
    console.log('Storage Providers:', providers);
  }

  // ========== Market Data Examples ==========

  // Get DEX market depth
  const marketDepth = await spk.getMarketDepth('LARYNX:HIVE', 50);
  console.log('Market Depth:', {
    buyOrders: marketDepth.buyOrders?.length || 0,
    sellOrders: marketDepth.sellOrders?.length || 0
  });

  // Get rich list
  const richList = await spk.getRichList('larynx', 10);
  console.log('Top 10 LARYNX Holders:', richList);

  // ========== Network Statistics ==========

  // Get storage network stats
  const storageStats = await spk.getStorageNetworkStats();
  console.log('Storage Network:', storageStats);

  // Get network topology
  const topology = await spk.getNetworkTopology();
  console.log('Network Topology:', topology);

  // ========== Direct Honeygraph Client Access ==========
  
  // You can also access the Honeygraph client directly for advanced queries
  const governance = await spk.honeygraph.getProposals('active');
  console.log('Active Proposals:', governance);

  // Search for specific service providers
  const ipfsProviders = await spk.honeygraph.getServiceProviders('IPFS');
  console.log('IPFS Service Providers:', ipfsProviders);

  // ========== Using Individual APIs ==========

  // Access UserAPI directly
  const userSummary = await spk.users.getUserSummary('alice');
  console.log('Alice Summary:', userSummary);

  // Access FileSearchAPI directly
  const fileStats = await spk.files.getFileStats('QmExampleCID');
  console.log('File Stats:', fileStats);

  // Find similar files
  const similarFiles = await spk.files.searchSimilarFiles('QmExampleCID');
  console.log('Similar Files:', similarFiles);
}

// Run the example
main().catch(console.error);