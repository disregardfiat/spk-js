/**
 * SPK UI Icons
 * 
 * SVG icon generators for SPK Network UI components
 */

/**
 * Generate a file icon SVG with file type text
 * @param fileType - The file extension/type to display on the icon
 * @param size - The display size of the icon (default: 48)
 * @returns SVG string for the file icon
 */
export function getFileIcon(fileType: string, size: number = 48): string {
  // Ensure file type is uppercase and limited to 4 characters
  const displayType = (fileType || 'FILE').toUpperCase().substring(0, 4);
  
  return `
    <svg version="1.1" xmlns="http://www.w3.org/2000/svg"
         xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 800 800"
         style="enable-background:new 0 0 800 800;" xml:space="preserve" width="${size}" height="${size}">
      <g>
        <path class="st0"
            d="M650,210H500c-5.5,0-10-4.5-10-10V50c0-5.5,4.5-10,10-10s10,4.5,10,10v140h140c5.5,0,10,4.5,10,10S655.5,210,650,210z" fill="#ccc" />
        <path class="st0" d="M650,309.7c-5.5,0-10-4.5-10-10v-95.5L495.9,60H200c-22.1,0-40,17.9-40,40v196.3c0,5.5-4.5,10-10,10 s-10-4.5-10-10V100c0-33.1,26.9-60,60-60h300c2.7,0,5.2,1,7.1,2.9l150,150c1.9,1.9,2.9,4.4,2.9,7.1v99.7 C660,305.2,655.5,309.7,650,309.7z" fill="#ccc" />
        <path class="st0"
            d="M600,760H200c-33.1,0-60-26.9-60-60V550c0-5.5,4.5-10,10-10s10,4.5,10,10v150c0,22.1,17.9,40,40,40h400 c22.1,0,40-17.9,40-40V550c0-5.5,4.5-10,10-10s10,4.5,10,10v150C660,733.1,633.1,760,600,760z" fill="#ccc" />
        <path class="st0"
            d="M550,560H250c-5.5,0-10-4.5-10-10s4.5-10,10-10h300c5.5,0,10,4.5,10,10S555.5,560,550,560z" fill="#ccc" />
        <path class="st0"
            d="M400,660H250c-5.5,0-10-4.5-10-10s4.5-10,10-10h150c5.5,0,10,4.5,10,10S405.5,660,400,660z" fill="#ccc" />
        <path class="st0"
            d="M400,460H250c-5.5,0-10-4.5-10-10s4.5-10,10-10h150c5.5,0,10,4.5,10,10S405.5,460,400,460z" fill="#ccc" />
      </g>
      <text x="400" y="450" text-anchor="middle" font-family="Arial, sans-serif" font-size="140" font-weight="bold" fill="#999">${displayType}</text>
    </svg>
  `;
}

/**
 * Get emoji icon for file type (fallback for simple displays)
 * @param fileType - The file extension/type
 * @returns Emoji character for the file type
 */
export function getFileEmoji(fileType: string): string {
  const type = fileType?.toLowerCase() || '';
  
  const emojiMap: Record<string, string> = {
    // Video formats
    'mp4': '🎬',
    'webm': '🎬',
    'avi': '🎬',
    'mov': '🎬',
    'mkv': '🎬',
    
    // Image formats
    'jpg': '🖼️',
    'jpeg': '🖼️',
    'png': '🖼️',
    'gif': '🖼️',
    'webp': '🖼️',
    'svg': '🖼️',
    
    // Audio formats
    'mp3': '🎵',
    'wav': '🎵',
    'ogg': '🎵',
    'flac': '🎵',
    'm4a': '🎵',
    
    // Document formats
    'pdf': '📄',
    'doc': '📝',
    'docx': '📝',
    'txt': '📝',
    'md': '📝',
    
    // Archive formats
    'zip': '📦',
    'rar': '📦',
    '7z': '📦',
    'tar': '📦',
    'gz': '📦',
    
    // Code formats
    'js': '💻',
    'ts': '💻',
    'py': '💻',
    'java': '💻',
    'cpp': '💻',
    'c': '💻',
    'html': '💻',
    'css': '💻',
    'json': '💻'
  };
  
  return emojiMap[type] || '📎';
}