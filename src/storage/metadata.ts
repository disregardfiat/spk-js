/**
 * SPK Network File Metadata System
 * 
 * Handles the complex metadata encoding/decoding for SPK Network files
 * including virtual folders, thumbnails, encryption, and file attributes.
 * 
 * Format: contractflags#encryptionkeys|folder1/subfolder|folder2,filename1,ext1.folderindex1,thumb1,flag1-license1-labels1,...
 */

export interface FileFlagsDecoded {
  encrypted?: boolean;
  nsfw?: boolean;
  hidden?: boolean;
  thumb?: boolean;
  segment?: boolean;
  [key: string]: boolean | undefined;
}

export interface FileMetadata {
  name: string;
  ext: string;
  type?: string; // For compatibility with existing code (same as ext)
  pathIndex: string;
  thumb?: string;
  flags: string;
  license: string;
  labels: string;
  // Decoded values
  flagsDecoded?: FileFlagsDecoded;
  fullPath?: string;
  isAuxiliary?: boolean;
  folder?: string; // Full folder path
}

export interface FolderInfo {
  index: string;
  name: string;
  parent: string;
  fullPath: string;
}

export interface MetadataInfo {
  version: string;
  encryptionKeys: string;
  folders: FolderInfo[];
  folderMap: Map<string, FolderInfo>;
  files: Map<string, FileMetadata>;
}

/**
 * Preset folder indices - these have fixed indices
 */
export const PRESET_FOLDERS: Record<string, string> = {
  'Documents': '2',
  'Images': '3',
  'Videos': '4',
  'Music': '5',
  'Archives': '6',
  'Code': '7',
  'Trash': '8',
  'Misc': '9'
};

/**
 * Reverse mapping for quick lookups
 */
export const PRESET_FOLDER_INDICES: Record<string, string> = Object.entries(PRESET_FOLDERS).reduce((acc, [name, idx]) => {
  acc[idx] = name;
  return acc;
}, {} as Record<string, string>);

/**
 * Custom folder indices (excluding confusing characters)
 */
export const CUSTOM_INDICES = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/**
 * Flag bit positions for file metadata
 */
export const FILE_FLAGS: Record<string, number> = {
  'encrypted': 1,    // Bit 0 = encrypted file
  'is_thumb': 2,     // Bit 1 = thumbnail/hidden from explorer
  'nsfw': 4,         // Bit 2 = NSFW content
  'executable': 8    // Bit 3 = executable file
};


/**
 * Build the full folder path
 */
function buildFolderPath(parentIndex: string, folderName: string, folderMap: Map<string, FolderInfo>): string {
  if (!parentIndex || parentIndex === '0') {
    return folderName;
  }
  
  const parent = folderMap.get(parentIndex);
  if (parent) {
    return `${parent.fullPath}/${folderName}`;
  }
  
  return folderName;
}

/**
 * Parse the complete metadata string from a contract
 * Format: "contractflags#encryptiondata|folder1/subfolder|folder2,filename1,ext1.folderindex1,thumb1,flag1-license1-labels1,..."
 */
