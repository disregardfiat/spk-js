# SPK Network Batch Metadata Format

This document describes how multiple file metadata is encoded into a single string for SPK Network blockchain transactions.

## Format Overview

```
version[#encryption]|folder1|folder2,file1fields,file2fields,file3fields...
```

## Structure Components

### 1. Header Section (before first comma)

#### Version Number
- Current version: `1`
- Always starts the string

#### Encryption Keys (optional)
- Preceded by `#`
- Multiple keys separated by `:`
- Example: `#alice:bob:charlie`

#### Custom Folders (optional)
- Preceded by `|`
- Multiple folders separated by `|`
- Example: `|MyFolder|Projects/2023|Backups`

### 2. File Entries (after first comma)

Each file has exactly 4 comma-separated fields:

1. **filename** - Name without extension
2. **ext.folderindex** - Extension + folder index concatenated
3. **thumb** - Thumbnail CID/URL (can be empty)
4. **metadata** - Hyphen-separated: `flag-license-labels`

## Folder Indexing System

### Preset Folders
```
Documents = '2'
Images    = '3'
Videos    = '4'
Music     = '5'
Archives  = '6'
Code      = '7'
Trash     = '8'
Misc      = '9'
```

### Custom Folders
- Use indices: `1`, `A`, `B`, `C`, `D`, `E`, `F`, `G`, `H`, `I`, `J`, `K`...
- Excludes confusing characters (O, 0, l, I)
- Listed in header in order of first use

## Metadata Fields

### Flag (Tags as Base64)
- Bitwise flags encoded in custom Base64
- `4` = NSFW
- `8` = Executable
- `12` (4|8) = 'C' in custom Base64
- `0` = omitted entirely (field is empty, not '0')

### License
- Creative Commons identifiers ('1'-'7')
- Empty for no license

### Labels
- Concatenated digit string ('0'-'9')
- Empty for no labels

## Examples

### Example 1: Simple Batch
```
1,document,pdf.2,,,photo,jpg.3,QmThumb,,video,mp4.4,,
```
- Version 1
- 3 files in preset folders (Documents, Images, Videos)
- No encryption, no custom folders
- No metadata (empty 4th field - most compact)

### Example 2: With Custom Folders
```
1|Projects|Backups,code,py,,,backup,tar.A,,,readme,md.2,,
```
- Custom folders: Projects (index empty - first custom), Backups (index A)
- readme.md in Documents (preset index 2)

### Example 3: With Encryption and Metadata
```
1#alice:bob|MyFiles,secret,doc,,4-1-25,normal,txt.9,,-7-1
```
- Encrypted for alice and bob
- Custom folder: MyFiles (gets empty index)
- First file: NSFW flag (4), CC BY license, Favorite+Orange labels
- Second file: No flag (omitted), CC0 license (7), Important label (1)

### Example 4: Complex Real-World Batch
```
1|Software|3/2023,installer,exe,,8--14,vacation,jpg.A,QmThumb,4-1-25,report,pdf.2,,--1
```
Breaking down:
- Custom folders: `Software` (index empty - first), `3/2023` (index A - represents Images/2023)
- File 1: installer.exe in Software, Executable flag (8), no license, Important+Red labels
- File 2: vacation.jpg in Images/2023, NSFW flag (4), CC BY (1), Favorite+Orange
- File 3: report.pdf in Documents, no flag (omitted), no license, Important label only

## Important Notes

1. **Files are sorted by CID** before encoding to ensure deterministic output
2. **Empty fields are minimized** - no trailing hyphens or unnecessary zeros
3. **Commas in filenames** need special handling (escaping or encoding)
4. **Maximum efficiency** - single character indices, minimal separators
5. **Nested folders** use slash notation: `ParentFolder/SubFolder`

## Size Calculations

For a typical batch of 10 files:
- Header: ~50 bytes (version + folders)
- Per file: ~40-60 bytes (depending on metadata)
- Total: ~450-650 bytes

This is significantly more efficient than JSON encoding, which would be 2-3x larger.

## Implementation Considerations

1. **Parser Requirements**:
   - Split on first comma to separate header from files
   - Parse header for version, encryption, folders
   - Build folder index lookup table
   - Split remaining string by commas (groups of 4)

2. **Edge Cases**:
   - Handle missing metadata gracefully
   - Support future version numbers
   - Validate folder indices are valid characters
   - Handle very long folder names or deep nesting

3. **Security**:
   - Validate all input strings
   - Limit maximum batch size
   - Sanitize folder names
   - Verify CID format

## Version History

- **Version 1**: Initial format with folders, encryption, and metadata support