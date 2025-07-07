const axios = require('axios');
const { EventEmitter } = require('events');

/**
 * SPK Network API Client
 * Handles all HTTP communications with SPK Network nodes
 */
class SPKClient extends EventEmitter {
  constructor(config = {}) {
    super();
    this.baseURL = config.baseURL || 'https://spkinstant.hivehoneycomb.com';
    this.timeout = config.timeout || 30000;
    this.account = config.account || null;
    this.axios = axios.create({
      baseURL: this.baseURL,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Request/Response interceptors for debugging
    if (config.debug) {
      this.setupInterceptors();
    }
  }

  setupInterceptors() {
    this.axios.interceptors.request.use(
      (request) => {
        this.emit('request', request);
        return request;
      },
      (error) => {
        this.emit('request-error', error);
        return Promise.reject(error);
      }
    );

    this.axios.interceptors.response.use(
      (response) => {
        this.emit('response', response);
        return response;
      },
      (error) => {
        this.emit('response-error', error);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Get node statistics
   */
  async getStats() {
    try {
      const response = await this.axios.get('/stats');
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Get account information
   */
  async getAccount(username = this.account) {
    if (!username) {
      throw new Error('Username is required');
    }
    try {
      const response = await this.axios.get(`/@${username}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Get protocol information
   */
  async getProtocol() {
    try {
      const response = await this.axios.get('/');
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Send a custom JSON broadcast
   */
  async sendCustomJSON(json, requiredAuths = [], requiredPostingAuths = []) {
    if (!this.account) {
      throw new Error('Account must be set to send custom JSON');
    }

    const data = {
      json,
      required_auths: requiredAuths,
      required_posting_auths: requiredPostingAuths.length ? requiredPostingAuths : [this.account]
    };

    try {
      const response = await this.axios.post('/custom_json', data);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Get contract state
   */
  async getContract(contractId) {
    if (!contractId) {
      throw new Error('Contract ID is required');
    }
    try {
      const response = await this.axios.get(`/contracts/${contractId}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Get feed for an account
   */
  async getFeed(username = this.account, type = 'blog') {
    if (!username) {
      throw new Error('Username is required');
    }
    try {
      const response = await this.axios.get(`/feed/@${username}?type=${type}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Get market data
   */
  async getMarket() {
    try {
      const response = await this.axios.get('/market');
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Get open orders for an account
   */
  async getOpenOrders(username = this.account) {
    if (!username) {
      throw new Error('Username is required');
    }
    try {
      const response = await this.axios.get(`/openorders/@${username}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Get token balance for an account
   */
  async getBalance(username = this.account, token = 'LARYNX') {
    if (!username) {
      throw new Error('Username is required');
    }
    try {
      const account = await this.getAccount(username);
      return {
        balance: parseFloat(account.balance || 0),
        poweredUp: parseFloat(account.poweredUp || 0),
        granted: parseFloat(account.granted || account.granted_power || 0),
        granting: parseFloat(account.granting || account.granting_power || 0),
        liquid: parseFloat(account.balance || 0)
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Execute contract method
   */
  async executeContract(contractId, method, params = {}) {
    const customJson = {
      contractName: contractId,
      contractAction: method,
      contractPayload: params
    };

    return this.sendCustomJSON(JSON.stringify(customJson));
  }

  /**
   * Place a market order
   */
  async placeOrder(type, amount, price, tokenPair = 'LARYNX:HIVE') {
    if (!['buy', 'sell'].includes(type)) {
      throw new Error('Order type must be "buy" or "sell"');
    }

    const [baseToken, quoteToken] = tokenPair.split(':');
    
    const customJson = {
      contractName: 'market',
      contractAction: type,
      contractPayload: {
        tokenPair,
        [type === 'buy' ? 'bidAmount' : 'amount']: amount,
        price,
        baseToken,
        quoteToken
      }
    };

    return this.sendCustomJSON(JSON.stringify(customJson));
  }

  /**
   * Cancel a market order
   */
  async cancelOrder(orderId) {
    const customJson = {
      contractName: 'market',
      contractAction: 'cancel',
      contractPayload: {
        id: orderId
      }
    };

    return this.sendCustomJSON(JSON.stringify(customJson));
  }

  /**
   * Get rewards pool information
   */
  async getRewardsPool() {
    try {
      const response = await this.axios.get('/rewards_pool');
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Get validator set
   */
  async getValidators() {
    try {
      const response = await this.axios.get('/validators');
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Get node runners
   */
  async getRunners() {
    try {
      const response = await this.axios.get('/runners');
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Handle API errors consistently
   */
  handleError(error) {
    if (error.response) {
      // Server responded with error
      const message = error.response.data?.error || error.response.statusText;
      const err = new Error(message);
      err.statusCode = error.response.status;
      err.response = error.response;
      return err;
    } else if (error.request) {
      // Request made but no response
      const err = new Error('Network error: No response from server');
      err.code = 'NETWORK_ERROR';
      return err;
    } else {
      // Something else happened
      return error;
    }
  }

  /**
   * Set the active account
   */
  setAccount(username) {
    this.account = username;
  }

  /**
   * Change the base URL
   */
  setBaseURL(url) {
    this.baseURL = url;
    this.axios.defaults.baseURL = url;
  }
}

module.exports = SPKClient;