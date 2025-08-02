/**
 * Complete Honeygraph API Demo
 * 
 * This example demonstrates all the new Honeygraph APIs added to SPK-JS:
 * - UserAPI - User profiles, balances, contracts
 * - FileSearchAPI - File search, metadata, providers
 * - StorageAPI - Storage network, opportunities, ROI
 * - MarketAPI - DEX trading, market data, arbitrage
 * - NetworkAPI - Network topology, health, services
 * - GovernanceAPI - Proposals, voting, delegations
 */

import SPK from '@disregardfiat/spk-js';

// Helper function to format numbers
const formatNumber = (num) => new Intl.NumberFormat().format(num);
const formatPercent = (num) => `${(num * 100).toFixed(2)}%`;

async function demonstrateAllAPIs() {
  // Initialize SPK with Honeygraph
  const spk = new SPK('demo-user', {
    node: 'https://spktest.dlux.io',
    honeygraphUrl: 'https://honeygraph.dlux.io',
    enableHoneygraphCache: true,
    honeygraphCacheTTL: 60000 // 1 minute cache
  });

  await spk.init();
  
  console.log('=== SPK Network Honeygraph API Demonstration ===\n');

  // ========== 1. USER API DEMO ==========
  console.log('1. USER API DEMO');
  console.log('================\n');

  // Get user profile
  const profile = await spk.getUserProfile('disregardfiat');
  console.log('User Profile:', {
    username: profile.username,
    balances: {
      larynx: formatNumber(profile.larynxBalance / 1000) + ' LARYNX',
      spk: formatNumber(profile.spkBalance / 1000) + ' SPK',
      broca: formatNumber(profile.brocaBalance) + ' BROCA'
    }
  });

  // Get enhanced balances
  const balances = await spk.getEnhancedBalances('disregardfiat');
  console.log('\nEnhanced Balances:', {
    larynx: balances.larynx + ' LARYNX',
    spk: balances.spk + ' SPK',
    broca: balances.broca + ' BROCA',
    power: balances.power + ' LP',
    powerGranted: balances.powerGranted + ' LP (delegated)'
  });

  // Get user contracts
  const contracts = await spk.getUserContracts('disregardfiat');
  console.log('\nStorage Contracts:', {
    owned: contracts.owned.length + ' contracts',
    storing: contracts.storing.length + ' contracts storing for others',
    activeOwned: contracts.owned.filter(c => c.status === 'ACTIVE').length
  });

  // Get user summary
  const summary = await spk.users.getUserSummary('disregardfiat');
  console.log('\nUser Summary:', summary.stats);

  // ========== 2. FILE SEARCH API DEMO ==========
  console.log('\n\n2. FILE SEARCH API DEMO');
  console.log('========================\n');

  // Search files
  const searchResults = await spk.searchFiles({ 
    q: 'video',
    limit: 5 
  });
  console.log(`Found ${searchResults.length} files matching "video"`);
  if (searchResults.length > 0) {
    console.log('First result:', {
      name: searchResults[0].name,
      owner: searchResults[0].owner?.username,
      size: (searchResults[0].size / 1024 / 1024).toFixed(2) + ' MB',
      tags: searchResults[0].tags
    });
  }

  // Search by tags
  const taggedFiles = await spk.getFilesByTags(['nft', 'art'], 'OR');
  console.log(`\nFound ${taggedFiles.length} files with NFT or art tags`);

  // Get recent uploads
  const recentFiles = await spk.getRecentFiles(10);
  console.log(`\n${recentFiles.length} recent file uploads`);

  // Get file providers (if we have a CID)
  if (searchResults.length > 0) {
    const providers = await spk.getFileStorageProviders(searchResults[0].cid);
    console.log('\nStorage providers for file:', {
      cid: providers.cid,
      totalProviders: providers.totalProviders,
      minRequired: providers.minRequired,
      providers: providers.providers?.map(p => p.username)
    });
  }

  // ========== 3. STORAGE API DEMO ==========
  console.log('\n\n3. STORAGE API DEMO');
  console.log('====================\n');

  // Get storage network stats
  const storageStats = await spk.getStorageNetworkStats();
  console.log('Storage Network Statistics:', {
    totalFiles: formatNumber(storageStats.totalFiles),
    totalContracts: formatNumber(storageStats.totalContracts),
    activeContracts: formatNumber(storageStats.activeContracts),
    totalNodes: storageStats.totalNodes,
    activeNodes: storageStats.activeNodes,
    totalStorageSize: (storageStats.totalStorageSize / 1024 / 1024 / 1024 / 1024).toFixed(2) + ' TB'
  });

  // Find storage opportunities
  const opportunities = await spk.findStorageOpportunities({
    minPower: 3,
    maxCompetition: 5
  });
  console.log(`\nFound ${opportunities.length} storage opportunities`);
  if (opportunities.length > 0) {
    console.log('Best opportunity:', {
      contractId: opportunities[0].contract.id,
      needed: opportunities[0].contract.needed + ' more nodes',
      potentialEarnings: opportunities[0].potentialEarnings + ' millitokens/month',
      competition: opportunities[0].competitionLevel
    });
  }

  // Calculate storage ROI
  const roi = await spk.calculateStorageROI(
    100 * 1024 * 1024 * 1024, // 100GB
    500 // bid rate
  );
  console.log('\nStorage ROI Analysis (100GB):', {
    monthlyRevenue: formatNumber(roi.monthlyRevenue) + ' millitokens',
    monthlyRevenueUSD: '$' + roi.monthlyRevenueUSD.toFixed(2),
    roiPercentage: roi.roiPercentage.toFixed(1) + '%',
    breakEvenDays: roi.breakEvenDays + ' days'
  });

  // Get expiring contracts
  const expiring = await spk.getExpiringContracts(7);
  console.log(`\n${expiring.length} contracts expiring in the next 7 days`);

  // ========== 4. MARKET API DEMO ==========
  console.log('\n\n4. MARKET API DEMO');
  console.log('===================\n');

  // Get market depth
  const marketDepth = await spk.getMarketDepth('LARYNX:HIVE', 20);
  console.log('LARYNX:HIVE Market Depth:', {
    buyOrders: marketDepth.buyOrders?.length || 0,
    sellOrders: marketDepth.sellOrders?.length || 0,
    spread: marketDepth.spread,
    midPrice: marketDepth.midPrice,
    liquidity: {
      buy: formatNumber(marketDepth.liquidity?.buy || 0),
      sell: formatNumber(marketDepth.liquidity?.sell || 0)
    }
  });

  // Get market stats
  const marketStats = await spk.market.getMarketStats('LARYNX:HIVE');
  console.log('\n24h Market Statistics:', {
    volume: formatNumber(marketStats.volume24h),
    volumeUSD: '$' + formatNumber(marketStats.volumeUSD24h),
    high: marketStats.high24h,
    low: marketStats.low24h,
    change: marketStats.changePercent24h.toFixed(2) + '%',
    trades: marketStats.trades24h
  });

  // Get recent trades
  const recentTrades = await spk.getRecentTrades('LARYNX:HIVE', 5);
  console.log(`\n${recentTrades.length} recent trades`);

  // Get rich list
  const richList = await spk.getRichList('larynx', 5);
  console.log('\nTop 5 LARYNX Holders:');
  richList.forEach((holder, i) => {
    console.log(`  ${i + 1}. ${holder.account}: ${formatNumber(holder.balance)} (${holder.percentage.toFixed(2)}%)`);
  });

  // Find arbitrage opportunities
  const arbitrage = await spk.findArbitrageOpportunities(2);
  console.log(`\n${arbitrage.length} arbitrage opportunities with >2% profit`);

  // Get liquidity pools
  const pools = await spk.getLiquidityPools();
  console.log(`\n${pools.length} liquidity pools available`);
  if (pools.length > 0) {
    console.log('Largest pool:', {
      pair: pools[0].pair,
      totalLiquidity: formatNumber(pools[0].totalLiquidity),
      apy: pools[0].apy.toFixed(2) + '%',
      volume24h: formatNumber(pools[0].volume24h)
    });
  }

  // ========== 5. NETWORK API DEMO ==========
  console.log('\n\n5. NETWORK API DEMO');
  console.log('====================\n');

  // Get network stats
  const networkStats = await spk.honeygraph.getNetworkStats();
  console.log('Network Overview:', {
    totalNodes: networkStats.totalNodes,
    activeNodes: networkStats.activeNodes,
    networkHealth: networkStats.networkHealth + '%',
    currentBlock: formatNumber(networkStats.currentBlock),
    services: networkStats.services
  });

  // Get network health
  const health = await spk.getNetworkHealth();
  console.log('\nNetwork Health:', {
    overall: health.overall + '%',
    consensus: health.components.consensus + '%',
    storage: health.components.storage + '%',
    services: health.components.services + '%',
    alerts: health.alerts.length
  });

  // Get service providers
  const ipfsProviders = await spk.network.getServiceProviders('IPFS');
  console.log(`\n${ipfsProviders.length} IPFS service providers`);
  if (ipfsProviders.length > 0) {
    console.log('Top IPFS provider:', {
      username: ipfsProviders[0].username,
      endpoint: ipfsProviders[0].service.endpoint,
      uptime: ipfsProviders[0].service.uptime + '%',
      cost: ipfsProviders[0].service.cost + ' milliLARYNX'
    });
  }

  // Get network activity
  const activity = await spk.getNetworkActivity(24);
  console.log('\n24h Network Activity:', {
    activeUsers: formatNumber(activity.activeUsers24h),
    newUsers: activity.newUsers24h,
    topOperation: activity.topOperations?.[0]
  });

  // Get service pricing
  const pricing = await spk.getServicePricing('IPFS');
  console.log('\nIPFS Service Pricing:', {
    providers: pricing.providers?.length || 0,
    averageCost: pricing.averageCost + ' milliLARYNX',
    medianCost: pricing.medianCost + ' milliLARYNX'
  });

  // ========== 6. GOVERNANCE API DEMO ==========
  console.log('\n\n6. GOVERNANCE API DEMO');
  console.log('=======================\n');

  // Get active proposals
  const proposals = await spk.getActiveProposals();
  console.log(`${proposals.length} active governance proposals`);
  if (proposals.length > 0) {
    console.log('Latest proposal:', {
      id: proposals[0].id,
      title: proposals[0].title,
      author: proposals[0].author,
      votes: proposals[0].votes,
      expires: new Date(proposals[0].expires).toLocaleDateString()
    });
  }

  // Get voting power
  const votingPower = await spk.getVotingPower('disregardfiat');
  console.log('\nVoting Power:', {
    username: votingPower.username,
    totalPower: formatNumber(votingPower.totalPower),
    sources: votingPower.sources,
    multipliers: votingPower.multipliers
  });

  // Get governance stats
  const govStats = await spk.getGovernanceStats();
  console.log('\nGovernance Statistics:', {
    totalProposals: govStats.totalProposals,
    activeProposals: govStats.activeProposals,
    passedProposals: govStats.passedProposals,
    averageParticipation: govStats.averageParticipation.toFixed(1) + '%',
    totalVoters: formatNumber(govStats.totalVoters)
  });

  // Get upcoming votes
  const upcoming = await spk.getUpcomingVotes(14);
  console.log(`\n${upcoming.length} proposals coming up for vote in the next 14 days`);

  // ========== ADVANCED USAGE ==========
  console.log('\n\n7. ADVANCED USAGE');
  console.log('==================\n');

  // Direct Honeygraph client access
  const customQuery = await spk.honeygraph.get('/api/spk/custom/endpoint').catch(() => null);
  console.log('Custom endpoint access:', customQuery ? 'Available' : 'Not available');

  // Cache management
  console.log('\nCache enabled:', spk.honeygraph.enableCache !== false);
  spk.honeygraph.clearCache();
  console.log('Cache cleared');

  // Network topology (visualization data)
  const topology = await spk.getNetworkTopology();
  console.log('\nNetwork Topology:', {
    nodes: topology.nodes?.length || 0,
    edges: topology.edges?.length || 0,
    clusters: topology.clusters?.length || 0
  });

  console.log('\n=== Demo Complete ===');
  console.log('\nThis demo showcased all major Honeygraph API features:');
  console.log('- User profiles and balances');
  console.log('- File search and metadata');
  console.log('- Storage network analysis');
  console.log('- Market data and trading');
  console.log('- Network health and services');
  console.log('- Governance and voting');
  console.log('\nFor more details, see the documentation at:');
  console.log('https://github.com/spknetwork/spk-js/docs/honeygraph-integration.md');
}

// Run the demo
demonstrateAllAPIs()
  .then(() => console.log('\nDemo finished successfully!'))
  .catch(error => {
    console.error('\nError during demo:', error.message);
    console.error('Stack:', error.stack);
  });