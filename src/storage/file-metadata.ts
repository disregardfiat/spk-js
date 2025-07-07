/**
 * SPK Network File Metadata
 * Handles tags, labels, and licenses for files
 */

import { NumberToBase64, Base64toNumber } from '../utils/base64';

export interface FileMetadataOptions {
  name?: string;
  ext?: string;
  thumb?: string;
  tags?: number | number[];  // Bitwise flags (single value or array)
  labels?: string;  // String of label characters
  license?: string; // License identifier
}

export interface TagOption {
  value: number;
  label: string;
  description?: string;
}

export interface LicenseOption {
  value: string;
  label: string;
  description: string;
  link?: string;
}

export interface LabelOption {
  value: string;
  label: string;
  icon?: string;
}

// Available tags (bitwise flags)
export const TAGS: TagOption[] = [
  {
    value: 4,
    label: 'NSFW',
    description: 'Not Safe For Work'
  },
  {
    value: 8,
    label: 'Executable',
    description: 'Is an executable file'
  }
];

// Available licenses
export const LICENSES: LicenseOption[] = [
  {
    value: '1',
    label: 'CC BY',
    description: 'Creative Commons Attribution License',
    link: 'https://creativecommons.org/licenses/by/4.0/'
  },
  {
    value: '2',
    label: 'CC BY-SA',
    description: 'Creative Commons Share Alike License',
    link: 'https://creativecommons.org/licenses/by-sa/4.0/'
  },
  {
    value: '3',
    label: 'CC BY-ND',
    description: 'Creative Commons No Derivatives License',
    link: 'https://creativecommons.org/licenses/by-nd/4.0/'
  },
  {
    value: '4',
    label: 'CC BY-NC-ND',
    description: 'Creative Commons Non-Commercial No Derivatives License',
    link: 'https://creativecommons.org/licenses/by-nc-nd/4.0/'
  },
  {
    value: '5',
    label: 'CC BY-NC',
    description: 'Creative Commons Non-Commercial License',
    link: 'https://creativecommons.org/licenses/by-nc/4.0/'
  },
  {
    value: '6',
    label: 'CC BY-NC-SA',
    description: 'Creative Commons Non-Commercial Share Alike License',
    link: 'https://creativecommons.org/licenses/by-nc-sa/4.0/'
  },
  {
    value: '7',
    label: 'CC0',
    description: 'CC0: Public Domain Grant',
    link: 'https://creativecommons.org/publicdomain/zero/1.0/'
  }
];

// Available labels
export const LABELS: LabelOption[] = [
  {
    value: '0',
    label: 'Miscellaneous',
    icon: 'fa-sink'
  },
  {
    value: '1',
    label: 'Important',
    icon: 'fa-exclamation'
  },
  {
    value: '2',
    label: 'Favorite',
    icon: 'fa-star'
  },
  {
    value: '3',
    label: 'Random',
    icon: 'fa-dice'
  },
  {
    value: '4',
    label: 'Red',
    icon: 'fa-circle text-red'
  },
  {
    value: '5',
    label: 'Orange',
    icon: 'fa-circle text-orange'
  },
  {
    value: '6',
    label: 'Yellow',
    icon: 'fa-circle text-yellow'
  },
  {
    value: '7',
    label: 'Green',
    icon: 'fa-circle text-green'
  },
  {
    value: '8',
    label: 'Blue',
    icon: 'fa-circle text-blue'
  },
  {
    value: '9',
    label: 'Purple',
    icon: 'fa-circle text-purple'
  }
];

export class SPKFileMetadata {
  public name: string = '';
  public ext: string = '';
  public thumb: string = '';
  public tags: number = 0;     // Bitwise flags
  public labels: string = '';  // String of label characters
  public license: string = ''; // License identifier

  constructor(options: FileMetadataOptions = {}) {
    if (options.name) this.name = options.name;
    if (options.ext) this.ext = options.ext;
    if (options.thumb) this.thumb = options.thumb;
    if (options.tags !== undefined) {
      if (Array.isArray(options.tags)) {
        this.tags = options.tags.reduce((acc, tag) => acc | tag, 0);
      } else {
        this.tags = options.tags;
      }
    }
    if (options.labels) this.labels = options.labels;
    if (options.license) this.license = options.license;
  }

  /**
   * Add a tag (bitwise OR)
   */
  addTag(tagValue: number): void {
    this.tags |= tagValue;
  }

  /**
   * Remove a tag (bitwise AND NOT)
   */
  removeTag(tagValue: number): void {
    this.tags &= ~tagValue;
  }

  /**
   * Check if tag is set
   */
  hasTag(tagValue: number): boolean {
    return (this.tags & tagValue) === tagValue;
  }

  /**
   * Get array of active tag values
   */
  getActiveTags(): number[] {
    const activeTags: number[] = [];
    TAGS.forEach(tag => {
      if (this.hasTag(tag.value)) {
        activeTags.push(tag.value);
      }
    });
    return activeTags;
  }

  /**
   * Add a label to the string
   */
  addLabel(labelValue: string): void {
    if (!this.labels) {
      this.labels = '2'; // Initialize with default
    }
    if (!this.labels.includes(labelValue)) {
      this.labels += labelValue;
    }
  }

  /**
   * Remove a label from the string
   */
  removeLabel(labelValue: string): void {
    if (this.labels) {
      this.labels = this.labels.replace(labelValue, '');
      if (this.labels === '') {
        this.labels = '2'; // Reset to default
      }
    }
  }

  /**
   * Check if label is set
   */
  hasLabel(labelValue: string): boolean {
    return this.labels.includes(labelValue);
  }

  /**
   * Get array of active label values
   */
  getActiveLabels(): string[] {
    if (!this.labels) return [];
    return this.labels.split('').filter(l => l !== '');
  }

  /**
   * Set license
   */
  setLicense(licenseValue: string): void {
    this.license = licenseValue;
  }

  /**
   * Clear license
   */
  clearLicense(): void {
    this.license = '';
  }

  /**
   * Get license details
   */
  getLicenseDetails(): LicenseOption | undefined {
    return LICENSES.find(l => l.value === this.license);
  }

  /**
   * Convert to SPK metadata format
   */
  toSPKFormat(): any {
    const meta: any = {};
    
    if (this.name) meta.name = this.name;
    if (this.ext) meta.ext = this.ext;
    if (this.thumb) meta.thumb = this.thumb;
    if (this.tags) {
      // Convert to base64 for SPK format
      meta.flag = NumberToBase64(this.tags) || '0';
    }
    if (this.labels) meta.labels = this.labels;
    if (this.license) meta.license = this.license;
    
    return meta;
  }

  /**
   * Create from SPK format
   */
  static fromSPKFormat(meta: any): SPKFileMetadata {
    const options: FileMetadataOptions = {};
    
    if (meta.name) options.name = meta.name;
    if (meta.ext) options.ext = meta.ext;
    if (meta.thumb) options.thumb = meta.thumb;
    if (meta.flag) {
      // Convert from base64
      options.tags = Base64toNumber(meta.flag);
    }
    if (meta.labels) options.labels = meta.labels;
    if (meta.license) options.license = meta.license;
    
    return new SPKFileMetadata(options);
  }
}