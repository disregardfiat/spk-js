# Honeygraph Integration Guide

SPK-JS now includes built-in support for Honeygraph, a Dgraph-based read replication layer that provides enhanced query capabilities and real-time data access for the SPK Network.

## Overview

Honeygraph provides:
- 🚀 **Fast Queries**: Sub-millisecond response times using Dgraph
- 📊 **Rich Data**: Complete user profiles, file metadata, and network statistics
- 🔍 **Advanced Search**: Search files by name, tags, owner, and more
- 📈 **Market Data**: Real-time DEX order books and trading statistics
- 🌐 **Network Topology**: Visualize storage relationships and service providers
- 💾 **Caching**: Built-in caching for improved performance

## Getting Started

### Basic Setup

```javascript
import SPK from '@disregardfiat/spk-js';

// Initialize with default Honeygraph configuration
const spk = new SPK('your-username');

// Or customize Honeygraph settings
const spk = new SPK('your-username', {
  honeygraphUrl: 'https://honeygraph.dlux.io',  // Default
  enableHoneygraphCache: true,                   // Default: true
  honeygraphCacheTTL: 60000                      // Default: 1 minute
});
```

### Direct Access

The Honeygraph integration adds three new properties to the SPK instance:

```javascript
spk.honeygraph  // HoneygraphClient - Direct API access
spk.users       // UserAPI - User profile operations
spk.files       // FileSearchAPI - File search and metadata
```

## User Profile API

### Get Complete User Profile

```javascript
// Get your own profile
const myProfile = await spk.getUserProfile();

// Get another user's profile
const profile = await spk.getUserProfile('alice');

// Get specific data only
const profile = await spk.getUserProfile('alice', {
  include: ['balances', 'contracts', 'services']
});
```

### Get Enhanced Balances

```javascript
// More accurate than spk.getBalances()
const balances = await spk.getEnhancedBalances();
console.log({
  larynx: balances.larynx,      // In tokens (not millitokens)
  spk: balances.spk,             // In tokens (not millitokens)
  broca: balances.broca,         // Storage credits
  power: balances.power,         // Larynx Power
  powerGranted: balances.powerGranted
});
```

### Get User Contracts

```javascript
const contracts = await spk.getUserContracts();
console.log({
  owned: contracts.owned,       // Contracts created by user
  storing: contracts.storing    // Contracts user is storing
});
```

### Get User Summary

```javascript
const summary = await spk.users.getUserSummary('alice');
console.log(summary);
// {
//   username: 'alice',
//   balances: { larynx, spk, broca, power },
//   stats: {
//     totalContracts: 10,
//     activeContracts: 8,
//     totalFiles: 125,
//     activeServices: 2
//   }
// }
```

## File Search API

### Search Files

```javascript
// Search by query string
const results = await spk.searchFiles({ 
  q: 'tutorial video',
  limit: 50 
});

// Search by tags
const nftFiles = await spk.getFilesByTags(['nft', 'art'], 'AND');

// Search by owner
const aliceFiles = await spk.searchFiles({ 
  owner: 'alice',
  tags: ['public']
});

// Combined search
const results = await spk.searchFiles({
  q: 'spk network',
  tags: ['tutorial', 'video'],
  owner: 'alice',
  limit: 25
});
```

### Get File Metadata

```javascript
// Get detailed file information
const metadata = await spk.files.getFileMetadata('QmExampleCID');
console.log({
  name: metadata.name,
  size: metadata.size,
  owner: metadata.owner.username,
  contract: metadata.contract,
  tags: metadata.tags,
  versions: metadata.versions
});
```

### Get File Providers

```javascript
// Find who is storing a file
const providers = await spk.getFileStorageProviders('QmExampleCID');
console.log({
  cid: providers.cid,
  providers: providers.providers,      // Storage nodes
  totalProviders: providers.totalProviders,
  minRequired: providers.minRequired   // Minimum nodes needed
});
```

### Get Recent Files

