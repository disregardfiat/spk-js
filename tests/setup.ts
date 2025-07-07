// Add TextDecoder and TextEncoder for Node.js environment
if (typeof TextDecoder === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { TextDecoder, TextEncoder } = require('util');
  global.TextDecoder = TextDecoder;
  global.TextEncoder = TextEncoder;
}

// Mock browser APIs that are not available in jsdom
global.crypto = {
  subtle: {
    generateKey: jest.fn(),
    encrypt: jest.fn(),
    decrypt: jest.fn(),
  },
} as any;

// Mock fetch if not available
if (!global.fetch) {
  global.fetch = jest.fn();
}

// Mock AbortController if not available
if (!global.AbortController) {
  global.AbortController = class AbortController {
    signal = { aborted: false };
    abort() {
      this.signal.aborted = true;
    }
  } as any;
}

// Add custom matchers
expect.extend({
  toBeValidCID(received: string) {
    const pass = /^Qm[a-zA-Z0-9]{44}$/.test(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid CID`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid CID`,
        pass: false,
      };
    }
  },
});

// Extend Jest matchers TypeScript definitions
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      toBeValidCID(): R;
    }
  }
  
  interface Window {
    hive_keychain?: {
      // eslint-disable-next-line @typescript-eslint/ban-types
      requestSignBuffer: Function;
      // eslint-disable-next-line @typescript-eslint/ban-types
      requestCustomJson: Function;
    };
  }
}

// Import File mock
import './mocks/file';

// Export to make this a module
export {};