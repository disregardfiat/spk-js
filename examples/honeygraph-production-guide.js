/**
 * Honeygraph Production Usage Guide
 * 
 * This guide demonstrates production-ready patterns for using the Honeygraph APIs
 * including error handling, retries, rate limiting, and best practices.
 */

import SPK from '@spknetwork/spk-js';

/**
 * Production-ready wrapper for SPK with Honeygraph
 */
class SPKProduction {
  constructor(username, options = {}) {
    // Configure with production defaults
    this.spk = new SPK(username, {
      node: options.node || 'https://spktest.dlux.io',
      honeygraphUrl: options.honeygraphUrl || 'https://honeygraph.dlux.io',
      enableHoneygraphCache: true,
      honeygraphCacheTTL: 300000, // 5 minutes for production
      ...options
    });
    
    // Rate limiting configuration
    this.rateLimits = {
      userAPI: { calls: 0, resetTime: Date.now() + 60000, limit: 100 },
      searchAPI: { calls: 0, resetTime: Date.now() + 60000, limit: 50 },
      marketAPI: { calls: 0, resetTime: Date.now() + 60000, limit: 200 }
    };
    
    // Error tracking
    this.errorCounts = new Map();
    this.errorThreshold = 5; // Max errors before backing off
  }

  /**
   * Initialize with automatic retry
   */
  async init(maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.spk.init();
        console.log('✓ SPK initialized successfully');
        return;
      } catch (error) {
        console.error(`Initialization attempt ${attempt} failed:`, error.message);
        if (attempt === maxRetries) throw error;
        
        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        await this.sleep(delay);
      }
    }
  }

  /**
   * Check rate limits before API calls
   */
  checkRateLimit(api) {
    const limit = this.rateLimits[api];
    if (!limit) return true;
    
    // Reset counter if time window passed
    if (Date.now() > limit.resetTime) {
      limit.calls = 0;
      limit.resetTime = Date.now() + 60000;
    }
    
    // Check if under limit
    if (limit.calls >= limit.limit) {
      const waitTime = limit.resetTime - Date.now();
      throw new Error(`Rate limit exceeded for ${api}. Wait ${Math.ceil(waitTime / 1000)}s`);
    }
    
    limit.calls++;
    return true;
  }

  /**
   * Execute API call with retry logic and error handling
   */
  async executeWithRetry(apiCall, options = {}) {
    const {
      maxRetries = 3,
      backoffMs = 1000,
      onError = null,
      api = 'general'
    } = options;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Check rate limits
        this.checkRateLimit(api);
        
        // Execute the API call
        const result = await apiCall();
        
        // Reset error count on success
        this.errorCounts.delete(api);
        
        return result;
      } catch (error) {
        // Track errors
        const errorCount = (this.errorCounts.get(api) || 0) + 1;
        this.errorCounts.set(api, errorCount);
        
        // Log error
        console.error(`[${api}] Attempt ${attempt}/${maxRetries} failed:`, error.message);
        
        // Call error handler if provided
        if (onError) onError(error, attempt);
        
        // Don't retry on client errors (4xx)
        if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
          throw error;
        }
        
        // Check if we should back off
        if (errorCount >= this.errorThreshold) {
          const backoffTime = 60000; // 1 minute backoff
          console.warn(`Too many errors for ${api}. Backing off for ${backoffTime / 1000}s`);
          await this.sleep(backoffTime);
          this.errorCounts.set(api, 0);
        }
        
        // If last attempt, throw error
        if (attempt === maxRetries) throw error;
        
        // Calculate backoff with jitter
        const jitter = Math.random() * 0.3; // 30% jitter
        const delay = backoffMs * Math.pow(2, attempt - 1) * (1 + jitter);
        await this.sleep(Math.min(delay, 30000)); // Max 30s
      }
    }
  }

  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get user profile with caching and error handling
   */
  async getUserProfile(username) {
    return this.executeWithRetry(
      () => this.spk.getUserProfile(username),
      { api: 'userAPI' }
    );
  }

  /**
   * Search files with pagination support
   */
  async searchAllFiles(query, maxResults = 1000) {
    const results = [];
    let offset = 0;
    const limit = 100; // Max per request
    
    while (results.length < maxResults) {
      const batch = await this.executeWithRetry(
        () => this.spk.searchFiles({ 
          q: query, 
          limit, 
          offset 
        }),
        { api: 'searchAPI' }
      );
      
      if (!batch || batch.length === 0) break;
      
      results.push(...batch);
      offset += limit;
      
      // Small delay between paginated requests
      await this.sleep(100);
    }
    
    return results.slice(0, maxResults);
  }

  /**
   * Monitor market with automatic reconnection
   */
  async monitorMarket(pair, interval = 5000) {
    const monitor = async () => {
      try {
        const depth = await this.executeWithRetry(
          () => this.spk.getMarketDepth(pair, 20),
          { api: 'marketAPI' }
        );
        
        const stats = await this.executeWithRetry(
          () => this.spk.market.getMarketStats(pair),
          { api: 'marketAPI' }
        );
        
        return { depth, stats, timestamp: new Date() };
      } catch (error) {
        console.error('Market monitoring error:', error.message);
        return null;
      }
    };
    
    // Return async iterator for market updates
    return {
      [Symbol.asyncIterator]: async function* () {
        while (true) {
          const data = await monitor();
          if (data) yield data;
          await new Promise(resolve => setTimeout(resolve, interval));
        }
      }
    };
  }

  /**
   * Batch operations for efficiency
   */
  async batchGetUserProfiles(usernames) {
    const batchSize = 10; // Process 10 at a time
    const results = new Map();
    
    for (let i = 0; i < usernames.length; i += batchSize) {
      const batch = usernames.slice(i, i + batchSize);
      
      // Process batch in parallel
      const batchResults = await Promise.allSettled(
        batch.map(username => 
          this.executeWithRetry(
            () => this.spk.getUserProfile(username),
            { api: 'userAPI', maxRetries: 2 }
          )
        )
      );
      
      // Store results
      batch.forEach((username, index) => {
        const result = batchResults[index];
        if (result.status === 'fulfilled') {
          results.set(username, result.value);
        } else {
          results.set(username, { error: result.reason.message });
        }
      });
      
      // Rate limit between batches
      if (i + batchSize < usernames.length) {
        await this.sleep(1000);
      }
    }
    
    return results;
  }

  /**
   * Smart contract creation with validation
   */
  async createSmartContract(fileData, options = {}) {
    // Pre-validate file size
    if (fileData.size > 5 * 1024 * 1024 * 1024) { // 5GB limit
      throw new Error('File too large. Maximum size is 5GB');
    }
    
    // Calculate costs
    const costs = await this.executeWithRetry(
      () => this.spk.calculateBrocaCost(fileData.size, { includeContractMin: true })
    );
    
    // Check balance
    const balances = await this.executeWithRetry(
      () => this.spk.getBalances(true)
    );
    
    if (balances.broca < costs.cost) {
      throw new Error(`Insufficient BROCA. Need ${costs.cost}, have ${balances.broca}`);
    }
    
    // Find healthy providers
    const providers = await this.executeWithRetry(
      () => this.spk.getHealthyStorageProviders(fileData.size)
    );
    
    if (providers.length === 0) {
      throw new Error('No healthy storage providers available');
    }
    
    // Create contract with best provider
    const provider = providers[0]; // Could implement provider selection logic
    
    return this.executeWithRetry(
      () => this.spk.createStorageContract({
        ...fileData,
        provider: provider.account,
        ...options
      }),
      { maxRetries: 5 } // More retries for important operations
    );
  }

  /**
   * Health check for all APIs
   */
  async healthCheck() {
    const checks = {
      spkNode: false,
      honeygraph: false,
      userAPI: false,
      fileAPI: false,
      storageAPI: false,
      marketAPI: false,
      networkAPI: false,
      governanceAPI: false
    };
    
    // Check SPK Node
    try {
      await this.spk.getNetworkStats();
      checks.spkNode = true;
    } catch (error) {
      console.error('SPK Node check failed:', error.message);
    }
    
    // Check Honeygraph base
    try {
      await this.spk.honeygraph.get('/health');
      checks.honeygraph = true;
    } catch (error) {
      console.error('Honeygraph check failed:', error.message);
    }
    
    // Check each API endpoint
    const apiChecks = [
      { name: 'userAPI', test: () => this.spk.users.getUserProfile('test') },
      { name: 'fileAPI', test: () => this.spk.files.getRecentUploads(1) },
      { name: 'storageAPI', test: () => this.spk.storage.getNetworkStats() },
      { name: 'marketAPI', test: () => this.spk.market.getMarkets() },
      { name: 'networkAPI', test: () => this.spk.network.getNetworkStats() },
      { name: 'governanceAPI', test: () => this.spk.governance.getProposals('active') }
    ];
    
    for (const check of apiChecks) {
      try {
        await check.test();
        checks[check.name] = true;
      } catch (error) {
        console.error(`${check.name} check failed:`, error.message);
      }
    }
    
    return {
      healthy: Object.values(checks).every(v => v),
      services: checks,
      timestamp: new Date()
    };
  }
}

