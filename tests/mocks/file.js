// Mock Blob implementation for tests
class MockBlob {
  constructor(content, options = {}) {
    this.type = options.type || '';
    
    if (Array.isArray(content)) {
      this._content = Buffer.concat(content.map(c => 
        c instanceof Buffer ? c : Buffer.from(c)
      ));
    } else if (content instanceof Buffer) {
      this._content = content;
    } else {
      this._content = Buffer.from(content);
    }
    
    this.size = this._content.length;
  }
  
  async arrayBuffer() {
    return this._content.buffer.slice(
      this._content.byteOffset, 
      this._content.byteOffset + this._content.byteLength
    );
  }
  
  slice(start, end) {
    const sliced = this._content.slice(start, end);
    return new MockBlob([sliced], { type: this.type });
  }
  
  async text() {
    return this._content.toString();
  }
  
  toString() {
    return `[MockBlob (${this.size} bytes)]`;
  }
  
  stream() {
    return {
      getReader: () => ({
        read: async () => ({ done: true, value: this._content })
      })
    };
  }
}

// Mock File implementation for tests
class MockFile extends MockBlob {
  constructor(content, name, options = {}) {
    super(content, options);
    this.name = name;
    this.lastModified = options.lastModified || Date.now();
  }
  
  toString() {
    // Return something that helps us debug
    return `[MockFile ${this.name} (${this.size} bytes)]`;
  }
}

// Override global File in test environment
if (typeof global !== 'undefined') {
  global.File = MockFile;
  global.Blob = MockBlob;
}

module.exports = MockFile;
module.exports.MockBlob = MockBlob;