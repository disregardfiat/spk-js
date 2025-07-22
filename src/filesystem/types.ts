export interface FileSystemEntry {
  name: string;
  type: 'file' | 'directory';
  path: string;
  cid?: string;
  size?: number;
  mimeType?: string;
  itemCount?: number;
  contract?: {
    id: string;
    blockNumber: number;
  };
  metadata?: {
    encrypted?: boolean;
    storageNode?: string;
    tags?: string[];
    [key: string]: any;
  };
}

export interface DirectoryListing {
  path: string;
  username: string;
  type: 'directory';
  contents: FileSystemEntry[];
}

export interface FileAccess {
  cid: string;
  contractId: string;
  blockNumber: number;
  storageNode: string;
  gatewayUrl: string;
  gatewayPriority: 'storage-node' | 'network' | 'public';
}

export interface SharedFile extends FileSystemEntry {
  sharedBy?: string;
  sharedWith?: string[];
  encryptionKey?: string;
  sharedAt?: number;
}

export interface FileSystemOptions {
  baseUrl?: string;
  gateway?: string;
  timeout?: number;
}