# SPK-JS Client-Side Encryption Implementation

## Overview

This document describes the client-side file encryption implementation for spk-js, following Test Driven Development (TDD) principles.

## Key Features

### 1. Multi-Signature Memo Encryption
- Support for Hive Keychain multi-sig encryption (one AES key encrypted for multiple recipients)
- Fallback to individual encryption if multi-sig is not available
- Each batch of files shares the same AES encryption key for efficiency

### 2. AES-256-GCM File Encryption
- Random AES key generation for each file batch
- IV prepended to encrypted file data
- Metadata preserved (original name, type, size)

### 3. Wallet Integration
- **Hive Keychain**: Automatic detection and usage
- **Custom Wallet**: Synchronous memo encryption methods
- Unified interface for both wallet types

## Implementation Structure

### Core Modules

#### `/src/crypto/encryption.ts`
- `Encryption` class: Main encryption functionality
- `generateAESKey()`: Creates random 256-bit AES keys
- `encryptFile()`: Encrypts files using AES-GCM
- `encryptForUpload()`: Main entry point for file encryption

#### `/src/crypto/key-management.ts`
- `KeyManager` class: Manages Hive memo keys
- `fetchMemoKeys()`: Retrieves memo keys from blockchain
- Caching to minimize API calls

#### `/src/crypto/hive-crypto.ts`
- Hive-specific cryptography utilities
- Memo encryption/decryption format
- Key conversion utilities

#### `/src/wallet/encryption.ts`
- `WalletEncryption` class: Wallet interface
- `encryptMemoKeychain()`: Single recipient encryption
- `encryptMemoKeychainMultiSig()`: Multi-recipient encryption
- `encryptMemoSyncMultiSig()`: Custom wallet multi-sig

### Test Coverage

All modules have comprehensive test coverage:
- Unit tests for encryption/decryption
- Integration tests for wallet operations
- Mock implementations for testing without dependencies

## Usage Example

```javascript
// Upload encrypted files
const result = await spk.upload(files, {
  encrypt: ['alice', 'bob', 'charlie'] // Recipients who can decrypt
});

// The same AES key encrypts all files in the batch
// The AES key is wrapped for each recipient using their Hive memo key
```

## Security Considerations

1. **Client-Side Only**: All encryption happens in the browser
2. **No Key Storage**: AES keys are generated per session
3. **Hive Memo Keys**: Public keys fetched from blockchain
4. **Forward Secrecy**: New AES key for each upload batch

## Future Enhancements

1. Key derivation from shared secrets
2. Group encryption support
3. Re-encryption capabilities
4. Key rotation mechanisms