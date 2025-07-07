/**
 * Example: Client-side file encryption with SPK-JS
 */

import SPK from '@spknetwork/spk-js';
import { Encryption } from '@spknetwork/spk-js';

async function encryptAndUploadExample() {
  // Initialize SPK with your Hive account
  const spk = new SPK('myusername');
  await spk.init();

  // Get file from input
  const fileInput = document.getElementById('file-input');
  const file = fileInput.files[0];

  // Example 1: Simple encrypted upload
  // The signer account is automatically included as a recipient
  const result1 = await spk.upload(file, {
    encrypt: ['alice', 'bob'] // Recipients who can decrypt
  });
  console.log('Encrypted file uploaded:', result1.cid);

  // Example 2: Multiple files with same encryption key
  const files = Array.from(fileInput.files);
  const result2 = await spk.upload(files, {
    encrypt: ['alice', 'bob', 'charlie'],
    metadata: files.map((f, i) => ({
      name: f.name,
      FileIndex: i,
      tags: ['encrypted'],
      path: '/SecureDocuments'
    }))
  });
  console.log('Batch encrypted:', result2);

  // Example 3: Direct encryption API usage
  const keyManager = new KeyManager();
  const encryption = new Encryption(keyManager, 'myusername');
  
  const encrypted = await encryption.encryptForUpload(
    file,
    ['alice', 'bob']
  );
  
  // Generate metadata string for on-chain storage
  const metadataString = Encryption.generateMetadataString(encrypted.metadata);
  console.log('Metadata string:', metadataString);
  
  // The metadata can be parsed back later
  const parsedMetadata = Encryption.parseMetadataString(metadataString);
  console.log('Recipients:', parsedMetadata.recipients);
  console.log('Encrypted keys:', parsedMetadata.encryptedKeys);
}

// Example 4: Custom wallet integration
async function customWalletExample() {
  const { walletEncryption } = await import('@spknetwork/spk-js');
  
  // For custom wallets that don't use Hive Keychain
  if (!walletEncryption.isKeychainAvailable()) {
    // Use synchronous encryption with your private key
    const privateKey = 'your-private-memo-key';
    const recipients = [
      { account: 'alice', publicKey: 'STM8PublicKeyAlice...' },
      { account: 'bob', publicKey: 'STM8PublicKeyBob...' }
    ];
    
    const encryptedKeys = walletEncryption.encryptMemoSyncMultiSig(
      privateKey,
      recipients,
      'aes-key-data'
    );
    
    console.log('Encrypted for recipients:', encryptedKeys);
  }
}

// Example 5: Understanding the encryption flow
async function encryptionFlowExample() {
  /*
   * 1. Generate random AES-256 key for the batch of files
   * 2. Encrypt each file with the same AES key
   * 3. Fetch recipient memo keys from Hive blockchain
   * 4. Encrypt the AES key for each recipient (including signer)
   * 5. Store encrypted files with metadata containing:
   *    - Original file info (name, type)
   *    - Recipients list
   *    - Encrypted AES keys for each recipient
   *    - IV for decryption
   * 
   * Benefits:
   * - Signer automatically included (no need to track keys)
   * - Multi-sig encryption when available (efficient)
   * - Fallback to individual encryption if needed
   * - Compact metadata format for on-chain storage
   */
}