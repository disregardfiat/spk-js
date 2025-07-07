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

// Mock XMLHttpRequest for Node.js environment with real fetch
if (!global.XMLHttpRequest) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const FormData = require('form-data');
  
  global.XMLHttpRequest = class XMLHttpRequest {
    readyState = 0;
    status = 0;
    responseText = '';
    private headers: any = {};
    private url = '';
    private method = '';
    
    upload = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn()
    };
    
    open = jest.fn((method: string, url: string) => {
      this.method = method;
      this.url = url;
    });
    
    send = jest.fn((data: any) => {
      console.log('[XMLHttpRequest Mock] Sending to:', this.url);
      console.log('[XMLHttpRequest Mock] Headers:', this.headers);
      
      // Make the actual request asynchronously
      (async () => {
        try {
          let hasFiles = false;
          
          // If data is FormData from the browser API mock, extract the file
          if (data && data.constructor.name === 'FormData') {
            // Use the node form-data
            const nodeFormData = new FormData();
            
            // Handle our mock FormData
            if (typeof data.entries === 'function') {
              for (const [key, entry] of data.entries()) {
                const value = entry.value || entry;
                const options = entry.options || {};
                
                console.log(`[XMLHttpRequest Mock] Processing FormData entry: ${key}`, {
                  valueType: typeof value,
                  valueConstructor: value?.constructor?.name,
                  hasContent: !!(value?._content),
                  options
                });
                
                if (key === 'chunk' && value) {
                  hasFiles = true;
                  // Handle File object
                  if (value.constructor?.name === 'MockFile' || value._content) {
                    console.log('[XMLHttpRequest Mock] MockFile detected, size:', value.size);
                    console.log('[XMLHttpRequest Mock] _content type:', typeof value._content);
                    console.log('[XMLHttpRequest Mock] _content is Buffer?', Buffer.isBuffer(value._content));
                    console.log('[XMLHttpRequest Mock] _content length:', value._content.length);
                    // Use the buffer content directly
                    nodeFormData.append('chunk', value._content, { 
                      filename: options.filename || 'chunk',
                      contentType: value.type || 'application/octet-stream'
                    });
                  } else if (value.constructor?.name === 'MockBlob' || (value.constructor?.name === 'Blob' && value._content)) {
                    // Handle Blob from slice operation
                    console.log('[XMLHttpRequest Mock] MockBlob detected, size:', value.size);
                    nodeFormData.append('chunk', value._content, { 
                      filename: options.filename || 'chunk',
                      contentType: value.type || 'application/octet-stream'
                    });
                  } else if (Buffer.isBuffer(value)) {
                    console.log('[XMLHttpRequest Mock] Buffer detected, size:', value.length);
                    nodeFormData.append('chunk', value, { 
                      filename: options.filename || 'chunk',
                      contentType: options.contentType || 'application/octet-stream'
                    });
                  } else {
                    console.log('[XMLHttpRequest Mock] Unknown file type, converting to Buffer');
                    const buffer = Buffer.from(value);
                    nodeFormData.append('chunk', buffer, { 
                      filename: options.filename || 'chunk',
                      contentType: options.contentType || 'application/octet-stream'
                    });
                  }
                } else {
                  // Handle other form fields
                  nodeFormData.append(key, value, options);
                }
              }
            } else {
              // Fallback for simple get method
              const file = data.get('chunk');
              if (file) {
                console.log('[XMLHttpRequest Mock] Fallback: Found file chunk');
                if (file._content) {
                  nodeFormData.append('chunk', file._content, { filename: 'chunk' });
                } else if (Buffer.isBuffer(file)) {
                  nodeFormData.append('chunk', file, { filename: 'chunk' });
                } else {
                  nodeFormData.append('chunk', Buffer.from(file), { filename: 'chunk' });
                }
              }
            }
            
            data = nodeFormData;
          }
          
          // Make real HTTP request
          console.log('[XMLHttpRequest Mock] Sending request with form data, hasFiles:', hasFiles);
          
          // For form data, we need to make sure headers are properly set
          let finalHeaders = { ...this.headers };
          if (data && data.getHeaders) {
            // Remove any existing content-type header as form-data will set its own
            delete finalHeaders['Content-Type'];
            delete finalHeaders['content-type'];
            const formHeaders = data.getHeaders();
            console.log('[XMLHttpRequest Mock] Form headers:', formHeaders);
            finalHeaders = { ...finalHeaders, ...formHeaders };
          }
          
          // If we have files and are using node form-data, we need to get the buffer
          let body = data;
          if (hasFiles && data && data.getBuffer) {
            console.log('[XMLHttpRequest Mock] Using getBuffer() for multipart data');
            body = data.getBuffer();
          }
          
          const response = await fetch(this.url, {
            method: this.method,
            headers: finalHeaders,
            body: body
          });
          
          this.status = response.status;
          this.responseText = await response.text();
          this.readyState = 4;
          
          console.log('[XMLHttpRequest Mock] Response status:', this.status);
          console.log('[XMLHttpRequest Mock] Response text:', this.responseText);
          
          // Call the load event handler
          const loadEvent = new Event('load');
          if (this.onload) {
            (this.onload as any).call(this, loadEvent);
          }
          
          // Also call any addEventListener('load') handlers
          const loadHandlers = (this as any)._eventListeners?.load || [];
          for (const handler of loadHandlers) {
            handler.call(this, loadEvent);
          }
        } catch (error) {
          console.error('[XMLHttpRequest Mock] Error:', error);
          this.status = 0;
          this.readyState = 4;
          if (this.onerror) (this.onerror as any)(error);
        }
      })();
    });
    
    setRequestHeader = jest.fn((key: string, value: string) => {
      this.headers[key] = value;
    });
    
    private _eventListeners: any = {};
    
    addEventListener = jest.fn((event: string, handler: any) => {
      if (!this._eventListeners[event]) {
        this._eventListeners[event] = [];
      }
      this._eventListeners[event].push(handler);
    });
    
    removeEventListener = jest.fn((event: string, handler: any) => {
      if (this._eventListeners[event]) {
        const index = this._eventListeners[event].indexOf(handler);
        if (index > -1) {
          this._eventListeners[event].splice(index, 1);
        }
      }
    });
    
    abort = jest.fn();
    onload: any = null;
    onerror: any = null;
    onprogress: any = null;
  } as any;
}

