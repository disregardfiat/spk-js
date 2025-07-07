const { EventEmitter } = require('events');
const { broca_calc, Base64toNumber } = require('../../wallet/calculations');

/**
 * BROCA Calculator for SPK Network
 * Handles computation credit calculations and management
 */
class BrocaCalculator extends EventEmitter {
  constructor(apiClient) {
    super();
    this.client = apiClient;
    this.networkParams = null;
    this.lastUpdate = 0;
    this.updateInterval = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Get current network parameters
   */
  async getNetworkParams(force = false) {
    if (!force && this.networkParams && Date.now() - this.lastUpdate < this.updateInterval) {
      return this.networkParams;
    }

    try {
      const stats = await this.client.getStats();
      this.networkParams = {
        brocaPerByte: stats.broca_per_byte || 0.001,
        brocaPerCompute: stats.broca_per_compute || 0.1,
        brocaPerDay: stats.broca_per_day || 1,
        brocaRegen: stats.broca_regen || 0.0001, // per second
        maxBroca: stats.max_broca || 100000,
        networkLoad: stats.network_load || 0.5
      };
      this.lastUpdate = Date.now();
      return this.networkParams;
    } catch (error) {
      this.emit('error', { method: 'getNetworkParams', error });
      throw error;
    }
  }

  /**
   * Calculate storage cost in BROCA
   */
  async calculateStorageCost(sizeInBytes, durationInSeconds, redundancy = 3) {
    const params = await this.getNetworkParams();
    
    // Base storage cost
    const storageCost = sizeInBytes * params.brocaPerByte * (durationInSeconds / 86400) * redundancy;
    
    // Apply network load multiplier
    const loadMultiplier = 1 + (params.networkLoad * 0.5); // Up to 50% increase based on load
    const adjustedCost = storageCost * loadMultiplier;
    
    return {
      baseCost: Math.ceil(storageCost),
      adjustedCost: Math.ceil(adjustedCost),
      networkLoad: params.networkLoad,
      costPerMB: params.brocaPerByte * 1024 * 1024,
      costPerDay: params.brocaPerDay,
      redundancy
    };
  }

  /**
   * Calculate computation cost in BROCA
   */
  async calculateComputeCost(computeUnits) {
    const params = await this.getNetworkParams();
    
    const baseCost = computeUnits * params.brocaPerCompute;
    const loadMultiplier = 1 + (params.networkLoad * 0.5);
    const adjustedCost = baseCost * loadMultiplier;
    
    return {
      baseCost: Math.ceil(baseCost),
      adjustedCost: Math.ceil(adjustedCost),
      networkLoad: params.networkLoad,
      costPerUnit: params.brocaPerCompute
    };
  }

  /**
   * Calculate video transcoding cost
   */
  async calculateTranscodingCost(durationInSeconds, resolutions = ['1080p', '720p', '480p']) {
    const params = await this.getNetworkParams();
    
    // Compute units per second of video per resolution
    const computePerSecond = {
      '2160p': 100,  // 4K
      '1080p': 50,   // Full HD
      '720p': 25,    // HD
      '480p': 10,    // SD
      '360p': 5      // Low
    };
    
    let totalCompute = 0;
    const breakdown = {};
    
    for (const resolution of resolutions) {
      const compute = (computePerSecond[resolution] || 10) * durationInSeconds;
      totalCompute += compute;
      breakdown[resolution] = compute;
    }
    
    const computeCost = await this.calculateComputeCost(totalCompute);
    
    return {
      totalCost: computeCost.adjustedCost,
      breakdown,
      totalComputeUnits: totalCompute,
      durationInSeconds,
      resolutions,
      costPerSecond: computeCost.adjustedCost / durationInSeconds
    };
  }

  /**
   * Calculate IPFS pinning cost
   */
  async calculatePinningCost(sizeInBytes, durationInDays = 30) {
    const durationInSeconds = durationInDays * 24 * 60 * 60;
    return this.calculateStorageCost(sizeInBytes, durationInSeconds, 1); // Single copy for pinning
  }

  /**
   * Calculate upload bandwidth cost
   */
  async calculateUploadCost(sizeInBytes) {
    const params = await this.getNetworkParams();
    
    // Upload costs are typically lower than storage
    const uploadCost = sizeInBytes * params.brocaPerByte * 0.1; // 10% of storage cost
    
    return {
      cost: Math.ceil(uploadCost),
      sizeInMB: sizeInBytes / (1024 * 1024),
      costPerMB: params.brocaPerByte * 1024 * 1024 * 0.1
    };
  }

  /**
   * Calculate download bandwidth cost
   */
  async calculateDownloadCost(sizeInBytes) {
    const params = await this.getNetworkParams();
    
    // Download costs vary based on network load
    const baseCost = sizeInBytes * params.brocaPerByte * 0.05; // 5% of storage cost
    const loadMultiplier = 1 + params.networkLoad;
    const adjustedCost = baseCost * loadMultiplier;
    
    return {
      baseCost: Math.ceil(baseCost),
      adjustedCost: Math.ceil(adjustedCost),
      networkLoad: params.networkLoad,
      sizeInMB: sizeInBytes / (1024 * 1024),
      costPerMB: params.brocaPerByte * 1024 * 1024 * 0.05 * loadMultiplier
    };
  }

  /**
   * Calculate BROCA regeneration
   */
  calculateRegeneration(currentBroca, maxBroca, elapsedSeconds) {
    const params = this.networkParams || {
      brocaRegen: 0.0001,
      maxBroca: 100000
    };
    
    const regenerated = elapsedSeconds * params.brocaRegen;
    const newBroca = Math.min(currentBroca + regenerated, maxBroca || params.maxBroca);
    
    return {
      regenerated: regenerated,
      newBroca: newBroca,
      regenPerHour: params.brocaRegen * 3600,
      timeToFull: maxBroca ? ((maxBroca - currentBroca) / params.brocaRegen) : 0
    };
  }

  /**
   * Estimate time until sufficient BROCA
   */
  estimateTimeToSufficientBroca(currentBroca, requiredBroca, maxBroca) {
    if (currentBroca >= requiredBroca) {
      return {
        sufficient: true,
        timeInSeconds: 0,
        timeFormatted: 'Now'
      };
    }
    
    const params = this.networkParams || { brocaRegen: 0.0001 };
    const needed = requiredBroca - currentBroca;
    const timeInSeconds = needed / params.brocaRegen;
    
    // Check if it's possible to reach required amount
    if (maxBroca && requiredBroca > maxBroca) {
      return {
        sufficient: false,
        timeInSeconds: Infinity,
        timeFormatted: 'Never (exceeds maximum)',
        maxBroca
      };
    }
    
    return {
      sufficient: false,
      timeInSeconds,
      timeFormatted: this.formatTime(timeInSeconds),
      currentBroca,
      requiredBroca,
      deficit: needed
    };
  }

  /**
   * Format time duration
   */
  formatTime(seconds) {
    if (seconds === Infinity) return 'Never';
    if (seconds < 60) return `${Math.round(seconds)} seconds`;
    if (seconds < 3600) return `${Math.round(seconds / 60)} minutes`;
    if (seconds < 86400) return `${Math.round(seconds / 3600)} hours`;
    return `${Math.round(seconds / 86400)} days`;
  }

  /**
   * Get account BROCA status
   */
  async getAccountBrocaStatus(username) {
    try {
      const account = await this.client.getAccount(username);
      const params = await this.getNetworkParams();
      
      // Use the proper broca_calc method from dlux-iov
      const brocaString = account.broca || '0,0';
      const spkPower = account.spk_power || 0;
      const headBlock = account.head_block || 0;
      const brocaRefill = params.broca_refill || 144000;
      
      // Calculate current BROCA using the dlux-iov method
      const currentBroca = broca_calc(brocaString, brocaRefill, spkPower, headBlock);
      const maxBroca = spkPower * 1000; // Max BROCA is spk_power * 1000
      
      const allocated = parseFloat(account.broca_allocated || 0);
      const available = currentBroca - allocated;
      
      // Calculate time since last update
      const lastBlockStr = brocaString.split(',')[1] || '0';
      const lastBlock = Base64toNumber(lastBlockStr);
      const blocksSinceUpdate = headBlock - lastBlock;
      const secondsSinceUpdate = blocksSinceUpdate * 3; // 3 seconds per block
      
      // Calculate regeneration rate
      const regenPerBlock = brocaRefill / (spkPower * 1000);
      const regenPerSecond = regenPerBlock / 3;
      const regenPerHour = regenPerSecond * 3600;
      
      // Time to full
      const brocaDeficit = maxBroca - currentBroca;
      const blocksToFull = brocaDeficit / regenPerBlock;
      const timeToFull = blocksToFull * 3; // seconds
      
      return {
        current: currentBroca,
        allocated: allocated,
        available: available,
        maximum: maxBroca,
        percentage: (currentBroca / maxBroca) * 100,
        regenerating: regenPerSecond * secondsSinceUpdate,
        regenPerHour: regenPerHour,
        timeToFull: timeToFull,
        lastBlock: lastBlock,
        headBlock: headBlock,
        brocaString: brocaString
      };
    } catch (error) {
      this.emit('error', { method: 'getAccountBrocaStatus', error });
      throw error;
    }
  }

  /**
   * Estimate operation feasibility
   */
  async canPerformOperation(username, operation) {
    try {
      const status = await this.getAccountBrocaStatus(username);
      
      let requiredBroca = 0;
      let operationType = '';
      
      // Determine required BROCA based on operation
      if (operation.type === 'storage') {
        const cost = await this.calculateStorageCost(
          operation.size,
          operation.duration,
          operation.redundancy
        );
        requiredBroca = cost.adjustedCost;
        operationType = 'Storage';
      } else if (operation.type === 'transcode') {
        const cost = await this.calculateTranscodingCost(
          operation.duration,
          operation.resolutions
        );
        requiredBroca = cost.totalCost;
        operationType = 'Transcoding';
      } else if (operation.type === 'upload') {
        const cost = await this.calculateUploadCost(operation.size);
        requiredBroca = cost.cost;
        operationType = 'Upload';
      }
      
      const canPerform = status.available >= requiredBroca;
      const timeEstimate = this.estimateTimeToSufficientBroca(
        status.available,
        requiredBroca,
        status.maximum
      );
      
      return {
        canPerform,
        operationType,
        requiredBroca,
        availableBroca: status.available,
        deficit: Math.max(0, requiredBroca - status.available),
        timeUntilAvailable: timeEstimate.timeFormatted,
        recommendation: canPerform ? 
          'Operation can be performed immediately' : 
          `Wait ${timeEstimate.timeFormatted} for sufficient BROCA`
      };
    } catch (error) {
      this.emit('error', { method: 'canPerformOperation', error });
      throw error;
    }
  }

  /**
   * Clear cached network parameters
   */
  clearCache() {
    this.networkParams = null;
    this.lastUpdate = 0;
  }
}

module.exports = BrocaCalculator;