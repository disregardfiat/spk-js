// Example: Compact batch metadata encoding for SPK Network

// This example shows how batch metadata is encoded into the most compact format possible
// to minimize blockchain storage costs

const encoder = new BatchMetadataEncoder();

// Example 1: Files with minimal metadata
const minimalFiles = [
  { cid: 'Qm1', name: 'photo', ext: 'jpg', path: '/Images' },
  { cid: 'Qm2', name: 'doc', ext: 'pdf', path: '/Documents' }
];
console.log('Minimal:', encoder.encode(minimalFiles));
// Output: "1,doc,pdf.2,,photo,jpg.3,,"
// Note: No metadata means empty 4th field (no hyphens)

// Example 2: Files with some metadata
const withMetadata = [
  { 
    cid: 'Qm3', 
    name: 'report', 
    ext: 'pdf', 
    path: '/Documents',
    metadata: new SPKFileMetadata({ license: '7', labels: '1' })
  },
  {
    cid: 'Qm4',
    name: 'photo',
    ext: 'jpg', 
    path: '/Images',
    thumb: 'QmThumb',
    metadata: new SPKFileMetadata({ tags: 4, license: '1', labels: '25' })
  }
];
console.log('With metadata:', encoder.encode(withMetadata));
// Output: "1,report,pdf.2,,-7-1,photo,jpg.3,QmThumb,4-1-25"
// Note: tags=0 is omitted, only non-zero values shown

// Example 3: Custom folders
const customFolders = [
  { cid: 'Qm5', name: 'app', ext: 'exe', path: '/Software' },
  { cid: 'Qm6', name: 'photo2023', ext: 'jpg', path: 'Images/2023' },
  { cid: 'Qm7', name: 'index', ext: 'html', path: '/' }
];
console.log('Custom folders:', encoder.encode(customFolders));
// Output: "1|Software|3/2023,app,exe,,index,html.0,,photo2023,jpg.A,,"
// Note: First custom folder gets empty index, preset subfolder becomes "3/2023"

// Parsing the format:
// split(',') gives: [header, file1name, file1extfolder, file1thumb, file1meta, file2name, ...]
// For each file (i), the metadata is at index i*4+4
// split('-') on metadata gives: [flag, license, labels]
// Empty fields save bytes on chain!