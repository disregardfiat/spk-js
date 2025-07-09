/**
 * SPK Drive - Virtual File System Management
 * 
 * This module provides a complete file management system for SPK Network
 * including folders, metadata, drag-and-drop support, and virtual file system.
 */

import { SPKAccount } from '../core/account';
import { SPKAPI } from '../core/api';
import { EventEmitter } from 'events';
import { 
  MetadataInfo,
  parseMetadataString,
  getAuxiliaryFileDescription,
  getFolderForPathIndex
} from '../storage/metadata';

export interface FileMetadata {
  name: string;
  type: string;
  thumb?: string;
  thumb_data?: string;
  flags?: string;
  license?: string;
  labels?: string;
  size?: number;
  encrypted?: boolean;
  is_thumb?: boolean;
  nsfw?: boolean;
}

export interface SPKFile {
  f: string; // CID
  i: string; // Contract ID
  o: string; // Owner
  s: number; // Size
  e?: string; // Expiration
  t?: number; // Timestamp
  metadata?: FileMetadata;
  folder?: string; // Virtual folder path
}

export interface SPKFolder {
  name: string;
  path: string;
  parent: string;
  created: number;
  modified: number;
  fileCount?: number;
  folderCount?: number;
  isPreset?: boolean;
}

export interface SPKContract {
  i: string; // Contract ID
  t: string; // Token owner
  n: Record<string, string>; // Storage nodes
  u: number; // Used bytes
  s: number; // Size
  e: string; // Expiration
  c: number; // Contract state
  m?: string; // Metadata
  df?: Record<string, number>; // Files (CID -> size)
  autoRenew?: boolean;
  encryption?: {
    key: string;
    accounts: Record<string, { key: string; enc_key: string }>;
  };
}

export interface DriveOptions {
  enableEncryption?: boolean;
  enableAutoRenew?: boolean;
  defaultTags?: string[];
  defaultLabels?: string[];
}

export class SPKDrive extends EventEmitter {
  private account: SPKAccount;
  private api: SPKAPI;
  private contracts: Map<string, SPKContract> = new Map();
  private files: Map<string, SPKFile> = new Map();
  private folders: Map<string, SPKFolder> = new Map();
  private metadata: Map<string, FileMetadata> = new Map();
  private metadataInfo: Map<string, MetadataInfo> = new Map();
  private virtualFS: Map<string, Set<string>> = new Map(); // folder path -> file CIDs
  
  constructor(account: SPKAccount) {
    super();
    this.account = account;
    this.api = account.api;
    this.initializePresetFolders();
  }

  /**
   * Initialize preset folders
   */
  private initializePresetFolders(): void {
    const presetFolders = ['Documents', 'Images', 'Videos', 'Music', 'Trash'];
    presetFolders.forEach(name => {
      this.folders.set(name, {
        name,
        path: name,
        parent: '',
        created: Date.now(),
        modified: Date.now(),
        isPreset: true
      });
      this.virtualFS.set(name, new Set());
    });
    this.virtualFS.set('', new Set()); // Root folder
  }

