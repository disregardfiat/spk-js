import { BrocaCalculator } from '../../../src/tokens/broca';

describe('BrocaCalculator', () => {
  describe('cost', () => {
    it('should calculate BROCA cost for file storage', () => {
      // 1MB for 30 days
      const cost = BrocaCalculator.cost(1048576, 30);
      expect(cost).toBe(31458); // Math.ceil(1048576 * 30 * 0.001)
    });

    it('should round up fractional costs', () => {
      // Small file that would have fractional cost
      const cost = BrocaCalculator.cost(100, 1);
      expect(cost).toBe(1); // 0.1 rounded up to 1
    });

    it('should handle zero size', () => {
      const cost = BrocaCalculator.cost(0, 30);
      expect(cost).toBe(0);
    });

    it('should handle zero duration', () => {
      const cost = BrocaCalculator.cost(1000000, 0);
      expect(cost).toBe(0);
    });

    it('should scale linearly with size and duration', () => {
      const cost1 = BrocaCalculator.cost(1000, 10);
      const cost2 = BrocaCalculator.cost(2000, 20);
      expect(cost2).toBe(cost1 * 4);
    });
  });

  describe('available', () => {
    it('should calculate available BROCA with regeneration', () => {
      const account = {
        broca: '100000,5000', // current,block
        spk_power: 1000000, // 1M SPK power
        head_block: 6000
      };

      const available = BrocaCalculator.available(account);
      // 100000 + (1000000 * 0.0001 * (6000 - 5000)) = 100000 + 100000 = 200000
      expect(available).toBe(200000);
    });

    it('should cap at SPK power', () => {
      const account = {
        broca: '900000,1000',
        spk_power: 1000000,
        head_block: 10000 // Large block difference
      };

      const available = BrocaCalculator.available(account);
      expect(available).toBe(1000000); // Capped at spk_power
    });

    it('should handle missing broca field', () => {
      const account = {
        spk_power: 1000000,
        head_block: 5000
      };

      const available = BrocaCalculator.available(account);
      expect(available).toBe(0);
    });

    it('should handle malformed broca string', () => {
      const account = {
        broca: 'invalid',
        spk_power: 1000000,
        head_block: 5000
      };

      const available = BrocaCalculator.available(account);
      expect(available).toBe(500000); // parseInt('invalid') = NaN becomes 0, so regenerates from block 0
    });

    it('should handle no block progression', () => {
      const account = {
        broca: '50000,5000',
        spk_power: 1000000,
        head_block: 5000 // Same block
      };

      const available = BrocaCalculator.available(account);
      expect(available).toBe(50000); // No regeneration
    });
  });

  describe('regenerationRate', () => {
    it('should calculate blocks until full regeneration', () => {
      const account = {
        broca: '100000,5000',
        spk_power: 1000000,
        head_block: 5000
      };

      const blocks = BrocaCalculator.blocksUntilFull(account);
      // (1000000 - 100000) / (1000000 * 0.0001) = 900000 / 100 = 9000
      expect(blocks).toBe(9000);
    });

    it('should return 0 if already full', () => {
      const account = {
        broca: '1000000,5000',
        spk_power: 1000000,
        head_block: 5000
      };

      const blocks = BrocaCalculator.blocksUntilFull(account);
      expect(blocks).toBe(0);
    });

    it('should handle no SPK power', () => {
      const account = {
        broca: '0,5000',
        spk_power: 0,
        head_block: 5000
      };

      const blocks = BrocaCalculator.blocksUntilFull(account);
      expect(blocks).toBe(Infinity);
    });
  });

  describe('timeUntilAvailable', () => {
    it('should calculate time until enough BROCA available', () => {
      const account = {
        broca: '10000,5000',
        spk_power: 1000000,
        head_block: 5000
      };

      const targetAmount = 50000;
      const blocks = BrocaCalculator.blocksUntilAvailable(account, targetAmount);
      // Need 40000 more BROCA
      // 40000 / (1000000 * 0.0001) = 40000 / 100 = 400 blocks
      expect(blocks).toBe(400);
    });

    it('should return 0 if already available', () => {
      const account = {
        broca: '100000,5000',
        spk_power: 1000000,
        head_block: 5000
      };

      const blocks = BrocaCalculator.blocksUntilAvailable(account, 50000);
      expect(blocks).toBe(0);
    });

    it('should handle target greater than max capacity', () => {
      const account = {
        broca: '0,5000',
        spk_power: 1000,
        head_block: 5000
      };

      const blocks = BrocaCalculator.blocksUntilAvailable(account, 2000);
      expect(blocks).toBe(Infinity); // Can never reach target
    });
  });

  describe('efficiency', () => {
    it('should calculate storage efficiency', () => {
      const filesStored = 10 * 1024 * 1024; // 10MB
      const brocaSpent = 300000; // 10MB * 30 days * 0.001

      const efficiency = BrocaCalculator.efficiency(filesStored, brocaSpent);
      expect(efficiency).toBeCloseTo(34.95, 2); // bytes per BROCA
    });

    it('should handle zero BROCA spent', () => {
      const efficiency = BrocaCalculator.efficiency(1000000, 0);
      expect(efficiency).toBe(Infinity);
    });

    it('should handle zero files stored', () => {
      const efficiency = BrocaCalculator.efficiency(0, 1000);
      expect(efficiency).toBe(0);
    });
  });

  describe('estimateStorage', () => {
    it('should estimate storage capacity', () => {
      const availableBroca = 100000;
      const days = 30;

      const capacity = BrocaCalculator.estimateStorage(availableBroca, days);
      // 100000 / (30 * 0.001) = 100000 / 0.03 = 3,333,333 bytes
      expect(capacity).toBe(3333333);
    });

    it('should handle single day storage', () => {
      const capacity = BrocaCalculator.estimateStorage(1000, 1);
      expect(capacity).toBe(1000000); // 1000 / 0.001
    });

    it('should handle zero BROCA', () => {
      const capacity = BrocaCalculator.estimateStorage(0, 30);
      expect(capacity).toBe(0);
    });
  });
});