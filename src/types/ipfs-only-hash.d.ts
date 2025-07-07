declare module 'ipfs-only-hash' {
  function of(content: Buffer | Uint8Array | string): Promise<string>;
  export = { of };
}