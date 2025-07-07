// Mock File implementation for tests
class MockFile {
  constructor(content, name, options = {}) {
    this.name = name;
    this.type = options.type || 'text/plain';
    this.lastModified = options.lastModified || Date.now();
    
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
    return new MockFile([sliced], this.name, { type: this.type });
  }
  
  async text() {
    return this._content.toString();
  }
  
  stream() {
    // Simple mock stream
    return {
      getReader: () => ({
        read: async () => ({ done: true, value: this._content })
      })
    };
  }
}

// Override global File in test environment
if (typeof global !== 'undefined') {
  global.File = MockFile;
}

module.exports = MockFile;