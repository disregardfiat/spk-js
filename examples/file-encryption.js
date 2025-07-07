/**
 * Example: File Encryption with SPK Network
 * 
 * This example demonstrates how to encrypt files for multiple recipients
 * before uploading them to the SPK Network.
 */

const { SPKAccount, SPKFile } = require('../dist/spk-js.umd');

async function encryptAndUploadFile() {
  try {
    // Initialize account
    const account = new SPKAccount('your-username', 'https://spktest.dlux.io');
    
    // Create file handler
    const fileHandler = new SPKFile(account);
    
    // Create a test file
    const content = 'This is sensitive data that needs encryption';
    const file = new File([content], 'sensitive-doc.txt', { type: 'text/plain' });
    
    // Specify recipients who should be able to decrypt the file
    // You can include yourself ('your-username') and others
    const recipients = ['alice', 'bob', 'your-username'];
    
    console.log('Encrypting file for recipients:', recipients);
    
    // Upload with encryption
    const result = await fileHandler.upload(file, {
      encrypt: recipients,  // Enable encryption for these recipients
      duration: 30,         // Store for 30 days
      onProgress: (progress) => {
        console.log(`Upload progress: ${progress}%`);
      }
    });
    
    console.log('File uploaded successfully!');
    console.log('CID:', result.cid);
    console.log('Contract ID:', result.contract.id);
    
    // The encrypted file is now stored on IPFS
    // Only the specified recipients can decrypt it using their Hive memo keys
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

/**
 * Example: Manual encryption for advanced use cases
 */
async function manualEncryption() {
  // For more control over the encryption process
  const { Encryption, KeyManager } = require('../dist/spk-js.umd');
  
  // Initialize encryption modules
  const keyManager = new KeyManager();
  const encryption = new Encryption(keyManager);
  
  // Create a file
  const file = new File(['Secret content'], 'secret.txt', { type: 'text/plain' });
  
  // Generate AES key
  const aesKey = await encryption.generateAESKey();
  console.log('Generated AES-256 key');
  
  // Encrypt the file
  const encrypted = await encryption.encryptFile(file, aesKey);
  console.log('File encrypted, size:', encrypted.encryptedData.byteLength);
  
  // Fetch recipient memo keys from Hive blockchain
  const recipients = await keyManager.fetchMemoKeys(['alice', 'bob']);
  console.log('Fetched memo keys for:', recipients.map(r => r.account));
  
  // Wrap the AES key for each recipient
  const wrappedKeys = await encryption.wrapKeyForRecipients(aesKey, recipients);
  console.log('Wrapped keys for recipients');
  
  // The encrypted file and wrapped keys can now be uploaded
  // Recipients use their private memo keys to unwrap the AES key and decrypt the file
}

/**
 * Example: Using Hive Keychain for encryption
 */
async function keychainEncryption() {
  const { walletEncryption } = require('../dist/spk-js.umd');
  
  // Check if Hive Keychain is available
  if (!walletEncryption.isKeychainAvailable()) {
    console.log('Hive Keychain not found. Please install it.');
    return;
  }
  
  // Prepare encryption request UI
  const fileInfo = {
    name: 'document.pdf',
    size: 1024 * 1024 * 2, // 2MB
    type: 'application/pdf'
  };
  
  const recipients = ['alice', 'bob', 'charlie'];
  const uiRequest = walletEncryption.prepareEncryptionRequestUI(recipients, fileInfo);
  
  console.log(uiRequest.title);
  console.log(uiRequest.message);
  
  // Encrypt for multiple recipients using Keychain
  const encryptedKeys = await walletEncryption.encryptForMultipleRecipients(
    'your-username',
    recipients,
    'base64-encoded-aes-key-data'
  );
  
  console.log('Successfully encrypted for:', encryptedKeys.map(e => e.account));
}

/**
 * Example: Custom wallet integration (without Keychain)
 */
function customWalletEncryption() {
  const { walletEncryption } = require('../dist/spk-js.umd');
  
  // Your wallet provides these
  const privateKey = 'your-private-memo-key';
  const recipientPublicKey = 'STM8RecipientPublicKey...';
  
  // Encrypt AES key for recipient
  const encryptedKey = walletEncryption.encryptMemoSync(
    privateKey,
    recipientPublicKey,
    'aes-key-data-to-encrypt'
  );
  
  console.log('Encrypted key:', encryptedKey);
  
  // Recipient can decrypt with their private key
  const decrypted = walletEncryption.decryptMemoSync(
    'recipient-private-key',
    encryptedKey
  );
  
  console.log('Decrypted:', decrypted);
}

// Run examples
if (require.main === module) {
  console.log('SPK File Encryption Examples\n');
  
  // Uncomment to run specific examples:
  // encryptAndUploadFile();
  // manualEncryption();
  // keychainEncryption();
  // customWalletEncryption();
}