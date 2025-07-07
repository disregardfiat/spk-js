const { EventEmitter } = require('events');
const { broca_calc, calculateSpkReward, formatSPKAmount, getHiveAccount } = require('../../wallet/calculations');
const { formatTokenAmount, calculateTotalValue } = require('../../utils/precision');

/**
 * Account Manager for SPK Network
 * Handles account operations, balances, and delegations
 */
class AccountManager extends EventEmitter {
  constructor(apiClient) {
    super();
    this.client = apiClient;
    this.cache = new Map();
    this.cacheTimeout = 60000; // 1 minute cache
    
    // Global account state
    this.currentAccount = null;
    this.accountData = null;
    this.hiveAccountData = null;
    this.networkStats = null;
    this.lastRefresh = 0;
    this.refreshInterval = 30000; // 30 seconds auto-refresh
    this.autoRefreshTimer = null;
  }

  /**
   * Get full account details
   */
  async getAccount(username) {
    // Check cache first
    const cached = this.getFromCache(username);
    if (cached) return cached;

    try {
      const account = await this.client.getAccount(username);
      this.setCache(username, account);
      return account;
    } catch (error) {
      this.emit('error', { method: 'getAccount', username, error });
      throw error;
    }
  }

  /**
   * Get account balances for multiple tokens
   */
  async getBalances(username) {
    const account = await this.getAccount(username);
    
    return {
      LARYNX: {
        balance: parseFloat(account.balance || 0),
        staked: parseFloat(account.poweredUp || 0),
        delegatedIn: parseFloat(account.granted || account.granted_power || 0),
        delegatedOut: parseFloat(account.granting || account.granting_power || 0),
        total: parseFloat(account.balance || 0) + 
               parseFloat(account.poweredUp || 0) + 
               parseFloat(account.granted || account.granted_power || 0) -
               parseFloat(account.granting || account.granting_power || 0)
      },
      SPK: {
        balance: parseFloat(account.spk_balance || 0),
        staked: parseFloat(account.spk_power || 0),
        total: parseFloat(account.spk_balance || 0) + parseFloat(account.spk_power || 0)
      },
      BROCA: {
        balance: parseFloat(account.broca || 0),
        allocated: parseFloat(account.broca_allocated || 0),
        available: parseFloat(account.broca || 0) - parseFloat(account.broca_allocated || 0)
      }
    };
  }

  /**
   * Get power (staked tokens) details
   */
  async getPowerDetails(username) {
    const account = await this.getAccount(username);
    
    return {
      larynxPower: parseFloat(account.poweredUp || 0),
      spkPower: parseFloat(account.spk_power || 0),
      totalDelegatedIn: parseFloat(account.granted || account.granted_power || 0),
      totalDelegatedOut: parseFloat(account.granting || account.granting_power || 0),
      effectivePower: parseFloat(account.poweredUp || 0) + 
                      parseFloat(account.granted || account.granted_power || 0) -
                      parseFloat(account.granting || account.granting_power || 0),
      votingPower: account.voting_power || 10000,
      downvotePower: account.downvote_power || 10000
    };
  }

  /**
   * Get delegation details
   */
  async getDelegations(username) {
    const account = await this.getAccount(username);
    
    return {
      incoming: account.incoming_delegations || [],
      outgoing: account.outgoing_delegations || [],
      totalIn: parseFloat(account.granted || account.granted_power || 0),
      totalOut: parseFloat(account.granting || account.granting_power || 0)
    };
  }

  /**
   * Get account history/transactions
   */
  async getHistory(username, limit = 100, offset = 0) {
    try {
      const response = await this.client.axios.get(`/@${username}/history`, {
        params: { limit, offset }
      });
      return response.data;
    } catch (error) {
      this.emit('error', { method: 'getHistory', username, error });
      throw error;
    }
  }

  /**
   * Get pending rewards
   */
  async getPendingRewards(username) {
    const account = await this.getAccount(username);
    
    return {
      authorRewards: parseFloat(account.pending_author_rewards || 0),
      curatorRewards: parseFloat(account.pending_curator_rewards || 0),
      beneficiaryRewards: parseFloat(account.pending_beneficiary_rewards || 0),
      total: parseFloat(account.pending_author_rewards || 0) +
             parseFloat(account.pending_curator_rewards || 0) +
             parseFloat(account.pending_beneficiary_rewards || 0)
    };
  }

