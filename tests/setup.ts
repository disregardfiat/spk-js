// Setup crypto mock for all tests
const mockCrypto = {
  getRandomValues: (array: any) => {
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
    return array;
  },
  subtle: {
    generateKey: jest.fn().mockImplementation(async () => ({
      type: 'secret',
      algorithm: { name: 'AES-GCM', length: 256 },
      extractable: true,
      usages: ['encrypt', 'decrypt'],
      _id: Math.random()
    })),
    encrypt: jest.fn().mockImplementation(async (_algorithm: any, _key: any, data: any) => {
      const dataBuffer = data as ArrayBuffer;
      const encrypted = new ArrayBuffer(dataBuffer.byteLength + 16);
      new Uint8Array(encrypted).set(new Uint8Array(dataBuffer));
      return encrypted;
    }),
    decrypt: jest.fn().mockImplementation(async (_algorithm: any, _key: any, data: any) => {
      const dataBuffer = data as ArrayBuffer;
      // For testing, we need to ensure we have data to return
      if (dataBuffer.byteLength <= 16) {
        return new ArrayBuffer(0);
      }
      const decrypted = new ArrayBuffer(dataBuffer.byteLength - 16);
      new Uint8Array(decrypted).set(new Uint8Array(dataBuffer).slice(0, -16));
      return decrypted;
    }),
    exportKey: jest.fn().mockImplementation(async () => {
      const key = new ArrayBuffer(32);
      new Uint8Array(key).fill(1);
      return key;
    }),
    importKey: jest.fn().mockImplementation(async () => ({
      type: 'secret',
      algorithm: { name: 'AES-GCM', length: 256 },
      extractable: true,
      usages: ['encrypt', 'decrypt']
    }))
  }
};

// Set up global crypto
(global as any).crypto = mockCrypto;

// Set up globalThis crypto (priority in crypto getter)
(globalThis as any).crypto = mockCrypto;

// Also set up window crypto for browser-like environment
if (typeof window !== 'undefined') {
  (window as any).crypto = mockCrypto;
} else {
  (global as any).window = {
    crypto: mockCrypto
  };
}

// Mock fetch globally
global.fetch = jest.fn() as any;

// Polyfill File for tests if needed
if (typeof File === 'undefined') {
  (global as any).File = class File {
    name: string;
    size: number;
    type: string;
    private content: ArrayBuffer;

    constructor(content: BlobPart[], name: string, options?: FilePropertyBag) {
      this.name = name;
      this.type = options?.type || '';
      
      // Convert content to ArrayBuffer
      if (content.length === 0) {
        this.content = new ArrayBuffer(0);
      } else {
        const first = content[0];
        if (first instanceof ArrayBuffer) {
          this.content = first;
        } else if (first instanceof Uint8Array) {
          this.content = first.buffer.slice(first.byteOffset, first.byteOffset + first.byteLength);
        } else if (typeof first === 'string') {
          const encoder = new TextEncoder();
          this.content = encoder.encode(first).buffer;
        } else {
          // Handle other array-like types
          const encoder = new TextEncoder();
          this.content = encoder.encode(String(first)).buffer;
        }
      }
      
      this.size = this.content.byteLength;
    }

    async arrayBuffer(): Promise<ArrayBuffer> {
      return this.content;
    }

    async text(): Promise<string> {
      const decoder = new TextDecoder();
      return decoder.decode(this.content);
    }
  };
}

// Add Blob polyfill too
if (typeof Blob === 'undefined') {
  (global as any).Blob = class Blob {
    size: number;
    type: string;
    private content: ArrayBuffer;

    constructor(content: BlobPart[], options?: BlobPropertyBag) {
      this.type = options?.type || '';
      
      // Convert content to ArrayBuffer
      if (content.length === 0) {
        this.content = new ArrayBuffer(0);
      } else {
        const first = content[0];
        if (first instanceof ArrayBuffer) {
          this.content = first;
        } else if (first instanceof Uint8Array) {
          this.content = first.buffer.slice(first.byteOffset, first.byteOffset + first.byteLength);
        } else if (typeof first === 'string') {
          const encoder = new TextEncoder();
          this.content = encoder.encode(first).buffer;
        } else {
          // Handle other array-like types
          const encoder = new TextEncoder();
          this.content = encoder.encode(String(first)).buffer;
        }
      }
      
      this.size = this.content.byteLength;
    }

    async arrayBuffer(): Promise<ArrayBuffer> {
      return this.content;
    }
  };
}

export {};