export function parseMetadataString(metadataString: string, cids: string[]): MetadataInfo {
  if (!metadataString) {
    return {
      version: '1',
      encryptionKeys: '',
      folders: [],
      folderMap: new Map(),
      files: new Map()
    };
  }

  // First split by comma to separate all parts
  const parts = metadataString.split(',');
  
  // First part is the contract header: "contractflags#encryptiondata|folder|tree"
  const contractHeader = parts[0] || '';
  
  // Split header to get flags/encryption and folders
  const pipeIndex = contractHeader.indexOf('|');
  let contractFlagsAndEnc = contractHeader;
  let folderString = '';
  
  if (pipeIndex !== -1) {
    contractFlagsAndEnc = contractHeader.substring(0, pipeIndex);
    folderString = contractHeader.substring(pipeIndex + 1);
  }
  
  // Parse contract flags and encryption data
  const [contractFlags = '1', encryptionKeys = ''] = contractFlagsAndEnc.split('#');
  const version = contractFlags.charAt(0) || '1';

  // Parse folders
  const folders: FolderInfo[] = [];
  const folderMap = new Map<string, FolderInfo>();
  
  // Add preset folders to the map
  for (const [name, index] of Object.entries(PRESET_FOLDERS)) {
    const folderInfo: FolderInfo = {
      index,
      name,
      parent: '',
      fullPath: name
    };
    folderMap.set(index, folderInfo);
  }
  
  // Custom folder index sequence: 1, A, B, C, ...
  const getCustomFolderIndex = (position: number): string => {
    if (position === 0) return '1';
    // After '1', we use A-Z, a-z (excluding confusing characters)
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    return alphabet[position - 1] || '';
  };
  
  // Parse custom folders from the folder string
  if (folderString) {
    const folderDefs = folderString.split('|');
    let customFolderPosition = 0;
    
    for (const folderDef of folderDefs) {
      if (!folderDef) continue;
      
      // Check if it's a simple folder name (top-level custom folder)
      if (!folderDef.includes('/')) {
        // This is a top-level custom folder
        const folderIndex = getCustomFolderIndex(customFolderPosition);
        const folderInfo: FolderInfo = {
          index: folderIndex,
          name: folderDef,
          parent: '0', // Root parent
          fullPath: folderDef
        };
        
        folders.push(folderInfo);
        folderMap.set(folderIndex, folderInfo);
        customFolderPosition++;
        continue;
      }
      
      // Handle subfolder format: parentIndex/folderName
      const slashIndex = folderDef.indexOf('/');
      const parentIndex = folderDef.substring(0, slashIndex);
      const folderName = folderDef.substring(slashIndex + 1);
      
      // For subfolders, generate the next index
      const folderIndex = getCustomFolderIndex(customFolderPosition);
      
      const folderInfo: FolderInfo = {
        index: folderIndex,
        name: folderName,
        parent: parentIndex,
        fullPath: buildFolderPath(parentIndex, folderName, folderMap)
      };
      
      folders.push(folderInfo);
      folderMap.set(folderIndex, folderInfo);
      customFolderPosition++;
    }
  }

  // Parse files - skip first part (contract header), then every 4 parts is a file
  const files = new Map<string, FileMetadata>();
  const sortedCids = [...cids].sort();
  
  // Each file has 4 parts: name, ext.folderindex, thumb, fileflag-license-label
  const partsPerFile = 4;
  for (let i = 0; i < sortedCids.length; i++) {
    const cid = sortedCids[i];
    const baseIndex = i * partsPerFile + 1; // +1 to skip contract header
    
    if (baseIndex + 3 < parts.length) {
      const name = parts[baseIndex] || '';
      const extAndPath = parts[baseIndex + 1] || '';
      const thumb = parts[baseIndex + 2] || '';
      const flagsData = parts[baseIndex + 3] || '0--';
      
      // Parse extension and folder index from "ext.folderindex"
      let ext = extAndPath;
      let pathIndex = '1'; // Default to root
      
      // Look for the last dot to separate extension from folder index
      const lastDotIndex = extAndPath.lastIndexOf('.');
      if (lastDotIndex !== -1) {
        ext = extAndPath.substring(0, lastDotIndex);
        pathIndex = extAndPath.substring(lastDotIndex + 1) || '1';
      }
      
      // Parse flags-license-labels
      const [flags = '0', license = '', labels = ''] = flagsData.split('-');
      
      // Decode flags to check for auxiliary files
      const flagsNum = parseInt(flags) || 0;
      const isAuxiliary = (flagsNum & FILE_FLAGS.thumb) !== 0;
      
      const metadata: FileMetadata = {
        name,
        ext,
        type: ext, // For compatibility with existing code
        pathIndex,
        thumb,
        flags,
        license,
        labels,
        flagsDecoded: decodeFlagString(flags),
        isAuxiliary
      };
      
      // Set folder path for easy access
      if (folderMap.has(pathIndex)) {
        const folder = folderMap.get(pathIndex)!;
        metadata.folder = folder.fullPath; // Use full path, not just name
        metadata.fullPath = folder.fullPath ? `${folder.fullPath}/${name}${ext ? '.' + ext : ''}` : `${name}${ext ? '.' + ext : ''}`;
      } else {
        metadata.folder = '';
        metadata.fullPath = `${name}${ext ? '.' + ext : ''}`;
      }
      
      files.set(cid, metadata);
    }
  }
  
  return {
    version,
    encryptionKeys,
    folders,
    folderMap,
    files
  };
}

/**
 * Build the complete metadata string for a contract
 */
