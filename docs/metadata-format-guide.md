# SPK Network Metadata Format Guide

This guide documents the exact string formats used for metadata in the SPK Network.

## Overview

File metadata in SPK Network consists of several fields that are formatted as strings for storage:

- **name**: File name (string)
- **ext**: File extension (string)
- **thumb**: Thumbnail URL or CID (string)
- **flag**: Tags encoded as custom Base64 (string)
- **labels**: Label characters concatenated (string)
- **license**: License identifier (string)
- **path**: Virtual file system path (string)

## Custom Base64 Encoding

SPK Network uses a custom Base64 alphabet for encoding numeric values:
```
0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz+=
```

This is different from standard Base64. Examples:
- 0 → '0'
- 4 → '4' 
- 8 → '8'
- 12 → 'C'
- 255 → '3='

## Tags (flag field)

Tags are content warnings and file type indicators stored as bitwise flags:

| Value | Tag | Description |
|-------|-----|-------------|
| 4 | NSFW | Not Safe For Work content |
| 8 | Executable | Executable file |

Multiple tags are combined using bitwise OR:
- NSFW only: tags = 4, flag = '4'
- Executable only: tags = 8, flag = '8'
- Both: tags = 12 (4|8), flag = 'C'

**Important**: If tags = 0, the flag field is omitted entirely.

## Labels

Labels are visual organization markers stored as a string of single-digit characters:

| Character | Label | Icon |
|-----------|-------|------|
| 0 | Miscellaneous | fa-sink |
| 1 | Important | fa-exclamation |
| 2 | Favorite | fa-star (default) |
| 3 | Random | fa-dice |
| 4 | Red | fa-circle text-red |
| 5 | Orange | fa-circle text-orange |
| 6 | Yellow | fa-circle text-yellow |
| 7 | Green | fa-circle text-green |
| 8 | Blue | fa-circle text-blue |
| 9 | Purple | fa-circle text-purple |

Examples:
- labels = '1' → Important only
- labels = '25' → Favorite + Orange
- labels = '123' → Important + Favorite + Random

**Important**: Empty labels field is omitted. When first label is added, it initializes with default '2'.

## Licenses

Licenses use Creative Commons identifiers as strings:

| Value | License | Description |
|-------|---------|-------------|
| 1 | CC BY | Attribution |
| 2 | CC BY-SA | Attribution Share-Alike |
| 3 | CC BY-ND | Attribution No-Derivatives |
| 4 | CC BY-NC-ND | Attribution Non-Commercial No-Derivatives |
| 5 | CC BY-NC | Attribution Non-Commercial |
| 6 | CC BY-NC-SA | Attribution Non-Commercial Share-Alike |
| 7 | CC0 | Public Domain |

**Important**: Empty license field is omitted.

## Examples

### Example 1: NSFW Image
```javascript
{
  name: 'vacation-photo',
  ext: 'jpg',
  thumb: 'https://cdn.example.com/thumbs/abc123.jpg',
  flag: '4',      // NSFW tag
  labels: '125',  // Important, Favorite, Orange
  license: '1'    // CC BY
}
```

### Example 2: Important Document
```javascript
{
  name: 'whitepaper',
  ext: 'pdf',
  labels: '1',    // Important
  license: '7'    // CC0
  // No flag field (tags = 0)
}
```

### Example 3: Executable with Warnings
```javascript
{
  name: 'installer',
  ext: 'exe',
  flag: '8',      // Executable tag
  labels: '14'    // Important + Red (warning)
  // No license field (empty)
}
```

### Example 4: File with Multiple Tags
```javascript
{
  name: 'dangerous-content',
  ext: 'exe',
  flag: 'C',      // 12 in base64 (NSFW + Executable)
  labels: '14',   // Important + Red
  license: '4'    // CC BY-NC-ND
}
```

## Input Format

When providing metadata for uploads:

```javascript
{
  FileIndex: 0,                    // Index in file array
  name: 'my-document',             // File name
  ext: 'pdf',                      // Extension
  path: '/Documents/Work',         // Virtual path
  thumbnail: 'QmThumb123',         // Thumbnail CID
  tags: [4, 8],                    // Array or single number
  labels: '125',                   // String of label digits
  license: '1',                    // License identifier
  autoRenew: true,                 // Auto-renewal flag
  onProgress: (percent) => {}      // Progress callback
}
```

## Key Rules

1. **Empty fields are omitted** - Don't include fields with empty/zero values
2. **Tags use bitwise operations** - Combine with OR (|), check with AND (&)
3. **Labels maintain order** - Characters appear in the order they were added
4. **All values are strings** - Even numeric identifiers like license
5. **Custom Base64** - Uses special alphabet, not standard Base64

## Round-trip Guarantee

Data can be converted between formats without loss:
```javascript
original → toSPKFormat() → fromSPKFormat() → same as original
```