```javascript
// Get recently uploaded files
const recent = await spk.getRecentFiles(20);

// Get files expiring soon
const expiring = await spk.files.getExpiringFiles(7, 'alice');

// Get popular files
const popular = await spk.files.getPopularFiles('7d', 50);
```

## Market Data

### DEX Order Book

```javascript
// Get market depth for trading pairs
const depth = await spk.getMarketDepth('LARYNX:HIVE', 50);
console.log({
  buyOrders: depth.buyOrders,
  sellOrders: depth.sellOrders,
  spread: depth.spread,
  liquidity: depth.liquidity
});
```

### Rich List

```javascript
// Get top token holders
const larynxRich = await spk.getRichList('larynx', 100);
const spkRich = await spk.getRichList('spk', 100);
const powerRich = await spk.getRichList('power', 50);
```

## Network Statistics

### Storage Network Stats

```javascript
const stats = await spk.getStorageNetworkStats();
console.log({
  totalFiles: stats.totalFiles,
  totalContracts: stats.totalContracts,
  activeContracts: stats.activeContracts,
  totalNodes: stats.totalNodes,
  topStorageNodes: stats.topStorageNodes
});
```

### Network Topology

```javascript
// Visualize network relationships
const topology = await spk.getNetworkTopology();
```

### Service Providers

```javascript
// Find specific service types
const ipfsProviders = await spk.honeygraph.getServiceProviders('IPFS');
const poaProviders = await spk.honeygraph.getServiceProviders('POA');
```

## Advanced Usage

### Direct Honeygraph Client

```javascript
// Access any Honeygraph endpoint directly
const customData = await spk.honeygraph.get('/api/custom/endpoint');

// Use GraphQL queries (if supported)
const result = await spk.honeygraph.post('/graphql', {
  query: `
    query {
      users(first: 10) {
        username
        larynxBalance
      }
    }
  `
});
```

### Caching

```javascript
// Clear cache manually
spk.honeygraph.clearCache();

// Disable cache for specific instance
const spkNoCache = new SPK('username', {
  enableHoneygraphCache: false
});

// Custom cache TTL (5 minutes)
const spkLongCache = new SPK('username', {
  honeygraphCacheTTL: 300000
});
```

### Error Handling

```javascript
try {
  const profile = await spk.getUserProfile('nonexistent');
} catch (error) {
  if (error.message.includes('404')) {
    console.log('User not found');
  } else {
    console.error('API Error:', error);
  }
}
```

## Performance Tips

1. **Use Caching**: Keep cache enabled for frequently accessed data
2. **Batch Requests**: Use the include parameter to get all needed data in one request
3. **Limit Results**: Always specify reasonable limits for search queries
4. **Specific Includes**: Only request the data you need with include options

## Migration Guide

If you're already using SPK-JS, the Honeygraph integration is backward compatible:

```javascript
// Old way still works
const balances = await spk.getBalances();
const contracts = await spk.listContracts();

// New way provides more data
const enhancedBalances = await spk.getEnhancedBalances();
const enhancedContracts = await spk.getUserContracts();
```

## API Reference

### SPK Instance Methods

- `getUserProfile(username?, options?)` - Get user profile data
- `getEnhancedBalances(username?)` - Get accurate token balances
- `searchFiles(options)` - Search files across network
- `getFilesByTags(tags, logic?)` - Search files by tags
- `getFileStorageProviders(cid)` - Get storage nodes for file
- `getRecentFiles(limit?)` - Get recently uploaded files
- `getUserContracts(username?)` - Get user's contracts
- `getMarketDepth(pair, depth?)` - Get DEX order book
- `getRichList(token, limit?)` - Get top token holders
- `getNetworkTopology()` - Get network visualization data
- `getStorageNetworkStats()` - Get storage statistics

### Direct API Access

- `spk.honeygraph` - HoneygraphClient instance
- `spk.users` - UserAPI instance
- `spk.files` - FileSearchAPI instance

See the [API documentation](./api-reference.md) for complete details.