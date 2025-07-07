# SPK-JS

JavaScript library for interacting with SPK Network decentralized storage.

## Features

- 🚀 Simple API for decentralized file storage
- 🔐 Hive blockchain authentication
- 📦 Automatic IPFS content addressing
- 💰 Token management (LARYNX, SPK, BROCA)
- 🔄 Chunked uploads with resume support
- 🔒 Client-side encryption
- 📁 Virtual file system
- ⚡ TypeScript support

## Installation

```bash
npm install @spknetwork/spk-js
```

Or via CDN:

```html
<script src="https://unpkg.com/@spknetwork/spk-js/dist/spk.js"></script>
```

## Quick Start

```javascript
import SPK from '@spknetwork/spk-js';

// Initialize with Hive account
const spk = new SPK('username');
await spk.init();

// Upload a file
const file = document.getElementById('fileInput').files[0];
const result = await spk.upload(file);

console.log(`File uploaded: https://ipfs.dlux.io/ipfs/${result.cid}`);
```

## Usage

### Authentication

SPK-JS uses Hive Keychain for secure authentication:

```javascript
const spk = new SPK('username', {
  node: 'https://spktest.dlux.io', // Optional: custom node
  keychain: window.hive_keychain     // Optional: explicit keychain
});

await spk.init(); // Initializes account data
```

### File Upload

Basic upload:

```javascript
const result = await spk.upload(file);
// Returns: { cid, contract, size, url }
```

Advanced upload with options:

```javascript
const result = await spk.upload(file, {
  encrypt: ['alice', 'bob'],  // Encrypt for specific users
  folder: 'Documents',        // Virtual folder
  tags: ['important'],        // Metadata tags
  duration: 90,              // Storage duration in days
  autoRenew: true,           // Auto-renew contract
  onProgress: (percent) => {
    console.log(`Upload progress: ${percent}%`);
  }
});
```

### Token Operations

```javascript
// Get balances
const balances = await spk.getBalances();
// { larynx: 1000, spk: 500, broca: 250000 }

// Send tokens
await spk.sendLarynx(100, 'recipient', 'Optional memo');
await spk.sendSpk(50, 'recipient');

// Power up/down
await spk.powerUp(100);    // Stake LARYNX
await spk.powerDown(100);  // Unstake LARYNX
```

### File Management

```javascript
// List files
const files = await spk.listFiles({
  folder: 'Documents',
  tags: ['important']
});

// Get file info
const file = await spk.getFile('QmXxx...');

// Delete file (stops renewal)
await spk.deleteFile('QmXxx...');
```

### Encryption

```javascript
// Upload encrypted file
const result = await spk.upload(file, {
  encrypt: ['alice', 'bob', 'charlie']
});

// Decrypt file (if you have access)
const decrypted = await spk.decrypt(result.cid);
```

## API Reference

### Constructor

```typescript
new SPK(username: string, options?: SPKOptions)
```

Options:
- `node`: SPK Network API node URL
- `ipfsGateway`: IPFS gateway URL
- `keychain`: Hive Keychain instance

### Methods

#### Account Methods
- `init()`: Initialize account data
- `getAccount()`: Get full account details
- `getBalances()`: Get token balances
- `refresh()`: Refresh account data

#### File Methods
- `upload(file, options)`: Upload file to IPFS
- `listFiles(filters)`: List user's files
- `getFile(cid)`: Get file metadata
- `deleteFile(cid)`: Stop file renewal

#### Token Methods
- `sendLarynx(amount, to, memo)`: Send LARYNX tokens
- `sendSpk(amount, to, memo)`: Send SPK tokens
- `powerUp(amount)`: Stake LARYNX tokens
- `powerDown(amount)`: Unstake LARYNX tokens

## Development

### Setup

```bash
git clone https://github.com/spknetwork/spk-js.git
cd spk-js
npm install
```

### Testing

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

### Building

```bash
npm run build         # Build library
npm run build:watch   # Watch mode
npm run docs          # Generate documentation
```

## Examples

See the [examples](./examples) directory for complete examples:

- [Basic Upload](./examples/basic-upload.html)
- [React Integration](./examples/react-example)
- [Vue 3 Integration](./examples/vue-example)
- [Node.js Usage](./examples/node-example)

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Write tests for your changes
4. Ensure all tests pass (`npm test`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## License

MIT License - see [LICENSE](./LICENSE) for details

## Links

- [SPK Network](https://spknetwork.io)
- [Documentation](https://docs.spknetwork.io)
- [Discord](https://discord.gg/spknetwork)
- [GitHub](https://github.com/spknetwork/spk-js)