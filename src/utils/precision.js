/**
 * Precision handling utilities for SPK and Hive token calculations
 * Ensures accurate decimal handling and formatting
 */

/**
 * Token precision configuration
 */
const TOKEN_PRECISION = {
  SPK: 3,      // SPK uses 3 decimal places
  LARYNX: 3,   // LARYNX uses 3 decimal places
  HIVE: 3,     // HIVE uses 3 decimal places
  HBD: 3,      // HBD uses 3 decimal places
  BROCA: 0     // BROCA uses no decimal places
};

/**
 * Convert token amount to milliunits (smallest unit)
 * @param {number|string} amount - Amount in display units
 * @param {string} token - Token type (SPK, LARYNX, HIVE, etc.)
 * @returns {number} - Amount in milliunits
 */
function toMilliunits(amount, token = 'SPK') {
  const precision = TOKEN_PRECISION[token] || 3;
  const multiplier = Math.pow(10, precision);
  return Math.round(parseFloat(amount) * multiplier);
}

/**
 * Convert milliunits to display amount
 * @param {number} milliunits - Amount in milliunits
 * @param {string} token - Token type
 * @returns {number} - Amount in display units
 */
function fromMilliunits(milliunits, token = 'SPK') {
  const precision = TOKEN_PRECISION[token] || 3;
  const divisor = Math.pow(10, precision);
  return milliunits / divisor;
}

/**
 * Format token amount for display
 * @param {number|string} amount - Amount to format
 * @param {string} token - Token type
 * @param {boolean} includeSymbol - Whether to include token symbol
 * @returns {string} - Formatted amount
 */
function formatTokenAmount(amount, token = 'SPK', includeSymbol = true) {
  const precision = TOKEN_PRECISION[token] || 3;
  const numAmount = parseFloat(amount);
  
  if (isNaN(numAmount)) return '0.000';
  
  const formatted = numAmount.toFixed(precision);
  return includeSymbol ? `${formatted} ${token}` : formatted;
}

/**
 * Add two token amounts with proper precision
 * @param {number|string} a - First amount
 * @param {number|string} b - Second amount
 * @param {string} token - Token type
 * @returns {number} - Sum in display units
 */
function addTokenAmounts(a, b, token = 'SPK') {
  const aMillis = toMilliunits(a, token);
  const bMillis = toMilliunits(b, token);
  return fromMilliunits(aMillis + bMillis, token);
}

/**
 * Subtract two token amounts with proper precision
 * @param {number|string} a - First amount
 * @param {number|string} b - Second amount
 * @param {string} token - Token type
 * @returns {number} - Difference in display units
 */
function subtractTokenAmounts(a, b, token = 'SPK') {
  const aMillis = toMilliunits(a, token);
  const bMillis = toMilliunits(b, token);
  return fromMilliunits(aMillis - bMillis, token);
}

/**
 * Calculate percentage with proper precision
 * @param {number} part - Part value
 * @param {number} whole - Whole value
 * @param {number} decimals - Number of decimal places
 * @returns {string} - Formatted percentage
 */
function calculatePercentage(part, whole, decimals = 2) {
  if (!whole || whole === 0) return '0.00';
  const percentage = (part / whole) * 100;
  return percentage.toFixed(decimals);
}

/**
 * Parse Hive-style balance string
 * @param {string} balanceStr - Balance string like "100.000 HIVE"
 * @returns {Object} - { amount: number, symbol: string }
 */
function parseBalanceString(balanceStr) {
  if (!balanceStr || typeof balanceStr !== 'string') {
    return { amount: 0, symbol: '' };
  }
  
  const parts = balanceStr.trim().split(' ');
  return {
    amount: parseFloat(parts[0]) || 0,
    symbol: parts[1] || ''
  };
}

/**
 * Create balance string in Hive format
 * @param {number} amount - Amount value
 * @param {string} symbol - Token symbol
 * @returns {string} - Formatted balance string
 */
function createBalanceString(amount, symbol) {
  const precision = TOKEN_PRECISION[symbol] || 3;
  return `${parseFloat(amount).toFixed(precision)} ${symbol}`;
}

/**
 * Compare two amounts with precision tolerance
 * @param {number|string} a - First amount
 * @param {number|string} b - Second amount
 * @param {string} token - Token type
 * @returns {number} - -1 if a < b, 0 if equal, 1 if a > b
 */
function compareAmounts(a, b, token = 'SPK') {
  const aMillis = toMilliunits(a, token);
  const bMillis = toMilliunits(b, token);
  
  if (aMillis < bMillis) return -1;
  if (aMillis > bMillis) return 1;
  return 0;
}

/**
 * Validate token amount
 * @param {any} amount - Amount to validate
 * @param {Object} options - Validation options
 * @returns {Object} - { valid: boolean, error?: string }
 */
function validateAmount(amount, options = {}) {
  const {
    token = 'SPK',
    min = 0,
    max = Infinity,
    allowZero = false
  } = options;
  
  // Check if amount is a valid number
  const numAmount = parseFloat(amount);
  if (isNaN(numAmount)) {
    return { valid: false, error: 'Invalid number format' };
  }
  
  // Check zero
  if (!allowZero && numAmount === 0) {
    return { valid: false, error: 'Amount cannot be zero' };
  }
  
  // Check negative
  if (numAmount < 0) {
    return { valid: false, error: 'Amount cannot be negative' };
  }
  
  // Check min/max
  if (numAmount < min) {
    return { valid: false, error: `Amount must be at least ${min}` };
  }
  
  if (numAmount > max) {
    return { valid: false, error: `Amount cannot exceed ${max}` };
  }
  
  // Check precision
  const precision = TOKEN_PRECISION[token] || 3;
  const decimalPlaces = (amount.toString().split('.')[1] || '').length;
  if (decimalPlaces > precision) {
    return { valid: false, error: `Maximum ${precision} decimal places allowed` };
  }
  
  return { valid: true };
}

/**
 * Round amount to token precision
 * @param {number} amount - Amount to round
 * @param {string} token - Token type
 * @param {string} mode - Rounding mode: 'round', 'floor', 'ceil'
 * @returns {number} - Rounded amount
 */
function roundToPrecision(amount, token = 'SPK', mode = 'round') {
  const precision = TOKEN_PRECISION[token] || 3;
  const multiplier = Math.pow(10, precision);
  
  let rounded;
  switch (mode) {
    case 'floor':
      rounded = Math.floor(amount * multiplier) / multiplier;
      break;
    case 'ceil':
      rounded = Math.ceil(amount * multiplier) / multiplier;
      break;
    default:
      rounded = Math.round(amount * multiplier) / multiplier;
  }
  
  return rounded;
}

/**
 * Calculate total value from multiple balances
 * @param {Object} balances - Object with token balances
 * @param {Object} prices - Object with token prices in reference currency
 * @returns {number} - Total value
 */
function calculateTotalValue(balances, prices) {
  let total = 0;
  
  for (const [token, balance] of Object.entries(balances)) {
    const price = prices[token] || 0;
    total += parseFloat(balance) * price;
  }
  
  return total;
}

// Export all functions for CommonJS
module.exports = {
  TOKEN_PRECISION,
  toMilliunits,
  fromMilliunits,
  formatTokenAmount,
  addTokenAmounts,
  subtractTokenAmounts,
  calculatePercentage,
  parseBalanceString,
  createBalanceString,
  compareAmounts,
  validateAmount,
  roundToPrecision,
  calculateTotalValue
};