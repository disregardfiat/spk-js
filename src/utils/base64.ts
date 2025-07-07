/**
 * Base64 encoding/decoding utilities for SPK Network
 */

const GLYPHS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz+=";

/**
 * Convert Base64 string to number
 */
export function Base64toNumber(chars: string): number {
  if (!chars || typeof chars !== 'string') return 0;
  
  let result = 0;
  const charArray = chars.split('');
  
  for (let i = 0; i < charArray.length; i++) {
    const index = GLYPHS.indexOf(charArray[i]);
    if (index !== -1) {
      result = result * 64 + index;
    }
  }
  
  return result;
}

/**
 * Convert number to Base64 string
 */
export function NumberToBase64(num: number): string {
  if (!num || num <= 0) return '0';
  
  let result = '';
  let value = Math.floor(num);
  
  while (value > 0) {
    const remainder = value % 64;
    result = GLYPHS[remainder] + result;
    value = Math.floor(value / 64);
  }
  
  return result || '0';
}