export function buildMetadataString(
  files: Map<string, FileMetadata>,
  folders: FolderInfo[],
  encryptionKeys: string = ''
): string {
  // Build header section
  const version = '1';
  
  // Build folder list - only custom folders, not presets
  const customFolders = folders.filter(f => !PRESET_FOLDER_INDICES[f.index]);
  const folderList = customFolders
    .map(f => {
      if (f.parent === '0' || !f.parent) {
        return f.name; // Top-level folder
      }
      return `${f.parent}/${f.name}`; // Nested folder
    })
    .join('|');
  
  // Header format: version{encryptionKeys}|{folderList}
  let header = version;
  if (encryptionKeys) {
    header += encryptionKeys;
  }
  header += '|' + folderList;
  
  // Build file entries in CID order
  const sortedCids = Array.from(files.keys()).sort();
  const fileEntries = sortedCids.map(cid => {
    const meta = files.get(cid)!;
    
    // Build extension with path index
    let extAndPath = meta.ext || '';
    // Only append path index if not in root (index '0')
    if (meta.pathIndex && meta.pathIndex !== '0') {
      extAndPath += '.' + meta.pathIndex;
    }
    
    // Build flags string: flag-license-labels
    const flagsData = `${meta.flags || '0'}-${meta.license || ''}-${meta.labels || ''}`;
    
    return [
      meta.name || '',
      extAndPath,
      meta.thumb || '',
      flagsData
    ].join(',');
  }).join(',');
  
  // Final format: header,file1,file2,...
  return header + (fileEntries ? ',' + fileEntries : '');
}

/**
 * Convert number to Base64 for flag encoding
 */
export function numberToBase64(num: number): string {
  const glyphs = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz+=";
  let result = "";
  
  if (num === 0) return "0";
  
  while (num > 0) {
    result = glyphs[num % 64] + result;
    num = Math.floor(num / 64);
  }
  
  return result;
}

/**
 * Convert Base64 to number for flag decoding
 */
export function base64ToNumber(str: string): number {
  const glyphs = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz+=";
  let result = 0;
  
  for (let i = 0; i < str.length; i++) {
    const digit = glyphs.indexOf(str[i]);
    if (digit === -1) return 0; // Invalid character
    result = result * 64 + digit;
  }
  
  return result;
}

/**
 * Decode a flag string into boolean flags using bitwise operations
 */
export function decodeFlagString(flagStr: string): FileFlagsDecoded {
  const flags: FileFlagsDecoded = {};
  
  if (!flagStr || flagStr === '0') return flags;
  
  // Convert from Base64 to number
  const flagNum = base64ToNumber(flagStr);
  
  // Check each bit
  flags.encrypted = (flagNum & FILE_FLAGS.encrypted) !== 0;
  flags.thumb = (flagNum & FILE_FLAGS.is_thumb) !== 0;
  flags.nsfw = (flagNum & FILE_FLAGS.nsfw) !== 0;
  flags.executable = (flagNum & FILE_FLAGS.executable) !== 0;
  
  // Legacy compatibility
  flags.hidden = flags.thumb; // is_thumb means hidden from explorer
  
  return flags;
}

/**
 * Encode boolean flags into a flag string using bitwise operations
 */
export function encodeFlagString(flags: FileFlagsDecoded): string {
  let flagNum = 0;
  
  if (flags.encrypted) flagNum |= FILE_FLAGS.encrypted;
  if (flags.thumb || flags.hidden) flagNum |= FILE_FLAGS.is_thumb; // Both mean hidden
  if (flags.nsfw) flagNum |= FILE_FLAGS.nsfw;
  if (flags.executable) flagNum |= FILE_FLAGS.executable;
  
  return numberToBase64(flagNum);
}

/**
 * Check if a file should be hidden from the UI
 */
export function isAuxiliaryFile(metadata: FileMetadata): boolean {
  // Check if the is_thumb flag is set (Base64 '2' = decimal 2)
  const flagNum = base64ToNumber(metadata.flags || '0');
  const hasThumbFlag = (flagNum & FILE_FLAGS.is_thumb) !== 0;
  
  return hasThumbFlag || 
         metadata.name === '' || // Empty name means hidden
         metadata.name.startsWith('_') ||
         metadata.name.endsWith('.ts') ||
         metadata.name.endsWith('_thumb.m3u8');
}

/**
 * Get the display name for an auxiliary file type
 */
