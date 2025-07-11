import { SPKFileMetadata } from './file-metadata';
import { NumberToBase64, Base64toNumber } from '../utils/base64';

export interface FileWithMetadata {
  cid: string;
  name: string;
  ext: string;
  path?: string;
  thumb?: string;
  metadata?: SPKFileMetadata;
}

/**
 * Encodes batch file metadata into compact string format for blockchain storage
 */
export class BatchMetadataEncoder {
  private version = '1';
  private customFolders: string[] = [];
  private folderIndices: Map<string, string> = new Map();
  
  // Preset folder indices
  private readonly presetFolders: { [key: string]: string } = {
    'Documents': '2',
    'Images': '3', 
    'Videos': '4',
    'Music': '5',
    'Archives': '6',
    'Code': '7',
    'Trash': '8',
    'Misc': '9'
  };
  
  // Custom folder index characters (excluding confusing ones like O, 0, l, I)
  private readonly customFolderChars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  private customFolderIndex = 0;
  
  constructor() {
    // Initialize folder indices with presets
    Object.entries(this.presetFolders).forEach(([name, index]) => {
      this.folderIndices.set(name, index);
    });
  }
  
  /**
   * Register a custom folder and return its index
   */
  private addCustomFolder(path: string, displayPath?: string): string {
    if (!this.folderIndices.has(path)) {
      let index: string;
      if (this.customFolderIndex === 0) {
        // First custom folder gets empty index
        index = '';
      } else if (this.customFolderIndex - 1 >= this.customFolderChars.length) {
        throw new Error('Too many custom folders');
      } else {
        // Subsequent folders get A, B, C...
        index = this.customFolderChars[this.customFolderIndex - 1];
      }
      this.customFolderIndex++;
      this.folderIndices.set(path, index);
      // Use displayPath if provided, otherwise clean the path
      const folderName = displayPath || (path.startsWith('/') ? path.substring(1) : path);
      this.customFolders.push(folderName);
    }
    return this.folderIndices.get(path)!;
  }
  
  /**
   * Get folder index for a path
   */
  private getFolderIndex(path?: string): string {
    if (!path || path === '/') {
      return '0'; // Root folder
    }
    
    // Remove leading slash if present
    const folderPath = path.startsWith('/') ? path.substring(1) : path;
    
    // Default to Misc if empty after slash removal
    if (!folderPath) {
      return '0';
    }
    
    // Check if it's a preset folder
    let folderIndex = this.folderIndices.get(folderPath);
    
    if (!folderIndex) {
      // Check if it starts with a preset folder name
      for (const [presetName, presetIndex] of Object.entries(this.presetFolders)) {
        if (folderPath === presetName) {
          return presetIndex;
        }
        // Handle subfolder case like "Images/2023"
        if (folderPath.startsWith(presetName + '/')) {
          // Split the path and handle it hierarchically
          const parts = folderPath.split('/');
          let currentPath = '';
          let parentIndex = presetIndex;
          
          for (let j = 0; j < parts.length; j++) {
            const part = parts[j];
            currentPath = currentPath ? currentPath + '/' + part : part;
            
            if (!this.folderIndices.has(currentPath)) {
              if (j === 0) {
                // This is the preset folder itself, already handled
                this.folderIndices.set(currentPath, presetIndex);
              } else {
                // Add subfolder with parent reference
                // If parent is a preset index, use it directly
                // If parent is empty index, use '1'
                const displayIndex = parentIndex === '' ? '1' : parentIndex;
                const displayPath = displayIndex + '/' + part;
                this.addCustomFolder(currentPath, displayPath);
              }
            }
            
            parentIndex = this.folderIndices.get(currentPath)!;
          }
          
          return parentIndex;
        }
      }
      
      // Handle nested custom folders
      const parts = folderPath.split('/');
      if (parts.length > 1) {
        // Build up the path incrementally
        let currentPath = '';
        let parentIndex = '';
        
        for (let i = 0; i < parts.length; i++) {
          const part = parts[i];
          currentPath = currentPath ? currentPath + '/' + part : part;
          
          // Check if this level already exists
          if (!this.folderIndices.has(currentPath)) {
            if (i === 0) {
              // First level - just add it
              this.addCustomFolder(currentPath);
            } else {
              // Subsequent levels - add with parent reference
              const displayIndex = parentIndex === '' ? '1' : parentIndex;
              const displayPath = displayIndex + '/' + part;
              this.addCustomFolder(currentPath, displayPath);
            }
          }
          
          // Update parent index for next iteration
          parentIndex = this.folderIndices.get(currentPath)!;
        }
        
        return parentIndex;
      }
      
      // It's a simple custom folder, add it
      folderIndex = this.addCustomFolder(folderPath);
    }
    
    return folderIndex;
  }
  
  /**
   * Encode a single file's metadata
   */
  private encodeFile(file: FileWithMetadata): string {
    // Get folder index
    const folderIndex = this.getFolderIndex(file.path);
    
    // Build metadata string: flag-license-labels
    const meta = file.metadata || new SPKFileMetadata();
    
    // Build metadata components
    let flagStr = '';
    // Only include flag if it's non-zero
    if (meta.tags && meta.tags !== 0) {
      flagStr = NumberToBase64(meta.tags);
    }
    const licenseStr = meta.license || '';
    const labelsStr = meta.labels || '';
    
    // Only include metadata if at least one field is present
    let metaStr = '';
    if (flagStr || licenseStr || labelsStr) {
      metaStr = `${flagStr}-${licenseStr}-${labelsStr}`;
    }
    
    // Build ext.folder field
    // For empty index (first custom folder), don't add dot
    // For any other folder (including root '0'), add dot and index
    const extFolder = folderIndex === '' ? file.ext : `${file.ext}.${folderIndex}`;
    
    // Return comma-separated fields: name,ext.folder,thumb,metadata
    return [
      file.name,
      extFolder,
      file.thumb || '',
      metaStr
    ].join(',');
  }
  
