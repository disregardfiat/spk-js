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

### NPM

```bash
npm install @disregardfiat/spk-js
```

### CDN

```html
<script src="https://unpkg.com/@disregardfiat/spk-js@latest/dist/spk-js.min.js"></script>
```

### Specific Version

```bash
npm install @disregardfiat/spk-js@1.0.0-alpha.1
```

## Quick Start

```javascript
import SPK from '@disregardfiat/spk-js';

// Initialize with Hive account
const spk = new SPK('username');
await spk.init();

// Upload a file
const file = document.getElementById('fileInput').files[0];
const result = await spk.upload(file);

console.log(`File uploaded: ${result.cid}`);
```

## Usage

### Authentication

SPK-JS supports two authentication methods:

#### 1. Hive Keychain (Auto-detected)

If Hive Keychain is available in the browser, it will be used automatically:

```javascript
const spk = new SPK('username');
await spk.init(); // Auto-detects window.hive_keychain
```

#### 2. Custom Signer

You can provide a custom signer object with the following interface:

```javascript
const customSigner = {
  requestSignature: (account, challenge, keyType, callback) => {
    // Your signing implementation
    // callback({ signature: '...', publicKey: '...' }) on success
    // callback({ error: 'error message' }) on failure
  },
  requestBroadcast: (account, operations, keyType, callback) => {
    // Your broadcast implementation for raw Hive operations
    // operations is an array of Hive transaction operations
    // callback({ result: { id: 'txid' } }) on success
    // callback({ error: 'error message' }) on failure
  },
  requestEncryptMemo: (account, recipient, memo, callback) => {
    // Your memo encryption implementation
    // recipient can be a string (single) or array (multi-sig)
    // callback({ success: true, result: '#encrypted-memo' }) on success
    // callback({ success: false, error: 'error message' }) on failure
  }
};

const spk = new SPK('username', {
  keychain: customSigner
});
```

**Note**: The library automatically detects whether you're using a custom signer or Hive Keychain and adapts accordingly.

For synchronous implementations, you can also provide:
- `requestSignatureSynchronous(account, challenge, keyType)` - Returns `{ signature, publicKey }` or throws
- `requestBroadcastSynchronous(account, operations, keyType)` - Returns `{ result: { id } }` or throws
- `encryptMemoSync(privateKey, recipientPublicKey, message)` - Returns encrypted memo string starting with '#'
- `decryptMemoSync(privateKey, encryptedMemo)` - Returns decrypted message

### File Upload

Basic upload:

```javascript
const result = await spk.upload(file);
// Returns: { cid, contract, size, url }
```

Advanced upload with options:

```javascript
const result = await spk.upload(files,{
  // contract options {} defaults to autoRenew
  encrypt: ['alice', 'bob'],  // Encrypt for specific users
  autoRenew: true, 
  metaData: [{
      name: 'Different',
      FileIndex: 0,
      ext: 'jpg',
      path: '/Documents',        // See Virtual File System
      thumbnail: `CID`, // custom thumbnail CID or address
      tags: ['important'],        // See Tags
      license: 'CC0', // See License
      labels: '', // See Labels
      autoRenew: true,           // Auto-renew contract
      onProgress: (percent) => {
        console.log(`Upload progress: ${percent}%`);
  }
}]);
```

The user will be prompted for signatures and brodcasts as appropriate. It is better to batch file uploads where possible to minimize interactions.

### Token Operations

```javascript
// Get balances
const balances = await spk.getBalances();
// { ClaimableLARYNX: 1, LARYNX: 1000, ClaimableSPK: 2, SPK: 500, BROCA: 250, LP: 100, SP: 10, BP: 1000, BRC: '35Mb' }

// Send tokens
await spk.sendLarynx(100, 'recipient', 'Optional memo'); //in millitokens
await spk.sendSpk(50, 'recipient');
await spk.send('50.000 BROCA', 'charlie') // will parse floats and token names

// Power up/down
await spk.brocaPowerUp(100);    // Stake LARYNX
await spk.spkPowerDown(100);  // Unstake LARYNX
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

// Delete file (stops renewal, places in "Trash")
await spk.deleteFile('QmXxx...');
```

### Encryption

SPK-JS provides client-side file encryption using AES-256-GCM with Hive memo key wrapping:

```javascript
// Upload encrypted file
const result = await spk.upload(file, {
  encrypt: ['alice', 'bob', 'charlie'] // Recipients who can decrypt
});

// The file is encrypted with a random AES key
// The AES key is wrapped for each recipient using their Hive memo key
// The signer account is automatically included as a recipient
// Only specified recipients (plus the signer) can decrypt the file
```

#### How It Works

1. **AES Key Generation**: A random 256-bit AES key is generated for each batch of files
2. **File Encryption**: All files in the batch are encrypted using the same AES-256-GCM key
3. **Auto-Signer Inclusion**: The signer account is automatically added to recipients (no need to track keys)
4. **Key Wrapping**: The AES key is encrypted for each recipient using their Hive memo key
5. **Multi-Sig Support**: When available, uses Hive Keychain multi-sig to encrypt for all recipients at once
6. **Upload**: The encrypted files and wrapped keys are uploaded to IPFS

