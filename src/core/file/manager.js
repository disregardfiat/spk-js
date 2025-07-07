const crypto = require('crypto');
const { EventEmitter } = require('events');

/**
 * File Manager for SPK Network
 * Handles file operations, contracts, and IPFS integration
 */
class FileManager extends EventEmitter {
  constructor(apiClient) {
    super();
    this.client = apiClient;
    this.contracts = new Map();
  }

  /**
   * Create a storage contract for a file
   */
  async createStorageContract(options) {
    const {
      cid,
      size,
      duration = 30 * 24 * 60 * 60, // 30 days default
      redundancy = 3,
      metadata = {}
    } = options;

    if (!cid) throw new Error('CID is required');
    if (!size) throw new Error('File size is required');

    const contractPayload = {
      cid,
      size: parseInt(size),
      duration: parseInt(duration),
      redundancy: parseInt(redundancy),
      metadata: JSON.stringify(metadata),
      created: Date.now()
    };

    const customJson = {
      contractName: 'storage',
      contractAction: 'create',
      contractPayload
    };

    try {
      const result = await this.client.sendCustomJSON(JSON.stringify(customJson));
      this.emit('contract-created', { cid, result });
      return result;
    } catch (error) {
      this.emit('error', { method: 'createStorageContract', error });
      throw error;
    }
  }

  /**
   * Extend an existing storage contract
   */
  async extendStorageContract(contractId, additionalDuration) {
    if (!contractId) throw new Error('Contract ID is required');
    if (!additionalDuration || additionalDuration <= 0) {
      throw new Error('Additional duration must be positive');
    }

    const customJson = {
      contractName: 'storage',
      contractAction: 'extend',
      contractPayload: {
        id: contractId,
        duration: parseInt(additionalDuration)
      }
    };

    try {
      const result = await this.client.sendCustomJSON(JSON.stringify(customJson));
      this.emit('contract-extended', { contractId, additionalDuration, result });
      return result;
    } catch (error) {
      this.emit('error', { method: 'extendStorageContract', error });
      throw error;
    }
  }

  /**
   * Cancel a storage contract
   */
  async cancelStorageContract(contractId) {
    if (!contractId) throw new Error('Contract ID is required');

    const customJson = {
      contractName: 'storage',
      contractAction: 'cancel',
      contractPayload: {
        id: contractId
      }
    };

    try {
      const result = await this.client.sendCustomJSON(JSON.stringify(customJson));
      this.emit('contract-cancelled', { contractId, result });
      return result;
    } catch (error) {
      this.emit('error', { method: 'cancelStorageContract', error });
      throw error;
    }
  }

  /**
   * Get storage contract details
   */
  async getStorageContract(contractId) {
    try {
      return await this.client.getContract(contractId);
    } catch (error) {
      this.emit('error', { method: 'getStorageContract', error });
      throw error;
    }
  }

  /**
   * List storage contracts for an account
   */
  async listStorageContracts(username) {
    try {
      const account = await this.client.getAccount(username);
      return account.storage_contracts || [];
    } catch (error) {
      this.emit('error', { method: 'listStorageContracts', error });
      throw error;
    }
  }

  /**
   * Calculate storage cost in BROCA
   */
  calculateStorageCost(size, duration, redundancy = 3) {
    // Base cost calculation (can be adjusted based on network parameters)
    const bytesPerBroca = 1024 * 1024; // 1MB per BROCA
    const secondsPerDay = 24 * 60 * 60;
    const baseCost = (size / bytesPerBroca) * (duration / secondsPerDay) * redundancy;
    
    // Add network fee (10%)
    const networkFee = baseCost * 0.1;
    
    return {
      baseCost: Math.ceil(baseCost),
      networkFee: Math.ceil(networkFee),
      totalCost: Math.ceil(baseCost + networkFee),
      breakdown: {
        sizeInMB: size / (1024 * 1024),
        durationInDays: duration / secondsPerDay,
        redundancy,
        costPerMBPerDay: 1 / (bytesPerBroca / secondsPerDay)
      }
    };
  }

  /**
   * Generate encryption key for a file
   */
  generateEncryptionKey() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Create file metadata object
   */
  createFileMetadata(options) {
    const {
      filename,
      mimeType,
      size,
      cid,
      encrypted = false,
      encryptionKey = null,
      tags = [],
      description = ''
    } = options;

    return {
      filename,
      mimeType,
      size: parseInt(size),
      cid,
      encrypted,
      encryptionKey: encrypted ? encryptionKey : null,
      tags,
      description,
      created: new Date().toISOString(),
      version: '1.0'
    };
  }

