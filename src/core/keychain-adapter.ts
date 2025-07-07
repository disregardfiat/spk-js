/**
 * Adapter to support both custom signers and Hive Keychain
 */

export interface CustomSigner {
  requestSignature: (account: string, challenge: string, keyType: string, callback: (response: any) => void) => void;
  requestBroadcast: (account: string, operations: any[], keyType: string, callback: (response: any) => void) => void;
  requestSignatureSynchronous?: (account: string, challenge: string, keyType: string) => { signature: string; publicKey?: string };
  requestBroadcastSynchronous?: (account: string, operations: any[], keyType: string) => { result: { id: string } };
}

export interface HiveKeychain {
  requestSignBuffer: (account: string, message: string, keyType: string, callback: (response: any) => void) => void;
  requestCustomJson: (account: string, id: string, keyType: string, json: string, display: string, callback: (response: any) => void) => void;
  requestBroadcast: (account: string, operations: any[], keyType: string, callback: (response: any) => void) => void;
}

export class KeychainAdapter {
  private signer: CustomSigner | HiveKeychain;
  private isCustomSigner: boolean;

  constructor(signer: any) {
    this.signer = signer;
    // Detect if it's a custom signer by checking for requestSignature method
    this.isCustomSigner = typeof signer.requestSignature === 'function';
  }

  /**
   * Sign a message/challenge
   */
  async sign(account: string, message: string, keyType: string = 'Posting'): Promise<{ signature: string; publicKey?: string }> {
    return new Promise((resolve, reject) => {
      if (this.isCustomSigner) {
        const customSigner = this.signer as CustomSigner;
        
        // Try synchronous first if available
        if (customSigner.requestSignatureSynchronous) {
          try {
            const result = customSigner.requestSignatureSynchronous(account, message, keyType);
            resolve(result);
            return;
          } catch (error: any) {
            reject(new Error(error.message || 'Signing failed'));
            return;
          }
        }
        
        // Fall back to async
        customSigner.requestSignature(account, message, keyType, (response) => {
          if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve({
              signature: response.signature,
              publicKey: response.publicKey
            });
          }
        });
      } else {
        // Hive Keychain
        const keychain = this.signer as HiveKeychain;
        keychain.requestSignBuffer(account, message, keyType, (response) => {
          if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve({
              signature: response.signature,
              publicKey: response.publicKey
            });
          }
        });
      }
    });
  }

  /**
   * Broadcast a transaction
   */
  async broadcast(account: string, operations: any[], keyType: string = 'Active', _displayMessage?: string): Promise<{ id: string }> {
    return new Promise((resolve, reject) => {
      if (this.isCustomSigner) {
        const customSigner = this.signer as CustomSigner;
        
        // Try synchronous first if available
        if (customSigner.requestBroadcastSynchronous) {
          try {
            const result = customSigner.requestBroadcastSynchronous(account, operations, keyType);
            resolve({ id: result.result.id });
            return;
          } catch (error: any) {
            reject(new Error(error.message || 'Broadcast failed'));
            return;
          }
        }
        
        // Fall back to async
        customSigner.requestBroadcast(account, operations, keyType, (response) => {
          if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve({ id: response.result.id });
          }
        });
      } else {
        // Hive Keychain - check if it has requestBroadcast
        const keychain = this.signer as HiveKeychain;
        if (keychain.requestBroadcast) {
          keychain.requestBroadcast(account, operations, keyType, (response) => {
            if (response.error) {
              reject(new Error(response.error));
            } else {
              resolve({ id: response.result.id });
            }
          });
        } else {
          reject(new Error('Broadcast not supported by this keychain implementation'));
        }
      }
    });
  }

  /**
   * Broadcast a custom JSON operation (for Hive Keychain compatibility)
   */
  async broadcastCustomJson(
    account: string, 
    id: string, 
    keyType: string, 
    json: any, 
    displayMessage: string
  ): Promise<{ id: string }> {
    const operations = [[
      'custom_json',
      {
        required_auths: keyType === 'Active' ? [account] : [],
        required_posting_auths: keyType === 'Posting' ? [account] : [],
        id: id,
        json: typeof json === 'string' ? json : JSON.stringify(json)
      }
    ]];

    if (this.isCustomSigner) {
      // Use the generic broadcast method
      return this.broadcast(account, operations, keyType, displayMessage);
    } else {
      // Use Hive Keychain's specific method
      const keychain = this.signer as HiveKeychain;
      return new Promise((resolve, reject) => {
        keychain.requestCustomJson(
          account, 
          id, 
          keyType, 
          typeof json === 'string' ? json : JSON.stringify(json), 
          displayMessage,
          (response) => {
            if (response.error) {
              reject(new Error(response.error));
            } else {
              resolve({ id: response.result.id });
            }
          }
        );
      });
    }
  }

  /**
   * Check if keychain/signer is available
   */
  isAvailable(): boolean {
    return this.signer !== null && this.signer !== undefined;
  }
}