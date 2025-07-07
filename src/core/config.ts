/**
 * SPK Network configuration
 */
export interface SPKConfig {
  node: string;
  ipfsGateway: string;
  keychain?: any;
  timeout?: number;
  maxRetries?: number;
}

export const DEFAULT_CONFIG: SPKConfig = {
  node: 'https://spktest.dlux.io',
  ipfsGateway: 'https://ipfs.dlux.io/ipfs/',
  timeout: 30000,
  maxRetries: 3,
};

export function mergeConfig(userConfig: Partial<SPKConfig> = {}): SPKConfig {
  return {
    ...DEFAULT_CONFIG,
    ...userConfig,
  };
}