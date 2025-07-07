import { broca_calc, Base64toNumber } from '../../../src/wallet/calculations';

describe('Wallet Calculations', () => {
  describe('Base64toNumber', () => {
    it('should convert base64 string to number', () => {
      expect(Base64toNumber('0')).toBe(0);
      expect(Base64toNumber('1')).toBe(1);
      expect(Base64toNumber('A')).toBe(10);
      expect(Base64toNumber('=')).toBe(63);
      expect(Base64toNumber('10')).toBe(64); // 1*64 + 0
      // A=10, B=11, C=12 in the glyph string
      // ABC = 10*64^2 + 11*64 + 12 = 10*4096 + 11*64 + 12 = 40960 + 704 + 12 = 41676
      expect(Base64toNumber('ABC')).toBe(41676);
    });

    it('should handle empty string', () => {
      expect(Base64toNumber('')).toBe(0);
    });
  });

  describe('broca_calc', () => {
    it('should return 0 when broca_power is 0', () => {
      expect(broca_calc('1000,5000', 144000, 0, 10000)).toBe(0);
    });

    it('should return 0 when broca_power is falsy', () => {
      expect(broca_calc('1000,5000', 144000, null as any, 10000)).toBe(0);
      expect(broca_calc('1000,5000', 144000, undefined as any, 10000)).toBe(0);
    });

    it('should calculate broca with no block progression', () => {
      const lastBroca = '50000,0'; // 50000 broca at block 0
      const brocaPower = 100; // 100 BROCA power = 100,000 max credits
      const currentBlock = 0; // Same block, no progression
      
      const result = broca_calc(lastBroca, 144000, brocaPower, currentBlock);
      expect(result).toBe(50000); // No regeneration
    });

    it('should calculate broca regeneration over time', () => {
      const lastBroca = '50000,0'; // 50000 broca at block 0
      const brocaPower = 100; // 100 BROCA power = 100,000 max credits
      const currentBlock = 1440; // 1440 blocks passed
      const refillRate = 144000; // Full refill in 144000 blocks
      
      // Expected: 50000 + parseInt(144000 * 1440 / (100 * 1000)) = 50000 + parseInt(2073.6) = 50000 + 2073
      const result = broca_calc(lastBroca, refillRate, brocaPower, currentBlock);
      expect(result).toBe(52073);
    });

    it('should cap broca at max capacity', () => {
      const lastBroca = '90000,0'; // 90000 broca at block 0
      const brocaPower = 100; // 100 BROCA power = 100,000 max credits
      const currentBlock = 144000; // Full refill period
      
      const result = broca_calc(lastBroca, 144000, brocaPower, currentBlock);
      expect(result).toBe(100000); // Capped at brocaPower * 1000
    });

    it('should handle malformed broca string', () => {
      const brocaPower = 100;
      const currentBlock = 1000;
      
      // Missing comma
      expect(broca_calc('50000', 144000, brocaPower, currentBlock)).toBeGreaterThan(0);
      
      // Invalid format
      expect(broca_calc('invalid', 144000, brocaPower, currentBlock)).toBeGreaterThan(0);
      
      // Empty string
      expect(broca_calc('', 144000, brocaPower, currentBlock)).toBeGreaterThan(0);
    });

    it('should handle default parameters', () => {
      // With minimal params
      const result = broca_calc('0,0', 144000, 100, 1440);
      expect(result).toBe(2073); // Calculated from 0
    });

    it('should calculate correct regeneration for real scenario', () => {
      // Real world example: 5006 BROCA power, partial depletion
      const lastBroca = '4525181,5pdHd'; // From actual API response
      const brocaPower = 5006; // pow_broca from API
      const lastBlock = Base64toNumber('5pdHd'); // Decode block number
      const currentBlock = lastBlock + 1000; // 1000 blocks later
      
      const result = broca_calc(lastBroca, 144000, brocaPower, currentBlock);
      
      // Should regenerate: 144000 * 1000 / (5006 * 1000) = 28.76... = 28
      expect(result).toBe(4525181 + 28);
    });

    it('should handle full depletion and regeneration', () => {
      const lastBroca = '0,0'; // Fully depleted
      const brocaPower = 1000; // 1000 BROCA power = 1,000,000 max
      const currentBlock = 72000; // Half refill period
      
      // Expected: 0 + parseInt(144000 * 72000 / (1000 * 1000)) = parseInt(10368) = 10368
      const result = broca_calc(lastBroca, 144000, brocaPower, currentBlock);
      expect(result).toBe(10368);
    });

    it('should use integer math for regeneration', () => {
      const lastBroca = '0,0';
      const brocaPower = 3; // Small power to test rounding
      const currentBlock = 100; // Small block difference
      
      // parseInt(144000 * 100 / (3 * 1000)) = parseInt(14400000 / 3000) = parseInt(4800) = 4800
      const result = broca_calc(lastBroca, 144000, brocaPower, currentBlock);
      expect(result).toBe(3000); // Capped at broca_power * 1000
    });
  });
});