// Store original FormData
const OriginalFormData = global.FormData;

// Override FormData for test environment to accept our mock Files
global.FormData = class FormData {
  private data = new Map();
  private originalFormData: any;
  
  constructor() {
    // Create an instance of the original FormData for fallback
    this.originalFormData = OriginalFormData ? new OriginalFormData() : null;
  }
  
  append(key: string, value: any, filename?: string) {
    // Check if value is our mock File/Blob
    if (value && (value.constructor?.name === 'MockFile' || value.constructor?.name === 'MockBlob' || value._content)) {
      // Store our mock object with metadata
      let options: any = {};
      if (typeof filename === 'string') {
        options.filename = filename;
      } else if (typeof filename === 'object') {
        options = filename;
      }
      this.data.set(key, { value, options });
    } else if (this.originalFormData) {
      // Use original FormData for other types
      this.originalFormData.append(key, value, filename);
      // Also store in our data map for retrieval
      this.data.set(key, { value, options: { filename } });
    } else {
      // Fallback storage
      this.data.set(key, { value, options: { filename } });
    }
  }
  
  get(key: string) {
    const entry = this.data.get(key);
    return entry ? entry.value : undefined;
  }
  
  // Helper to get raw entry with options
  getRaw(key: string) {
    return this.data.get(key);
  }
  
  // Make it iterable for the XMLHttpRequest mock
  [Symbol.iterator]() {
    return this.data.entries();
  }
  
  entries() {
    return this.data.entries();
  }
} as any;

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