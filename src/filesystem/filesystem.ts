import { Api } from '../core/api';
import { 
  FileSystemEntry, 
  DirectoryListing, 
  FileAccess, 
  SharedFile,
  FileSystemOptions 
} from './types';

export class FileSystem {
  private api: Api;
  private options: FileSystemOptions;

  constructor(api: Api, options?: FileSystemOptions) {
    this.api = api;
    this.options = {
      baseUrl: options?.baseUrl || 'https://honeygraph.dlux.io',
      gateway: options?.gateway || 'https://ipfs.dlux.io',
      timeout: options?.timeout || 30000
    };
  }

  /**
   * Browse user's file system
   * @param username - The username to browse
   * @param path - The path within the user's filesystem (default: '/')
   * @returns Directory listing or file information
   */
  async browse(username: string, path: string = '/'): Promise<DirectoryListing | FileAccess> {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const response = await fetch(`${this.options.baseUrl}/fs/${username}${cleanPath}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      },
      redirect: 'manual'
    });

    // Handle file redirects
    if (response.status === 302) {
      const location = response.headers.get('Location');
      const cid = response.headers.get('X-IPFS-CID');
      const contractId = response.headers.get('X-Contract-ID');
      const blockNumber = response.headers.get('X-Block-Number');
      const storageNode = response.headers.get('X-Storage-Node');
      const gatewayPriority = response.headers.get('X-Gateway-Priority') as any;

      return {
        cid: cid!,
        contractId: contractId!,
        blockNumber: parseInt(blockNumber!),
        storageNode: storageNode!,
        gatewayUrl: location!,
        gatewayPriority: gatewayPriority || 'public'
      };
    }

    if (!response.ok) {
      throw new Error(`Failed to browse filesystem: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Get files shared with a user (encrypted files)
   * @param username - The username to check shared files for
   * @param path - The path within shared files (default: '/')
   * @returns List of shared files
   */
  async getSharedWithMe(username: string, path: string = '/'): Promise<DirectoryListing> {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const response = await fetch(`${this.options.baseUrl}/fse/${username}${cleanPath}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to get shared files: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Get files shared by a user with others
   * @param username - The username who shared files
   * @param path - The path within shared files (default: '/')
   * @returns List of files shared by the user
   */
  async getSharedByMe(username: string, path: string = '/'): Promise<DirectoryListing> {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const response = await fetch(`${this.options.baseUrl}/fss/${username}${cleanPath}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to get shared files: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Get the full URL to access a file
   * @param username - The username who owns the file
   * @param path - The path to the file
   * @returns The URL to access the file
   */
  async getFileUrl(username: string, path: string): Promise<string> {
    const fileAccess = await this.browse(username, path) as FileAccess;
    
    if (!fileAccess.gatewayUrl) {
      throw new Error('File not found or not accessible');
    }

    return fileAccess.gatewayUrl;
  }

  /**
   * List the preset folders for a user
   * @param username - The username
   * @returns List of preset folders
   */
  async getPresetFolders(username: string): Promise<FileSystemEntry[]> {
    const rootListing = await this.browse(username, '/') as DirectoryListing;
    
    // Filter for known preset folders
    const presetFolders = ['Documents', 'Images', 'Videos', 'Music', 'Archives', 'Code', 'Trash', 'Misc'];
    
    return rootListing.contents.filter(entry => 
      entry.type === 'directory' && presetFolders.includes(entry.name)
    );
  }

  /**
   * Search for files by name pattern
   * @param username - The username to search
   * @param pattern - Search pattern (supports wildcards)
   * @param path - Starting path for search (default: '/')
   * @returns List of matching files
   */
  async searchFiles(username: string, pattern: string, path: string = '/'): Promise<FileSystemEntry[]> {
    // This would need backend support or recursive client-side traversal
    // For now, we'll implement a simple single-directory search
    const listing = await this.browse(username, path) as DirectoryListing;
    
    if (!listing.contents) {
      return [];
    }

    const regex = new RegExp(pattern.replace(/\*/g, '.*'), 'i');
    return listing.contents.filter(entry => regex.test(entry.name));
  }

  /**
   * Get file metadata
   * @param username - The username who owns the file
   * @param path - The path to the file
   * @returns File metadata
   */
  async getFileMetadata(username: string, path: string): Promise<FileSystemEntry> {
    const parentPath = path.substring(0, path.lastIndexOf('/')) || '/';
    const fileName = path.substring(path.lastIndexOf('/') + 1);
    
    const listing = await this.browse(username, parentPath) as DirectoryListing;
    
    const file = listing.contents.find(entry => entry.name === fileName);
    
    if (!file) {
      throw new Error('File not found');
    }

    return file;
  }

  /**
   * Check if a path exists
   * @param username - The username
   * @param path - The path to check
   * @returns True if the path exists
   */
  async exists(username: string, path: string): Promise<boolean> {
    try {
      await this.browse(username, path);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get the total size of files in a directory
   * @param username - The username
   * @param path - The directory path
   * @returns Total size in bytes
   */
  async getDirectorySize(username: string, path: string = '/'): Promise<number> {
    const listing = await this.browse(username, path) as DirectoryListing;
    
    if (!listing.contents) {
      return 0;
    }

    return listing.contents.reduce((total, entry) => {
      return total + (entry.size || 0);
    }, 0);
  }

  /**
   * Build a file tree structure
   * @param username - The username
   * @param path - Starting path
   * @param maxDepth - Maximum depth to traverse
   * @returns Tree structure of files and directories
   */
  async buildFileTree(username: string, path: string = '/', maxDepth: number = 3): Promise<any> {
    const buildTree = async (currentPath: string, depth: number): Promise<any> => {
      if (depth > maxDepth) {
        return null;
      }

      try {
        const result = await this.browse(username, currentPath);
        
        if ('contents' in result) {
          // It's a directory
          const children = await Promise.all(
            result.contents
              .filter(entry => entry.type === 'directory')
              .map(async entry => ({
                ...entry,
                children: await buildTree(entry.path, depth + 1)
              }))
          );

          return {
            path: currentPath,
            type: 'directory',
            children: [
              ...children,
              ...result.contents.filter(entry => entry.type === 'file')
            ]
          };
        } else {
          // It's a file
          return {
            path: currentPath,
            type: 'file',
            cid: result.cid
          };
        }
      } catch (error) {
        console.error(`Error building tree at ${currentPath}:`, error);
        return null;
      }
    };

    return await buildTree(path, 0);
  }
}