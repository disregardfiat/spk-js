/**
 * BROCA token calculator for SPK Network storage
 */
export class BrocaCalculator {
  static readonly DAILY_RATE = 0.001; // BROCA per byte per day
  static readonly REGEN_RATE = 0.0001; // Per SPK power per block

  /**
   * Calculate BROCA cost for file storage
   */
  static cost(fileSize: number, days: number): number {
    return Math.ceil(fileSize * days * this.DAILY_RATE);
  }

  /**
   * Calculate available BROCA with regeneration
   */
  static available(account: {
    broca?: string;
    spk_power?: number;
    head_block?: number;
  }): number {
    if (!account.broca || typeof account.broca !== 'string') return 0;

    try {
      const parts = account.broca.split(',');
      const current = parseInt(parts[0]) || 0;
      const lastBlock = parseInt(parts[1]) || 0;
      const spkPower = account.spk_power || 0;
      const headBlock = account.head_block || lastBlock;

      const blocksPassed = headBlock - lastBlock;
      const regenerated = Math.floor(spkPower * this.REGEN_RATE * blocksPassed);

      return Math.min(current + regenerated, spkPower);
    } catch {
      return 0;
    }
  }

  /**
   * Calculate blocks until BROCA is fully regenerated
   */
  static blocksUntilFull(account: {
    broca?: string;
    spk_power?: number;
    head_block?: number;
  }): number {
    const current = this.available(account);
    const max = account.spk_power || 0;

    if (max === 0) return Infinity;
    if (current >= max) return 0;

    const needed = max - current;
    const regenPerBlock = max * this.REGEN_RATE;

    return Math.ceil(needed / regenPerBlock);
  }

  /**
   * Calculate blocks until enough BROCA available
   */
  static blocksUntilAvailable(
    account: {
      broca?: string;
      spk_power?: number;
      head_block?: number;
    },
    targetAmount: number
  ): number {
    const current = this.available(account);
    const max = account.spk_power || 0;

    if (current >= targetAmount) return 0;
    if (targetAmount > max) return Infinity;

    const needed = targetAmount - current;
    const regenPerBlock = max * this.REGEN_RATE;

    return Math.ceil(needed / regenPerBlock);
  }

  /**
   * Calculate storage efficiency (bytes per BROCA)
   */
  static efficiency(bytesStored: number, brocaSpent: number): number {
    if (brocaSpent === 0) return Infinity;
    return bytesStored / brocaSpent;
  }

  /**
   * Estimate storage capacity for available BROCA
   */
  static estimateStorage(availableBroca: number, days: number): number {
    if (days === 0) return 0;
    return Math.floor(availableBroca / (days * this.DAILY_RATE));
  }
}