  /**
   * Get governance details
   */
  async getGovernanceInfo(username) {
    const account = await this.getAccount(username);
    
    return {
      isValidator: account.validator || false,
      isRunner: account.runner || false,
      validatorRank: account.validator_rank || null,
      runnerRank: account.runner_rank || null,
      lastVoteTime: account.last_vote_time || null,
      governanceWeight: this.calculateGovernanceWeight(account)
    };
  }

  /**
   * Calculate governance weight based on staked tokens
   */
  calculateGovernanceWeight(account) {
    const larynxPower = parseFloat(account.poweredUp || 0);
    const spkPower = parseFloat(account.spk_power || 0);
    const delegatedIn = parseFloat(account.granted || account.granted_power || 0);
    const delegatedOut = parseFloat(account.granting || account.granting_power || 0);
    
    // Basic calculation - can be adjusted based on network rules
    return (larynxPower + spkPower + delegatedIn - delegatedOut) * 1000;
  }

  /**
   * Get account's open orders
   */
  async getOpenOrders(username) {
    try {
      return await this.client.getOpenOrders(username);
    } catch (error) {
      this.emit('error', { method: 'getOpenOrders', username, error });
      throw error;
    }
  }

  /**
   * Get account's contracts
   */
  async getContracts(username) {
    const account = await this.getAccount(username);
    return account.contracts || [];
  }

  /**
   * Transfer tokens
   */
  async transfer(to, amount, token = 'LARYNX', memo = '') {
    const customJson = {
      contractName: 'tokens',
      contractAction: 'transfer',
      contractPayload: {
        to,
        symbol: token,
        quantity: amount.toString(),
        memo
      }
    };

    return this.client.sendCustomJSON(JSON.stringify(customJson));
  }

  /**
   * Stake tokens (power up)
   */
  async stake(amount, token = 'LARYNX') {
    const customJson = {
      contractName: 'tokens',
      contractAction: 'stake',
      contractPayload: {
        symbol: token,
        quantity: amount.toString()
      }
    };

    return this.client.sendCustomJSON(JSON.stringify(customJson));
  }

  /**
   * Unstake tokens (power down)
   */
  async unstake(amount, token = 'LARYNX') {
    const customJson = {
      contractName: 'tokens',
      contractAction: 'unstake',
      contractPayload: {
        symbol: token,
        quantity: amount.toString()
      }
    };

    return this.client.sendCustomJSON(JSON.stringify(customJson));
  }

  /**
   * Delegate tokens
   */
  async delegate(to, amount, token = 'LARYNX') {
    const customJson = {
      contractName: 'tokens',
      contractAction: 'delegate',
      contractPayload: {
        to,
        symbol: token,
        quantity: amount.toString()
      }
    };

    return this.client.sendCustomJSON(JSON.stringify(customJson));
  }

  /**
   * Undelegate tokens
   */
  async undelegate(from, amount, token = 'LARYNX') {
    const customJson = {
      contractName: 'tokens',
      contractAction: 'undelegate',
      contractPayload: {
        from,
        symbol: token,
        quantity: amount.toString()
      }
    };

    return this.client.sendCustomJSON(JSON.stringify(customJson));
  }

  /**
   * Claim rewards
   */
  async claimRewards() {
    const customJson = {
      contractName: 'distribution',
      contractAction: 'claim',
      contractPayload: {}
    };

    return this.client.sendCustomJSON(JSON.stringify(customJson));
  }

  /**
   * Vote for content
   */
  async vote(author, permlink, weight = 10000) {
    const customJson = {
      contractName: 'votes',
      contractAction: 'vote',
      contractPayload: {
        author,
        permlink,
        weight
      }
    };

    return this.client.sendCustomJSON(JSON.stringify(customJson));
  }