  /**
   * Pin a file (request nodes to store it)
   */
  async pinFile(cid, nodes = []) {
    const customJson = {
      contractName: 'pinning',
      contractAction: 'pin',
      contractPayload: {
        cid,
        nodes: nodes.length > 0 ? nodes : undefined
      }
    };

    try {
      const result = await this.client.sendCustomJSON(JSON.stringify(customJson));
      this.emit('file-pinned', { cid, result });
      return result;
    } catch (error) {
      this.emit('error', { method: 'pinFile', error });
      throw error;
    }
  }

  /**
   * Unpin a file
   */
  async unpinFile(cid) {
    const customJson = {
      contractName: 'pinning',
      contractAction: 'unpin',
      contractPayload: { cid }
    };

    try {
      const result = await this.client.sendCustomJSON(JSON.stringify(customJson));
      this.emit('file-unpinned', { cid, result });
      return result;
    } catch (error) {
      this.emit('error', { method: 'unpinFile', error });
      throw error;
    }
  }

  /**
   * Get pinning status for a file
   */
  async getPinningStatus(cid) {
    try {
      const response = await this.client.axios.get(`/pinning/${cid}`);
      return response.data;
    } catch (error) {
      this.emit('error', { method: 'getPinningStatus', error });
      throw error;
    }
  }

  /**
   * Share a file with another user
   */
  async shareFile(cid, recipient, options = {}) {
    const {
      encryptionKey = null,
      permissions = ['read'],
      expiry = null,
      message = ''
    } = options;

    const customJson = {
      contractName: 'sharing',
      contractAction: 'share',
      contractPayload: {
        cid,
        recipient,
        encryptionKey,
        permissions,
        expiry,
        message
      }
    };

    try {
      const result = await this.client.sendCustomJSON(JSON.stringify(customJson));
      this.emit('file-shared', { cid, recipient, result });
      return result;
    } catch (error) {
      this.emit('error', { method: 'shareFile', error });
      throw error;
    }
  }

  /**
   * Revoke file sharing
   */
  async revokeFileShare(cid, recipient) {
    const customJson = {
      contractName: 'sharing',
      contractAction: 'revoke',
      contractPayload: {
        cid,
        recipient
      }
    };

    try {
      const result = await this.client.sendCustomJSON(JSON.stringify(customJson));
      this.emit('share-revoked', { cid, recipient, result });
      return result;
    } catch (error) {
      this.emit('error', { method: 'revokeFileShare', error });
      throw error;
    }
  }

  /**
   * List shared files
   */
  async listSharedFiles(username) {
    try {
      const response = await this.client.axios.get(`/@${username}/shared`);
      return response.data;
    } catch (error) {
      this.emit('error', { method: 'listSharedFiles', error });
      throw error;
    }
  }

  /**
   * Create a collection (folder)
   */
  async createCollection(name, metadata = {}) {
    const customJson = {
      contractName: 'collections',
      contractAction: 'create',
      contractPayload: {
        name,
        metadata: JSON.stringify(metadata),
        created: Date.now()
      }
    };

    try {
      const result = await this.client.sendCustomJSON(JSON.stringify(customJson));
      this.emit('collection-created', { name, result });
      return result;
    } catch (error) {
      this.emit('error', { method: 'createCollection', error });
      throw error;
    }
  }

  /**
   * Add file to collection
   */
  async addToCollection(collectionId, cid) {
    const customJson = {
      contractName: 'collections',
      contractAction: 'add',
      contractPayload: {
        collectionId,
        cid
      }
    };

    try {
      const result = await this.client.sendCustomJSON(JSON.stringify(customJson));
      this.emit('added-to-collection', { collectionId, cid, result });
      return result;
    } catch (error) {
      this.emit('error', { method: 'addToCollection', error });
      throw error;
    }
  }

  /**
   * Remove file from collection
   */
  async removeFromCollection(collectionId, cid) {
    const customJson = {
      contractName: 'collections',
      contractAction: 'remove',
      contractPayload: {
        collectionId,
        cid
      }
    };

    try {
      const result = await this.client.sendCustomJSON(JSON.stringify(customJson));
      this.emit('removed-from-collection', { collectionId, cid, result });
      return result;
    } catch (error) {
      this.emit('error', { method: 'removeFromCollection', error });
      throw error;
    }
  }

  /**
   * Get collection details
   */
  async getCollection(collectionId) {
    try {
      const response = await this.client.axios.get(`/collections/${collectionId}`);
      return response.data;
    } catch (error) {
      this.emit('error', { method: 'getCollection', error });
      throw error;
    }
  }

  /**
   * List collections for a user
   */
  async listCollections(username) {
    try {
      const response = await this.client.axios.get(`/@${username}/collections`);
      return response.data;
    } catch (error) {
      this.emit('error', { method: 'listCollections', error });
      throw error;
    }
  }
}

module.exports = FileManager;