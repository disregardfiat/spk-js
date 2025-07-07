// Example: Using SPK-JS with a custom signer

const SPK = require('../dist/spk-js.cjs.js');

// Example custom signer implementation
class MyCustomSigner {
  constructor(privateKeys) {
    this.privateKeys = privateKeys;
  }

  requestSignature(account, challenge, keyType, callback) {
    try {
      // In a real implementation, you would sign the challenge with the private key
      // This is just a mock example
      const mockSignature = `SIGNED:${account}:${challenge}:${keyType}`;
      const mockPublicKey = `PUBKEY:${account}:${keyType}`;
      
      callback({
        signature: mockSignature,
        publicKey: mockPublicKey
      });
    } catch (error) {
      callback({ error: error.message });
    }
  }

  requestBroadcast(account, operations, keyType, callback) {
    try {
      // In a real implementation, you would broadcast to the blockchain
      // This is just a mock example
      console.log('Broadcasting operations:', operations);
      
      callback({
        result: {
          id: `TXID:${Date.now()}`
        }
      });
    } catch (error) {
      callback({ error: error.message });
    }
  }

  // Optional synchronous methods
  requestSignatureSynchronous(account, challenge, keyType) {
    return {
      signature: `SIGNED_SYNC:${account}:${challenge}:${keyType}`,
      publicKey: `PUBKEY_SYNC:${account}:${keyType}`
    };
  }

  requestBroadcastSynchronous(account, operations, keyType) {
    console.log('Broadcasting operations synchronously:', operations);
    return {
      result: {
        id: `TXID_SYNC:${Date.now()}`
      }
    };
  }
}

// Usage example
async function main() {
  try {
    // Create a custom signer
    const customSigner = new MyCustomSigner({
      active: 'mock-active-key',
      posting: 'mock-posting-key'
    });

    // Initialize SPK with custom signer
    const spk = new SPK.default('testuser', {
      keychain: customSigner,
      node: 'https://spktest.dlux.io'
    });

    console.log('Initializing account with custom signer...');
    await spk.init();

    // Test signing
    console.log('\nTesting signature:');
    const auth = await spk.account.sign('test-message', 'Posting');
    console.log('Auth headers:', auth);

    // Test sending tokens (will use custom broadcaster)
    console.log('\nTesting token send:');
    try {
      const result = await spk.account.sendLarynx(10, 'recipient', 'Test memo');
      console.log('Send result:', result);
    } catch (error) {
      console.log('Send error (expected if not enough balance):', error.message);
    }

    console.log('\nCustom signer integration successful!');
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Run the example
main();