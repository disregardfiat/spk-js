import SPK from '../src/index';

async function exploreFileSystem() {
  // Initialize SPK instance
  const spk = new SPK('myusername');
  await spk.init();

  // Browse root directory
  console.log('=== Browsing root directory ===');
  const rootListing = await spk.filesystem.browse('disregardfiat');
  console.log(`Found ${rootListing.contents.length} items in root`);
  
  // List preset folders
  console.log('\n=== Preset folders ===');
  const presetFolders = await spk.filesystem.getPresetFolders('disregardfiat');
  presetFolders.forEach(folder => {
    console.log(`- ${folder.name} (${folder.itemCount} items)`);
  });

  // Browse a specific folder
  console.log('\n=== Browsing Documents folder ===');
  const docsListing = await spk.filesystem.browse('disregardfiat', '/Documents');
  if ('contents' in docsListing) {
    docsListing.contents.forEach(item => {
      if (item.type === 'file') {
        console.log(`- File: ${item.name} (${item.size} bytes, ${item.mimeType})`);
      } else {
        console.log(`- Folder: ${item.name} (${item.itemCount} items)`);
      }
    });
  }

  // Get file URL
  console.log('\n=== Getting file URL ===');
  try {
    // Replace with actual file path
    const fileUrl = await spk.filesystem.getFileUrl('disregardfiat', '/Documents/example.pdf');
    console.log(`File URL: ${fileUrl}`);
  } catch (error) {
    console.log('File not found or not accessible');
  }

  // Search for files
  console.log('\n=== Searching for files ===');
  const searchResults = await spk.filesystem.searchFiles('disregardfiat', '*.mp4', '/Videos');
  console.log(`Found ${searchResults.length} video files`);
  searchResults.forEach(file => {
    console.log(`- ${file.name} (${file.size} bytes)`);
  });

  // Check if path exists
  console.log('\n=== Checking path existence ===');
  const exists = await spk.filesystem.exists('disregardfiat', '/Images');
  console.log(`/Images exists: ${exists}`);

  // Get directory size
  console.log('\n=== Calculating directory size ===');
  const dirSize = await spk.filesystem.getDirectorySize('disregardfiat', '/Documents');
  console.log(`Total size of /Documents: ${(dirSize / 1024 / 1024).toFixed(2)} MB`);

  // Build file tree (limited depth)
  console.log('\n=== Building file tree ===');
  const tree = await spk.filesystem.buildFileTree('disregardfiat', '/', 2);
  console.log('File tree:', JSON.stringify(tree, null, 2));

  // Get shared files
  console.log('\n=== Files shared with me ===');
  const sharedWithMe = await spk.filesystem.getSharedWithMe('disregardfiat');
  console.log(`${sharedWithMe.contents.length} files shared with me`);

  console.log('\n=== Files I shared ===');
  const sharedByMe = await spk.filesystem.getSharedByMe('disregardfiat');
  console.log(`${sharedByMe.contents.length} files shared by me`);
}

// Run the example
exploreFileSystem().catch(console.error);