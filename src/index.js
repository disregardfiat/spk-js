const SPKClient = require('./core/api/client');
const AccountManager = require('./core/account/manager');
const FileManager = require('./core/file/manager');
const BrocaCalculator = require('./core/broca/calculator');

/**
 * Main SPK-JS Library
 * Provides a unified interface to the SPK Network
 */
class SPK {
  constructor(config = {}) {
    // Initialize API client
    this.client = new SPKClient(config);
    
    // Initialize managers
    this.account = new AccountManager(this.client);
    this.file = new FileManager(this.client);
    this.broca = new BrocaCalculator(this.client);
    
    // Set account if provided
    if (config.account) {
      this.setAccount(config.account);
    }
    
    // Expose client for direct API access
    this.api = this.client;
  }

  /**
   * Set the active account
   */
  setAccount(username) {
    this.client.setAccount(username);
    return this;
  }

  /**
   * Get the active account
   */
  getActiveAccount() {
    return this.client.account;
  }

  /**
   * Change API endpoint
   */
  setApiUrl(url) {
    this.client.setBaseURL(url);
    return this;
  }

  /**
   * Quick balance check
   */
  async getBalance(username = this.client.account) {
    return this.account.getBalances(username);
  }

  /**
   * Quick BROCA status check
   */
  async getBrocaStatus(username = this.client.account) {
    return this.broca.getAccountBrocaStatus(username);
  }

  /**
   * Calculate storage cost
   */
  async calculateStorageCost(sizeInBytes, durationInDays = 30, redundancy = 3) {
    const durationInSeconds = durationInDays * 24 * 60 * 60;
    return this.broca.calculateStorageCost(sizeInBytes, durationInSeconds, redundancy);
  }

  /**
   * Create storage contract
   */
  async createStorageContract(options) {
    return this.file.createStorageContract(options);
  }

  /**
   * Transfer tokens
   */
  async transfer(to, amount, token = 'LARYNX', memo = '') {
    return this.account.transfer(to, amount, token, memo);
  }

  /**
   * Stake tokens
   */
  async stake(amount, token = 'LARYNX') {
    return this.account.stake(amount, token);
  }

  /**
   * Get network stats
   */
  async getStats() {
    return this.client.getStats();
  }

  /**
   * Factory method for creating instances
   */
  static create(config) {
    return new SPK(config);
  }
}

// Export main class and components
module.exports = SPK;
module.exports.SPK = SPK;
module.exports.SPKClient = SPKClient;
module.exports.AccountManager = AccountManager;
module.exports.FileManager = FileManager;
module.exports.BrocaCalculator = BrocaCalculator;

// For ES6 imports
module.exports.default = SPK;