#### Manual Encryption (Advanced)

```javascript
import { Encryption, KeyManager } from '@disregardfiat/spk-js';

// Initialize encryption
const keyManager = new KeyManager();
const encryption = new Encryption(keyManager);

// Generate AES key
const aesKey = await encryption.generateAESKey();

// Encrypt file
const encrypted = await encryption.encryptFile(file, aesKey);

// Fetch recipient memo keys
const recipients = await keyManager.fetchMemoKeys(['alice', 'bob']);

// Wrap AES key for recipients
const wrappedKeys = await encryption.wrapKeyForRecipients(aesKey, recipients);
```

#### Wallet Integration

SPK-JS integrates with Hive Keychain for memo encryption:

```javascript
import { walletEncryption } from '@disregardfiat/spk-js';

// Check if Hive Keychain is available
if (walletEncryption.isKeychainAvailable()) {
  // Single recipient encryption
  const encrypted = await walletEncryption.encryptMemoKeychain(
    'sender',
    'recipient',
    'aes-key-data'
  );
  
  // Multi-signature encryption (encrypt for multiple recipients at once)
  const encryptedKeys = await walletEncryption.encryptMemoKeychainMultiSig(
    'sender',
    ['alice', 'bob', 'charlie'], // Array of recipients
    'aes-key-data'
  );
  // Returns: [
  //   { account: 'alice', encryptedKey: '#encrypted-for-alice' },
  //   { account: 'bob', encryptedKey: '#encrypted-for-bob' },
  //   { account: 'charlie', encryptedKey: '#encrypted-for-charlie' }
  // ]
  
  // Batch encryption with automatic fallback
  const results = await walletEncryption.encryptForMultipleRecipients(
    'sender',
    ['alice', 'bob', 'charlie'],
    'aes-key-data'
  );
  // Tries multi-sig first, falls back to individual encryption if needed
} else {
  // Use custom wallet with synchronous encryption
  const encrypted = walletEncryption.encryptMemoSync(
    privateKey,
    recipientPublicKey,
    'aes-key-data'
  );
  
  // Multi-recipient with custom wallet
  const recipients = [
    { account: 'alice', publicKey: 'STM8PublicKey1...' },
    { account: 'bob', publicKey: 'STM8PublicKey2...' }
  ];
  const encryptedKeys = walletEncryption.encryptMemoSyncMultiSig(
    privateKey,
    recipients,
    'aes-key-data'
  );
}
```

##### Hive Keychain Methods

When Hive Keychain is available (`window.hive_keychain`), it provides:

- `requestEncryptMemo(account, recipient, memo, callback)`
  - `recipient`: Can be a string (single recipient) or array (multi-sig)
  - Multi-sig response formats:
    - Array: `['#encrypted-for-alice', '#encrypted-for-bob']`
    - Object: `{ alice: '#encrypted-for-alice', bob: '#encrypted-for-bob' }`

##### Metadata Storage

Encrypted file metadata can be stored on-chain in a compact format:

```javascript
import { Encryption } from '@disregardfiat/spk-js';

// Generate compact metadata string
const metadataString = Encryption.generateMetadataString(metadata);
// Returns base64 encoded string with minimal keys

// Parse metadata string back to object
const metadata = Encryption.parseMetadataString(metadataString);
```

## Virtual File System

The SPK Network provides a virtual file system for organizing uploaded files. Files can be organized into folders and tagged with metadata for better organization and discovery.

### File System API

SPK-JS includes a FileSystem module that provides easy access to the Honeygraph file system API:

```javascript
// Browse user's files
const listing = await spk.filesystem.browse('username');
console.log(`Found ${listing.contents.length} items`);

// Browse specific folder
const docs = await spk.filesystem.browse('username', '/Documents');

// Get file URL
const fileUrl = await spk.filesystem.getFileUrl('username', '/Images/photo.jpg');

// Search for files
const videos = await spk.filesystem.searchFiles('username', '*.mp4', '/Videos');

// Check if path exists
const exists = await spk.filesystem.exists('username', '/Music');

// Get preset folders
const folders = await spk.filesystem.getPresetFolders('username');
// Returns: Documents, Images, Videos, Music, Archives, Code, Trash, Misc

// Calculate directory size
const size = await spk.filesystem.getDirectorySize('username', '/Documents');
console.log(`Total size: ${(size / 1024 / 1024).toFixed(2)} MB`);

// Build file tree
const tree = await spk.filesystem.buildFileTree('username', '/', 2);

// Access shared files
const sharedWithMe = await spk.filesystem.getSharedWithMe('username');
const sharedByMe = await spk.filesystem.getSharedByMe('username');
```

### File System Entry Structure

