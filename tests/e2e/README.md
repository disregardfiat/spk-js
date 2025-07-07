# E2E Testing for SPK-JS File Uploads

This directory contains end-to-end tests for the SPK file upload functionality, including integration with the trole backend service.

## Key Components

### Mock Trole Server (`mock-trole-server.js`)
A mock implementation of the trole upload server that:
- Implements `/api/new_contract` for contract creation
- Implements `/upload-authorize` for upload authorization
- Implements `/upload` for chunked file uploads  
- Verifies file CIDs match the expected hash
- Stores uploaded files and contract metadata

### Batch Metadata Encoding
The `BatchMetadataEncoder` produces compact metadata strings for on-chain storage:

```
Format: version[#encryption]|folder1|folder2,file1,file2,file3...
Example: 1|Software|3/2023,app,exe,,8--14,photo,jpg.A,QmThumb,4-1-25,doc,pdf.0,,--1
```

Key features:
- First custom folder gets empty index for maximum compression
- Preset folders (Documents=2, Images=3, etc.) are not listed in header
- Subfolder notation like `3/2023` for `/Images/2023`
- Empty metadata fields are completely omitted (no `0--` for zero tags)
- Files are sorted by CID for deterministic output

## Running E2E Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run specific test file
npm run test:e2e -- file-upload-simple

# Run with verbose output
npm run test:e2e -- --verbose
```

## Test Scenarios Covered

1. **Single File Upload**: Basic file upload with CID verification
2. **Batch Upload**: Multiple files with shared contract
3. **Metadata Encoding**: Compact format for blockchain storage
4. **CID Verification**: Ensures uploaded content matches expected hash
5. **Error Handling**: Tests for wrong CIDs and failed uploads

## Integration with Trole

The tests demonstrate how spk-js integrates with the trole backend:

1. Create storage contract via `/api/new_contract`
2. Authorize upload with metadata via `/upload-authorize`
3. Upload file chunks via `/upload` with Content-Range headers
4. Verify CID matches file content hash

The compact metadata format significantly reduces on-chain storage costs while preserving all file information including paths, tags, licenses, and labels.