  /**
   * Encode batch of files into compact metadata string
   */
  encode(files: FileWithMetadata[], options: { encrypt?: string[] } = {}): string {
    // Reset state for new encoding
    this.customFolders = [];
    this.customFolderIndex = 0;
    // Keep preset folders, remove custom ones
    const newIndices = new Map<string, string>();
    Object.entries(this.presetFolders).forEach(([name, index]) => {
      newIndices.set(name, index);
    });
    this.folderIndices = newIndices;
    
    // First pass: collect all custom folders
    files.forEach(file => {
      if (file.path) {
        // This will handle the folder index assignment
        this.getFolderIndex(file.path);
      }
    });
    
    // Sort files by CID for deterministic order
    const sortedFiles = [...files].sort((a, b) => a.cid.localeCompare(b.cid));
    
    // Build header
    let header = this.version;
    
    // Add encryption keys if present
    if (options.encrypt && options.encrypt.length > 0) {
      header += '#' + options.encrypt.join(':');
    }
    
    // Add custom folders
    if (this.customFolders.length > 0) {
      header += '|' + this.customFolders.join('|');
    }
    
    // Encode files
    const fileStrings = sortedFiles.map(f => this.encodeFile(f));
    
    // Combine header and files
    return header + ',' + fileStrings.join(',');
  }
  
  /**
   * Decode batch metadata string back to files
   */
  decode(metaString: string): {
    version: string;
    encrypt?: string[];
    files: Array<{
      name: string;
      ext: string;
      path: string;
      thumb?: string;
      metadata: SPKFileMetadata;
    }>;
  } {
    // Split header and files
    const firstComma = metaString.indexOf(',');
    if (firstComma === -1) {
      throw new Error('Invalid metadata string: no files');
    }
    
    const header = metaString.substring(0, firstComma);
    const filesStr = metaString.substring(firstComma + 1);
    
    // Parse header
    let version = '1';
    let encrypt: string[] | undefined;
    const customFolders: string[] = [];
    
    // Parse version and optional sections
    const headerParts = header.split('|');
    const versionPart = headerParts[0];
    
    if (versionPart.includes('#')) {
      const [ver, enc] = versionPart.split('#');
      version = ver;
      encrypt = enc.split(':');
    } else {
      version = versionPart;
    }
    
    // Parse custom folders
    if (headerParts.length > 1) {
      customFolders.push(...headerParts.slice(1));
    }
    
    // Build reverse folder lookup
    const indexToFolder = new Map<string, string>();
    // Add root folder mapping
    indexToFolder.set('0', '/');
    Object.entries(this.presetFolders).forEach(([name, index]) => {
      indexToFolder.set(index, name);
    });
    
    // Add custom folders to lookup
    customFolders.forEach((folder, i) => {
      if (i === 0) {
        // First custom folder has empty index
        indexToFolder.set('', folder);
      } else {
        // Subsequent folders use A, B, C...
        const index = this.customFolderChars[i - 1];
        indexToFolder.set(index, folder);
      }
    });
    
    // Parse files (groups of 4 fields)
    const fileFields = filesStr.split(',');
    const files = [];
    
    for (let i = 0; i < fileFields.length; i += 4) {
      if (i + 3 >= fileFields.length) {
        throw new Error('Invalid metadata string: incomplete file data');
      }
      
      const name = fileFields[i];
      const extFolder = fileFields[i + 1];
      const thumb = fileFields[i + 2];
      const metaStr = fileFields[i + 3];
      
      // Parse ext.folder
      let ext: string;
      let folderIndex: string;
      const lastDot = extFolder.lastIndexOf('.');
      
      if (lastDot === -1) {
        // No dot means first custom folder (empty index)
        ext = extFolder;
        folderIndex = '';
      } else {
        ext = extFolder.substring(0, lastDot);
        folderIndex = extFolder.substring(lastDot + 1);
      }
      
      // Get the folder path
      let path = indexToFolder.get(folderIndex) || 'Misc';
      
      // Handle complex folder references like "1/Sub-Folder_2023"
      if (path.includes('/')) {
        const pathParts = path.split('/');
        const parentRef = pathParts[0];
        
        // Replace parent reference with actual folder name
        if (parentRef === '1') {
          // '1' refers to the first custom folder (which has empty index)
          const parentFolder = indexToFolder.get('') || '';
          path = parentFolder + '/' + pathParts.slice(1).join('/');
        } else if (indexToFolder.has(parentRef)) {
          const parentFolder = indexToFolder.get(parentRef) || '';
          path = parentFolder + '/' + pathParts.slice(1).join('/');
        }
      }
      
      // Parse metadata: flag-license-labels
      const [flagStr, license, labels] = metaStr.split('-');
      const metadata = new SPKFileMetadata({
        tags: flagStr && flagStr !== '0' ? Base64toNumber(flagStr) : 0,
        license: license || undefined,
        labels: labels || undefined
      });
      
      files.push({
        name,
        ext,
        path,
        thumb: thumb || undefined,
        metadata
      });
    }
    
    return {
      version,
      encrypt,
      files
    };
  }
}