Each file or directory entry contains:
- `name`: File/folder name
- `type`: 'file' or 'directory'
- `path`: Full path
- `cid`: IPFS content identifier (files only)
- `size`: File size in bytes
- `mimeType`: File MIME type
- `itemCount`: Number of items (directories only)
- `contract`: Storage contract details
- `metadata`: Additional metadata (encryption, tags, etc.)

## Metadata

SPK Network supports rich metadata for uploaded files including tags, labels, and licenses. This metadata helps with file organization, discovery, and rights management.

### Tags

Tags are content warnings and file type indicators stored as bitwise flags:

```javascript
import { SPKFileMetadata, TAGS } from '@disregardfiat/spk-js';

// Create metadata with tags
const metadata = new SPKFileMetadata({
  tags: [4, 8] // NSFW + Executable
});

// Or add tags individually
metadata.addTag(4); // Add NSFW tag
metadata.removeTag(8); // Remove Executable tag

// Check if tag is present
if (metadata.hasTag(4)) {
  console.log('Content is NSFW');
}

// Available tags:
// 4 - NSFW (Not Safe For Work)
// 8 - Executable (Is an executable file)
```

### Labels

Labels are visual organization markers stored as a string of characters:

```javascript
// Add labels to files
metadata.addLabel('1'); // Important
metadata.addLabel('2'); // Favorite
metadata.addLabel('5'); // Orange

// Check labels
if (metadata.hasLabel('1')) {
  console.log('File is marked as important');
}

// Available labels:
// 0 - Miscellaneous
// 1 - Important
// 2 - Favorite (default)
// 3 - Random
// 4 - Red
// 5 - Orange
// 6 - Yellow
// 7 - Green
// 8 - Blue
// 9 - Purple
```

### Licenses

Licenses define usage rights using Creative Commons standards:

```javascript
// Set a license
metadata.setLicense('7'); // CC0 Public Domain

// Get license details
const license = metadata.getLicenseDetails();
console.log(license.description); // "CC0: Public Domain Grant"
console.log(license.link); // "https://creativecommons.org/..."

// Available licenses:
// 1 - CC BY (Attribution)
// 2 - CC BY-SA (Attribution Share-Alike)
// 3 - CC BY-ND (Attribution No-Derivatives)
// 4 - CC BY-NC-ND (Attribution Non-Commercial No-Derivatives)
// 5 - CC BY-NC (Attribution Non-Commercial)
// 6 - CC BY-NC-SA (Attribution Non-Commercial Share-Alike)
// 7 - CC0 (Public Domain)
```

### Using Metadata with Uploads

```javascript
// Upload with metadata
const result = await spk.upload(files, {
  metaData: [{
    name: 'vacation-photo',
    FileIndex: 0,
    ext: 'jpg',
    thumb: 'https://example.com/thumb.jpg',
    path: '/Photos/Vacation',
    tags: [4], // NSFW
    labels: '125', // Important, Favorite, Orange
    license: '1' // CC BY
  }]
});

// Or use the SPKFileMetadata class
const metadata = new SPKFileMetadata({
  name: 'document',
  ext: 'pdf',
  tags: [8], // Executable
  labels: '1', // Important
  license: '2' // CC BY-SA
});

const result = await spk.upload(file, {
  metaData: [metadata.toSPKFormat()]
});
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

#### Storage Node Operations
- `registerNode(ipfsId, domain, bidRate)`: Register as a storage node
- `getNodeStatus()`: Check node registration status
- `storeFiles(contractIds)`: Store files on the network (become a storage provider)
- `removeFiles(contractIds)`: Remove files from storage (stop being a provider)
- `getStoredContracts()`: Get contracts being stored by this node
- `getAvailableContracts(limit)`: Find under-replicated contracts to store
- `extendContract(contractId, fileOwner, brocaAmount, power)`: Extend a storage contract
- `calculateStorageEarnings(contract, bidRate)`: Calculate potential earnings
- `batchStore(contractIds, chunkSize)`: Batch store multiple contracts efficiently
- `registerAuthority(pubKey)`: Register a public key authority

### Storage Node Example

```javascript
// Register as a storage node
const nodeReg = await spk.registerNode(
  'QmYourIPFSNodeId',        // From `ipfs id`
  'https://your-node.com',   // Your public URL
  500                        // Bid rate
);

// Find and store available contracts
const available = await spk.getAvailableContracts(10);
const contractIds = available.slice(0, 3).map(c => c.id);
const storeResult = await spk.storeFiles(contractIds);

// Check what you're storing
const stored = await spk.getStoredContracts();
console.log(`Storing ${stored.length} contracts`);

// Calculate earnings
const earnings = spk.calculateStorageEarnings({
  size: 1024 * 1024,     // 1MB
  providers: 3,          // 3 storage nodes
  duration: 28800 * 30   // 30 days in blocks
});
```

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
- [Storage Node Operations](./examples/storage-node-operations.js)

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

- [SPK Network](https://spk.network/)
- [Documentation](https://dlux.io/docs)
- [Discord](https://discord.gg/YEHvWEvvey)
- [GitHub](https://github.com/disregardfiat/spk-js)