// ========== USAGE EXAMPLES ==========

async function productionExample() {
  console.log('=== SPK Production Usage Guide ===\n');
  
  // Initialize production client
  const spkProd = new SPKProduction('demo-user');
  
  try {
    await spkProd.init();
  } catch (error) {
    console.error('Failed to initialize SPK:', error.message);
    return;
  }
  
  // 1. Health Check
  console.log('1. Running health check...');
  const health = await spkProd.healthCheck();
  console.log('Health status:', health.healthy ? '✓ Healthy' : '✗ Unhealthy');
  console.log('Service status:', health.services);
  
  // 2. Get user profile with retry
  console.log('\n2. Getting user profile with automatic retry...');
  try {
    const profile = await spkProd.getUserProfile('disregardfiat');
    console.log('Profile loaded:', profile.username);
  } catch (error) {
    console.error('Failed to load profile after retries:', error.message);
  }
  
  // 3. Search with pagination
  console.log('\n3. Searching files with pagination...');
  try {
    const files = await spkProd.searchAllFiles('music', 250);
    console.log(`Found ${files.length} music files`);
  } catch (error) {
    console.error('Search failed:', error.message);
  }
  
  // 4. Batch operations
  console.log('\n4. Batch loading user profiles...');
  const usernames = ['alice', 'bob', 'charlie', 'dave', 'eve'];
  const profiles = await spkProd.batchGetUserProfiles(usernames);
  
  console.log('Batch results:');
  for (const [username, profile] of profiles) {
    if (profile.error) {
      console.log(`  ${username}: ✗ ${profile.error}`);
    } else {
      console.log(`  ${username}: ✓ ${profile.spkBalance / 1000} SPK`);
    }
  }
  
  // 5. Market monitoring (async iterator)
  console.log('\n5. Starting market monitor (5 updates)...');
  const monitor = await spkProd.monitorMarket('LARYNX:HIVE', 2000);
  
  let updates = 0;
  for await (const data of monitor) {
    console.log(`Market update ${++updates}:`, {
      spread: data.depth.spread,
      volume24h: data.stats.volume24h,
      timestamp: data.timestamp.toISOString()
    });
    
    if (updates >= 5) break;
  }
  
  // 6. Error handling example
  console.log('\n6. Demonstrating error handling...');
  try {
    // This will fail and retry
    await spkProd.executeWithRetry(
      async () => {
        throw new Error('Simulated network error');
      },
      { 
        maxRetries: 2,
        onError: (error, attempt) => {
          console.log(`  Error handler called: attempt ${attempt}`);
        }
      }
    );
  } catch (error) {
    console.log('  Final error:', error.message);
  }
  
  // 7. Rate limiting demonstration
  console.log('\n7. Testing rate limits...');
  const rapidCalls = Array(10).fill(null).map((_, i) => 
    spkProd.getUserProfile(`test${i}`).catch(e => e.message)
  );
  
  const results = await Promise.all(rapidCalls);
  const rateLimited = results.filter(r => 
    typeof r === 'string' && r.includes('Rate limit')
  );
  console.log(`Rate limited: ${rateLimited.length}/10 calls`);
  
  console.log('\n=== Production Guide Complete ===');
}