export function getAuxiliaryFileDescription(file: { name: string; ext?: string }): string {
  const fullName = file.name + (file.ext ? '.' + file.ext : '');
  
  // Video-related auxiliary files
  if (fullName.includes('_poster.')) return 'Video poster/thumbnail';
  if (fullName.endsWith('.ts')) return 'Video segment';
  
  // Check for video thumbnails/previews (e.g., _dr1.mov)
  if (fullName.startsWith('_')) {
    const videoExtensions = ['.mov', '.mp4', '.avi', '.webm', '.mkv', '.m4v'];
    if (videoExtensions.some(ext => fullName.toLowerCase().endsWith(ext))) {
      return 'Video thumbnail/preview';
    }
    // Generated image thumbnails
    if (fullName.endsWith('.jpg') || fullName.endsWith('.png')) {
      return 'Generated thumbnail';
    }
  }
  
  // Other thumbnail patterns
  if (fullName.startsWith('thumb') && (fullName.endsWith('.jpg') || fullName.endsWith('.png'))) {
    return 'Thumbnail';
  }
  
  return 'Supporting file';
}


/**
 * Get the folder name for a path index
 */
export function getFolderForPathIndex(
  pathIndex: string,
  folderMap: Map<string, FolderInfo>
): string {
  if (pathIndex === '0') return '';
  
  const folder = folderMap.get(pathIndex);
  return folder ? folder.fullPath : '';
}


/**
 * Truncate filename to fit metadata constraints (32 chars max)
 */
export function truncateFilename(filename: string): string {
  if (filename.length <= 32) return filename;
  
  const lastDotIndex = filename.lastIndexOf('.');
  if (lastDotIndex > -1) {
    const ext = filename.substring(lastDotIndex);
    const nameWithoutExt = filename.substring(0, lastDotIndex);
    return nameWithoutExt.substring(0, 32 - ext.length) + ext;
  }
  
  return filename.substring(0, 32);
}

/**
 * Simple interface for building metadata from file data
 */
export interface SimpleFileData {
  cid: string;
  name?: string;
  ext?: string;
  path?: string; // Full path like "Videos/movie.mp4" or "CustomFolder/doc.pdf"
  thumb?: string;
  encrypted?: boolean;
  hidden?: boolean;
  nsfw?: boolean;
  executable?: boolean;
  license?: string;
  labels?: string;
}

/**
 * Build metadata string from simple file array
 * This is the main entry point for desktop apps
 */
export function buildMetadataFromFiles(
  files: SimpleFileData[],
  encryptionKeys: string = ''
): string {
  // Build path to folder map
  const pathToFolderMap = new Map<string, string>();
  const folders: FolderInfo[] = [];
  
  // Add root
  pathToFolderMap.set('', '0');
  
  // Process all file paths to build folder structure
  const customFolderIndex = ['1', ...CUSTOM_INDICES.split('')];
  let customIndex = 0;
  
  for (const file of files) {
    if (!file.path) continue;
    
    const pathParts = file.path.split('/');
    let currentPath = '';
    
    for (let i = 0; i < pathParts.length - 1; i++) { // Skip filename
      const folderName = pathParts[i];
      const parentPath = currentPath;
      currentPath = currentPath ? `${currentPath}/${folderName}` : folderName;
      
      if (!pathToFolderMap.has(currentPath)) {
        // Check if it's a preset folder
        if (parentPath === '' && PRESET_FOLDERS[folderName]) {
          pathToFolderMap.set(currentPath, PRESET_FOLDERS[folderName]);
        } else {
          // Custom folder
          const index = customFolderIndex[customIndex++];
          const parentIndex = pathToFolderMap.get(parentPath) || '0';
          
          folders.push({
            index,
            name: folderName,
            parent: parentIndex,
            fullPath: currentPath
          });
          
          pathToFolderMap.set(currentPath, index);
        }
      }
    }
  }
  
  // Build file metadata map
  const fileMap = new Map<string, FileMetadata>();
  
  for (const file of files) {
    const folderPath = file.path ? file.path.substring(0, file.path.lastIndexOf('/')) : '';
    const pathIndex = pathToFolderMap.get(folderPath) || '0';
    
    // Encode flags
    const flags: FileFlagsDecoded = {
      encrypted: file.encrypted,
      thumb: file.hidden,
      hidden: file.hidden,
      nsfw: file.nsfw,
      executable: file.executable
    };
    
    const metadata: FileMetadata = {
      name: file.name || '',
      ext: file.ext || '',
      pathIndex,
      thumb: file.thumb || '',
      flags: encodeFlagString(flags),
      license: file.license || '',
      labels: file.labels || ''
    };
    
    fileMap.set(file.cid, metadata);
  }
  
  // Build final metadata string
  return buildMetadataString(fileMap, folders, encryptionKeys);
}

