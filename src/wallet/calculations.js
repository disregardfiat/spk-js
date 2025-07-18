/**
 * SPK Network wallet calculation methods
 * Ported from dlux-iov for SPK and Hive calculations only
 */

/**
 * Convert Base64 string to number
 * @param {string} chars - Base64 encoded string
 * @returns {number} - Decoded number
 */
function Base64toNumber(chars) {
  const glyphs = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz+=";
  let result = 0;
  chars = chars.split("");
  for (let e = 0; e < chars.length; e++) {
    result = result * 64 + glyphs.indexOf(chars[e]);
  }
  return result;
}

/**
 * Calculate available BROCA credits
 * @param {string} last - Last BROCA state in format "amount,blocknum"
 * @param {number} broca_refill - BROCA refill rate (default: 144000)
 * @param {number} broca_power - User's BROCA power in milliunits
 * @param {number} head_block - Current head block number
 * @returns {number} - Available BROCA credits
 */
function broca_calc(last = '0,0', broca_refill = 144000, broca_power = 0, head_block = 0) {
  if (!broca_power) return 0;
  
  const parts = last.split(',');
  const lastAmount = parseInt(parts[0]) || 0;
  const lastBlock = Base64toNumber(parts[1] || '0');
  
  const blocksPassed = head_block - lastBlock;
  const accured = parseInt(parseFloat(broca_refill) * blocksPassed / (broca_power * 1000));
  
  let total = lastAmount + accured;
  if (total > broca_power * 1000) {
    total = broca_power * 1000;
  }
  
  return total;
}

/**
 * Format number with commas and decimals
 * @param {number|string} num - Number to format
 * @param {number} decimals - Number of decimal places
 * @param {string} dec_point - Decimal point character
 * @param {string} thousands_sep - Thousands separator
 * @returns {string} - Formatted number
 */
function formatNumber(num, decimals = 3, dec_point = '.', thousands_sep = ',') {
  const n = parseFloat(num);
  if (isNaN(n)) return '0';
  
  const fixed = n.toFixed(decimals);
  const parts = fixed.split('.');
  
  // Add thousands separators
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, thousands_sep);
  
  return parts.join(dec_point);
}

/**
 * Convert SPK/LARYNX amounts from milliunits to display units
 * @param {number} milliunits - Amount in milliunits
 * @param {number} precision - Decimal precision (default: 3)
 * @returns {string} - Formatted amount
 */
function formatSPKAmount(milliunits, precision = 3) {
  const amount = milliunits / 1000;
  return amount.toFixed(precision);
}

/**
 * Get Hive account data
 * @param {string} username - Hive username
 * @param {string} hiveApi - Hive API endpoint
 * @returns {Promise<Object>} - Hive account data
 */
async function getHiveAccount(username, hiveApi = 'https://api.hive.blog') {
  const response = await fetch(hiveApi, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'condenser_api.get_accounts',
      params: [[username]],
      id: 1
    })
  });
  
  const data = await response.json();
  if (data.result && data.result.length > 0) {
    return data.result[0];
  }
  
  throw new Error('Account not found');
}

/**
 * Parse Hive balance string to number
 * @param {string} balance - Balance string like "100.000 HIVE"
 * @returns {number} - Numeric balance
 */
function parseHiveBalance(balance) {
  if (!balance || typeof balance !== 'string') return 0;
  return parseFloat(balance.split(' ')[0]) || 0;
}

// Export all functions for CommonJS
module.exports = {
  Base64toNumber,
  broca_calc,
  formatNumber,
  formatSPKAmount,
  getHiveAccount,
  parseHiveBalance
};