// Production monitoring utilities
class SPKMonitor {
  constructor(spkProd) {
    this.spk = spkProd;
    this.metrics = {
      apiCalls: 0,
      errors: 0,
      latencies: [],
      startTime: Date.now()
    };
  }
  
  /**
   * Wrap API calls with monitoring
   */
  async track(name, apiCall) {
    const start = Date.now();
    this.metrics.apiCalls++;
    
    try {
      const result = await apiCall();
      const latency = Date.now() - start;
      this.metrics.latencies.push({ name, latency, success: true });
      return result;
    } catch (error) {
      this.metrics.errors++;
      const latency = Date.now() - start;
      this.metrics.latencies.push({ name, latency, success: false });
      throw error;
    }
  }
  
  /**
   * Get monitoring statistics
   */
  getStats() {
    const uptime = (Date.now() - this.metrics.startTime) / 1000;
    const avgLatency = this.metrics.latencies.length > 0
      ? this.metrics.latencies.reduce((sum, l) => sum + l.latency, 0) / this.metrics.latencies.length
      : 0;
    
    return {
      uptime: `${Math.floor(uptime)}s`,
      totalCalls: this.metrics.apiCalls,
      errors: this.metrics.errors,
      errorRate: `${((this.metrics.errors / this.metrics.apiCalls) * 100).toFixed(2)}%`,
      avgLatency: `${Math.floor(avgLatency)}ms`,
      callsPerSecond: (this.metrics.apiCalls / uptime).toFixed(2)
    };
  }
}

// Export for use
export { SPKProduction, SPKMonitor };

// Run example if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  productionExample().catch(console.error);
}