  /**
   * Load all contracts and files
   */
  async loadDrive(): Promise<void> {
    try {
      const data = await this.api.get(`/@${this.account.username}`);
      
      // Clear existing data
      this.contracts.clear();
      this.files.clear();
      this.metadata.clear();
      
      // Process file contracts
      if (data.file_contracts) {
        for (const contractId in data.file_contracts) {
          const contract = data.file_contracts[contractId];
          this.processContract(contract);
        }
      }

      // Process shared contracts
      if (data.channels) {
        for (const user in data.channels) {
          for (const contractId in data.channels[user]) {
            const contract = data.channels[user][contractId];
            this.processContract(contract);
          }
        }
      }

      this.emit('driveLoaded', {
        contracts: this.contracts.size,
        files: this.files.size
      });
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Process a single contract
   */
  private processContract(contract: SPKContract): void {
    this.contracts.set(contract.i, contract);
    
    // Parse metadata
    const parsedMeta = this.parseContractMetadata(contract);
    
    // Process files in contract
    if (contract.df) {
      const sortedCIDs = Object.keys(contract.df).sort();
      sortedCIDs.forEach((cid, index) => {
        const fileMeta = parsedMeta[cid] || {
          name: `File ${index + 1}`,
          type: 'unknown',
          size: contract.df![cid]
        };

        const file: SPKFile = {
          f: cid,
          i: contract.i,
          o: contract.t,
          s: contract.df![cid],
          e: contract.e,
          metadata: fileMeta,
          folder: this.extractFolderFromMetadata(fileMeta, contract.i, cid)
        };

        this.files.set(cid, file);
        this.metadata.set(`${contract.i}:${cid}`, fileMeta);
        
        // Add to virtual file system
        const folder = file.folder || '';
        if (!this.virtualFS.has(folder)) {
          this.virtualFS.set(folder, new Set());
        }
        this.virtualFS.get(folder)!.add(cid);
      });
    }
  }

  /**
   * Parse contract metadata string using the new metadata parser
   */
  private parseContractMetadata(contract: SPKContract): Record<string, FileMetadata> {
    const result: Record<string, FileMetadata> = {};
    
    if (!contract.m || !contract.df) return result;
    
    // Get CIDs from contract
    const cids = Object.keys(contract.df);
    
    // Parse metadata using the new parser
    const metadataInfo = parseMetadataString(contract.m, cids);
    
    // Process encryption info from metadata
    if (metadataInfo.encryptionKeys) {
      const accounts = metadataInfo.encryptionKeys.split(';');
      if (accounts.length > 0) {
        contract.encryption = { key: '', accounts: {} };
        accounts.forEach(acc => {
          const [encKey, username] = acc.split('@');
          if (username) {
            contract.encryption!.accounts[username] = {
              enc_key: `#${encKey}`,
              key: ''
            };
          }
        });
      }
    }
    
    // Convert parsed metadata to legacy format for compatibility
    metadataInfo.files.forEach((parsedMeta, cid) => {
      result[cid] = {
        name: parsedMeta.name || `File`,
        type: parsedMeta.ext || 'unknown',
        thumb: parsedMeta.thumb || '',
        flags: parsedMeta.flags || '0',
        license: parsedMeta.license || '',
        labels: parsedMeta.labels || '',
        encrypted: parsedMeta.flagsDecoded?.encrypted || false,
        is_thumb: parsedMeta.isAuxiliary || false,
        nsfw: parsedMeta.flagsDecoded?.nsfw || false
      };
    });
    
    // Store the full metadata info for later use
    this.metadataInfo.set(contract.i, metadataInfo);
    
    return result;
  }

  /**
   * Extract folder path from metadata using the new system
   */
  private extractFolderFromMetadata(_metadata: FileMetadata, contractId: string, cid: string): string {
    // Get the metadata info for this contract
    const metadataInfo = this.metadataInfo.get(contractId);
    if (!metadataInfo) {
      // No metadata, return empty (root folder)
      return '';
    }
    
    // Get the parsed metadata for this file
    const parsedMeta = metadataInfo.files.get(cid);
    if (!parsedMeta) {
      return '';
    }
    
    // Get folder from path index
    const folder = getFolderForPathIndex(parsedMeta.pathIndex, metadataInfo.folderMap);
    return folder || '';
  }


  /**
   * Get files in a specific folder
   */
  getFiles(folderPath = '', includeAuxiliary = false): SPKFile[] {
    const filesInFolder = this.virtualFS.get(folderPath) || new Set();
    return Array.from(filesInFolder)
      .map(cid => this.files.get(cid))
      .filter(file => {
        if (!file) return false;
        // Filter out auxiliary files unless requested
        if (!includeAuxiliary && file.metadata?.is_thumb) {
          return false;
        }
        return true;
      }) as SPKFile[];
  }

  /**
   * Get auxiliary files (thumbnails, segments, etc.)
   */
  getAuxiliaryFiles(): SPKFile[] {
    const auxFiles: SPKFile[] = [];
    this.files.forEach(file => {
      if (file.metadata?.is_thumb) {
        auxFiles.push(file);
      }
    });
    return auxFiles;
  }

  /**
   * Get description for an auxiliary file
   */
  getAuxiliaryDescription(file: SPKFile): string {
    if (!file.metadata) return 'Supporting file';
    return getAuxiliaryFileDescription({
      name: file.metadata.name,
      ext: file.metadata.type
    });
  }

  /**
   * Get subfolders of a folder
   */
  getSubfolders(parentPath = ''): SPKFolder[] {
    const subfolders: SPKFolder[] = [];
    
    // Add preset folders at root
    if (parentPath === '') {
      this.folders.forEach(folder => {
        if (folder.parent === '') {
          subfolders.push(folder);
        }
      });
    }
    
    // Find dynamic folders
    this.virtualFS.forEach((_files, path) => {
      if (path && path !== parentPath) {
        const parts = path.split('/');
        const parentParts = parentPath ? parentPath.split('/') : [];
        
        // Check if this is a direct subfolder
        if (parts.length === parentParts.length + 1) {
          const matches = parentParts.every((part, i) => parts[i] === part);
          if (matches) {
            const folderName = parts[parts.length - 1];
            if (!this.folders.has(path)) {
              this.folders.set(path, {
                name: folderName,
                path: path,
                parent: parentPath,
                created: Date.now(),
                modified: Date.now()
              });
            }
            subfolders.push(this.folders.get(path)!);
          }
        }
      }
    });
    
    return subfolders;
  }

  /**
   * Create a new folder
   */
  createFolder(path: string): SPKFolder {
    if (this.folders.has(path)) {
      throw new Error('Folder already exists');
    }
    
    const parts = path.split('/');
    const name = parts[parts.length - 1];
    const parent = parts.slice(0, -1).join('/');
    
    const folder: SPKFolder = {
      name,
      path,
      parent,
      created: Date.now(),
      modified: Date.now()
    };
    
    this.folders.set(path, folder);
    this.virtualFS.set(path, new Set());
    
    this.emit('folderCreated', folder);
    return folder;
  }

  /**
   * Move file to folder
   */
  async moveFile(cid: string, targetFolder: string): Promise<void> {
    const file = this.files.get(cid);
    if (!file) {
      throw new Error('File not found');
    }
    
    // Remove from current folder
    const currentFolder = file.folder || '';
    this.virtualFS.get(currentFolder)?.delete(cid);
    
    // Add to target folder
    if (!this.virtualFS.has(targetFolder)) {
      this.virtualFS.set(targetFolder, new Set());
    }
    this.virtualFS.get(targetFolder)!.add(cid);
    
    // Update file record
    file.folder = targetFolder;
    
    // Update metadata with folder label
    if (file.metadata) {
      const labels = file.metadata.labels ? file.metadata.labels.split(',') : [];
      const folderLabelIdx = labels.findIndex(l => l.startsWith('folder:'));
      if (folderLabelIdx >= 0) {
        labels[folderLabelIdx] = `folder:${targetFolder}`;
      } else {
        labels.push(`folder:${targetFolder}`);
      }
      file.metadata.labels = labels.join(',');
    }
    
    this.emit('fileMoved', { file, from: currentFolder, to: targetFolder });
  }

  /**
   * Delete file (move to trash)
   */
  async deleteFile(cid: string): Promise<void> {
    await this.moveFile(cid, 'Trash');
    
    const file = this.files.get(cid);
    if (file && file.metadata) {
      // Add deletion timestamp
      file.metadata.labels = (file.metadata.labels || '') + `,deleted:${Date.now()}`;
    }
    
    this.emit('fileDeleted', { cid });
  }

  /**
   * Permanently delete file
   */
  async permanentlyDeleteFile(cid: string): Promise<void> {
    const file = this.files.get(cid);
    if (!file) return;
    
    // Cancel contract renewal
    const auth = await this.account.sign(`cancel_contract:${file.i}`);
    await this.api.post(`/api/fileContract/${file.i}/cancel`, {}, auth);
    
    // Remove from local storage
    this.files.delete(cid);
    this.virtualFS.get(file.folder || '')?.delete(cid);
    
    this.emit('filePermanentlyDeleted', { cid });
  }

  /**
   * Search files
   */
  searchFiles(query: string, options?: {
    folder?: string;
    tags?: string[];
    labels?: string[];
    includeAuxiliary?: boolean;
  }): SPKFile[] {
    let results = Array.from(this.files.values());
    
    // Filter out auxiliary files unless requested
    if (!options?.includeAuxiliary) {
      results = results.filter(file => !file.metadata?.is_thumb);
    }
    
    // Filter by query
    if (query) {
      const lowerQuery = query.toLowerCase();
      results = results.filter(file => 
        file.metadata?.name.toLowerCase().includes(lowerQuery) ||
        file.metadata?.type.toLowerCase().includes(lowerQuery) ||
        file.metadata?.labels?.toLowerCase().includes(lowerQuery)
      );
    }
    
    // Filter by folder
    if (options?.folder !== undefined) {
      if (options.folder === '') {
        // Root folder - get all files not in subfolders
        results = results.filter(file => !file.folder || file.folder === '');
      } else {
        // Specific folder and subfolders
        results = results.filter(file => 
          file.folder === options.folder || 
          file.folder?.startsWith(options.folder + '/')
        );
      }
    }
    
    // Filter by tags
    if (options?.tags && options.tags.length > 0) {
      results = results.filter(file => {
        const fileFlags = this.flagsDecode(file.metadata?.flags || '0');
        return options.tags!.some(tag => fileFlags[tag]);
      });
    }
    
    // Filter by labels
    if (options?.labels && options.labels.length > 0) {
      results = results.filter(file => {
        const fileLabels = file.metadata?.labels?.split(',') || [];
        return options.labels!.some(label => fileLabels.includes(label));
      });
    }
    
    return results;
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<{
    totalSize: number;
    usedSize: number;
    availableSize: number;
    fileCount: number;
    contractCount: number;
  }> {
    let usedSize = 0;
    this.files.forEach(file => {
      usedSize += file.s;
    });
    
    const availableBroca = await this.account.calculateBroca();
    const availableSize = availableBroca * 1000 * 1024 * 6;
    
    return {
      totalSize: availableSize,
      usedSize,
      availableSize: availableSize - usedSize,
      fileCount: this.files.size,
      contractCount: this.contracts.size
    };
  }

  /**
   * Update file metadata
   */
  async updateFileMetadata(contractId: string, cid: string, metadata: Partial<FileMetadata>): Promise<void> {
    const key = `${contractId}:${cid}`;
    const currentMeta = this.metadata.get(key) || {} as FileMetadata;
    const updatedMeta = { ...currentMeta, ...metadata } as FileMetadata;
    
    // Ensure required fields have defaults
    if (!updatedMeta.name) updatedMeta.name = '';
    if (!updatedMeta.type) updatedMeta.type = '';
    
    this.metadata.set(key, updatedMeta);
    
    // Update file record
    const file = this.files.get(cid);
    if (file) {
      file.metadata = updatedMeta;
    }
    
    // Build new metadata string for contract
    const contract = this.contracts.get(contractId);
    if (contract) {
      const newMetaString = this.buildContractMetadata(contract);
      
      // Update contract on server
      const auth = await this.account.sign(`update_metadata:${contractId}`);
      await this.api.post(`/api/fileContract/${contractId}/metadata`, {
        m: newMetaString
      }, auth);
    }
    
    this.emit('metadataUpdated', { contractId, cid, metadata: updatedMeta });
  }

  /**
   * Build contract metadata string
   */
  private buildContractMetadata(contract: SPKContract): string {
    let metaString = contract.autoRenew ? '1' : '0';
    
    // Add encryption info
    if (contract.encryption && Object.keys(contract.encryption.accounts).length > 0) {
      metaString += '#';
      const encAccounts: string[] = [];
      for (const user in contract.encryption.accounts) {
        const acc = contract.encryption.accounts[user];
        if (acc.enc_key) {
          encAccounts.push(`${acc.enc_key.substring(1)}@${user}`);
        }
      }
      metaString += encAccounts.join(';');
    }
    
    // Add file metadata
    if (contract.df) {
      const sortedCIDs = Object.keys(contract.df).sort();
      sortedCIDs.forEach(cid => {
        const meta = this.metadata.get(`${contract.i}:${cid}`) || {} as FileMetadata;
        metaString += `,${meta.name || ''},${meta.type || ''},${meta.thumb || ''},${meta.flags || '0'}-${meta.license || ''}-${meta.labels || ''}`;
      });
    }
    
    return metaString;
  }

  /**
   * Handle drag and drop
   */
  handleDrop(files: FileList, targetFolder: string): void {
    this.emit('filesDropped', { files, targetFolder });
  }

  /**
   * Helper functions
   */
  private base64ToNumber(chars: string): number {
    const glyphs = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz+=";
    let result = 0;
    for (const char of chars) {
      result = result * 64 + glyphs.indexOf(char);
    }
    return result;
  }


  private flagsDecode(flags: string): Record<string, boolean> {
    const num = this.base64ToNumber(flags);
    return {
      encrypted: !!(num & 1),
      is_thumb: !!(num & 2),
      nsfw: !!(num & 4),
      executable: !!(num & 8)
    };
  }

  /**
   * Format bytes to human readable
   */
  formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    let unitIndex = 0;
    let size = bytes;
    
    while (size > 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }
}

export default SPKDrive;