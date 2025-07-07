// Mock implementation of ipfs-only-hash
module.exports = {
  of: jest.fn(async (buffer) => {
    // Return a valid mock CID
    return 'QmT78zSuBmuS4z925WZfrqQ1qHaJ56DQaTfyMUF7F8ff5o';
  })
};