  /**
   * Cache management
   */
  getFromCache(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  setCache(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  clearCache() {
    this.cache.clear();
  }

  /**
   * Update cache timeout
   */
  setCacheTimeout(timeout) {
    this.cacheTimeout = timeout;
  }

  /**
   * Set the current global account
   */
  async setCurrentAccount(username) {
    if (this.currentAccount === username) return;
    
    this.currentAccount = username;
    this.client.setAccount(username);
    
    // Stop auto-refresh for previous account
    this.stopAutoRefresh();
    
    // Load new account data
    await this.refreshCurrentAccount();
    
    // Start auto-refresh
    this.startAutoRefresh();
    
    this.emit('account-changed', { username, data: this.accountData });
  }

  /**
   * Get current account name
   */
  getCurrentAccount() {
    return this.currentAccount;
  }

  /**
   * Refresh current account data
   */
  async refreshCurrentAccount() {
    if (!this.currentAccount) return null;
    
    try {
      // Fetch SPK account data
      this.accountData = await this.getAccount(this.currentAccount);
      
      // Fetch network stats for calculations
      this.networkStats = await this.client.getStats();
      
      // Calculate additional values
      this.accountData.spk_reward = calculateSpkReward(this.accountData, this.networkStats);
      this.accountData.broca_available = broca_calc(
        this.accountData.broca || '0,0',
        144000,
        this.accountData.spk_power || 0,
        this.accountData.head_block || 0
      );
      
      // Try to fetch Hive account data
      try {
        this.hiveAccountData = await getHiveAccount(this.currentAccount);
      } catch (error) {
        console.warn('Failed to fetch Hive account data:', error);
        this.hiveAccountData = null;
      }
      
      this.lastRefresh = Date.now();
      this.emit('account-refreshed', {
        username: this.currentAccount,
        spkData: this.accountData,
        hiveData: this.hiveAccountData
      });
      
      return {
        spk: this.accountData,
        hive: this.hiveAccountData
      };
    } catch (error) {
      this.emit('error', { method: 'refreshCurrentAccount', error });
      throw error;
    }
  }

  /**
   * Get complete wallet state
   */
  async getWalletState() {
    if (!this.currentAccount) {
      throw new Error('No account set');
    }
    
    // Refresh if data is stale
    if (Date.now() - this.lastRefresh > this.refreshInterval) {
      await this.refreshCurrentAccount();
    }
    
    const spkData = this.accountData;
    const hiveData = this.hiveAccountData;
    
    return {
      username: this.currentAccount,
      lastRefresh: this.lastRefresh,
      balances: {
        // SPK Network tokens
        LARYNX: {
          liquid: formatSPKAmount(spkData.balance || 0),
          staked: formatSPKAmount(spkData.poweredUp || 0),
          delegatedIn: formatSPKAmount(spkData.granted?.t || 0),
          delegatedOut: formatSPKAmount(spkData.granting?.t || 0),
          total: formatSPKAmount(
            (spkData.balance || 0) + 
            (spkData.poweredUp || 0) + 
            (spkData.granted?.t || 0) - 
            (spkData.granting?.t || 0)
          )
        },
        SPK: {
          liquid: formatSPKAmount(spkData.spk || 0),
          pending: formatSPKAmount(spkData.spk_reward || 0),
          power: formatSPKAmount(spkData.spk_power || 0),
          total: formatSPKAmount((spkData.spk || 0) + (spkData.spk_reward || 0))
        },
        BROCA: {
          current: spkData.broca_available || 0,
          allocated: spkData.broca_allocated || 0,
          available: (spkData.broca_available || 0) - (spkData.broca_allocated || 0),
          maximum: (spkData.spk_power || 0) * 1000
        },
        // Hive tokens
        HIVE: hiveData ? {
          liquid: parseFloat(hiveData.balance || '0 HIVE'),
          staked: parseFloat(hiveData.vesting_shares || '0 VESTS') / 1000000,
          savings: parseFloat(hiveData.savings_balance || '0 HIVE')
        } : null,
        HBD: hiveData ? {
          liquid: parseFloat(hiveData.hbd_balance || '0 HBD'),
          savings: parseFloat(hiveData.savings_hbd_balance || '0 HBD')
        } : null
      },
      governance: {
        larynxPower: spkData.poweredUp || 0,
        spkPower: spkData.spk_power || 0,
        votingPower: spkData.voting_power || 10000,
        downvotePower: spkData.downvote_power || 10000,
        isValidator: spkData.validator || false,
        isRunner: spkData.runner || false
      },
      network: {
        behind: spkData.behind || 0,
        headBlock: spkData.head_block || 0,
        spkBlock: spkData.spk_block || 0
      }
    };
  }

  /**
   * Get formatted balances for display
   */
  async getFormattedBalances() {
    const state = await this.getWalletState();
    const balances = {};
    
    // Format SPK tokens
    for (const [token, data] of Object.entries(state.balances)) {
      if (data && typeof data === 'object') {
        balances[token] = {};
        for (const [key, value] of Object.entries(data)) {
          if (typeof value === 'number' || typeof value === 'string') {
            balances[token][key] = formatTokenAmount(value, token, true);
          }
        }
      }
    }
    
    return balances;
  }

  /**
   * Start auto-refresh
   */
  startAutoRefresh() {
    this.stopAutoRefresh();
    
    if (!this.currentAccount || this.refreshInterval <= 0) return;
    
    this.autoRefreshTimer = setInterval(async () => {
      try {
        await this.refreshCurrentAccount();
      } catch (error) {
        console.error('Auto-refresh failed:', error);
      }
    }, this.refreshInterval);
  }

  /**
   * Stop auto-refresh
   */
  stopAutoRefresh() {
    if (this.autoRefreshTimer) {
      clearInterval(this.autoRefreshTimer);
      this.autoRefreshTimer = null;
    }
  }

  /**
   * Set refresh interval
   */
  setRefreshInterval(interval) {
    this.refreshInterval = interval;
    if (this.currentAccount) {
      this.startAutoRefresh();
    }
  }

  /**
   * Clear global state
   */
  clearGlobalState() {
    this.stopAutoRefresh();
    this.currentAccount = null;
    this.accountData = null;
    this.hiveAccountData = null;
    this.networkStats = null;
    this.lastRefresh = 0;
    this.clearCache();
    this.emit('account-cleared');
  }

  /**
   * Check user services registration
   */
  async checkUserServices(username) {
    try {
      const response = await this.client.axios.get(`/user_services/${username}`);
      return { 
        success: true, 
        services: response.data.services || {},
        data: response.data
      };
    } catch (error) {
      console.error('Failed to check user services:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if storage node is registered
   */
  async checkStorageRegistration(username, ipfsId) {
    try {
      const result = await this.checkUserServices(username);
      if (!result.success) return result;
      
      const ipfsServices = result.services.IPFS || {};
      const isRegistered = ipfsId in ipfsServices;
      
      if (isRegistered) {
        const service = ipfsServices[ipfsId];
        return {
          success: true,
          registered: true,
          data: {
            ipfsId: service.i,
            api: service.a,
            account: service.b,
            price: service.c,
            domain: service.a ? new URL(service.a).hostname : null
          }
        };
      }
      
      return {
        success: true,
        registered: false
      };
    } catch (error) {
      console.error('Failed to check storage registration:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if validator is registered
   */
  async checkValidatorRegistration(username) {
    try {
      const result = await this.checkUserServices(username);
      if (!result.success) return result;
      
      const valServices = result.services.VAL || {};
      const validators = Object.keys(valServices);
      
      if (validators.length > 0) {
        return {
          success: true,
          registered: true,
          validators: validators.map(key => ({
            id: key,
            ...valServices[key]
          }))
        };
      }
      
      return {
        success: true,
        registered: false
      };
    } catch (error) {
      console.error('Failed to check validator registration:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if broker/market is registered
   */
  async checkMarketRegistration(username) {
    try {
      const result = await this.checkUserServices(username);
      if (!result.success) return result;
      
      const marketServices = result.services.MARKET || {};
      const markets = Object.keys(marketServices);
      
      if (markets.length > 0) {
        return {
          success: true,
          registered: true,
          markets: markets.map(key => ({
            id: key,
            ...marketServices[key]
          }))
        };
      }
      
      return {
        success: true,
        registered: false
      };
    } catch (error) {
      console.error('Failed to check market registration:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Destroy manager
   */
  destroy() {
    this.stopAutoRefresh();
    this.clearGlobalState();
    this.removeAllListeners();
  }
}

module.exports = AccountManager;