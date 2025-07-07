// Mock for ipfs-only-hash
module.exports = {
  of: jest.fn().mockResolvedValue('QmTestHash123')
};