# Vue Component Example

This directory contains an example Vue 3 component for SPK Drive functionality. 

**Important**: The core spk-js library is framework-agnostic and does not include or require Vue. This component is provided as an example for Vue developers.

## Usage

To use this component in your Vue project:

1. Install spk-js and Vue:
```bash
npm install @spknetwork/spk-js vue
```

2. Copy the SPKDriveVue.vue component to your project

3. Import and use it:
```vue
<template>
  <SPKDriveVue 
    :account="spkAccount"
    viewMode="grid"
    :enableUpload="true"
    @fileSelected="handleFileSelected"
    @filesUploaded="handleFilesUploaded"
  />
</template>

<script>
import { SPKAccount } from '@spknetwork/spk-js';
import SPKDriveVue from './components/SPKDriveVue.vue';

export default {
  components: { SPKDriveVue },
  data() {
    return {
      spkAccount: null
    };
  },
  async created() {
    this.spkAccount = new SPKAccount('username');
    await this.spkAccount.init();
  },
  methods: {
    handleFileSelected(files) {
      console.log('Selected files:', files);
    },
    handleFilesUploaded({ files, folder }) {
      console.log('Uploading files to folder:', folder);
    }
  }
};
</script>
```

## Features

- Drag and drop file uploads
- Grid and list view modes
- File search and filtering
- Context menus
- Folder navigation
- Storage statistics

## Framework-Specific Implementations

For other frameworks, you can create similar components using the core spk-js API:

- **React**: Use hooks and functional components
- **Angular**: Create a service and component
- **Svelte**: Use stores and reactive components
- **Vanilla JS**: Use the core API directly

The spk-js library provides all the necessary methods to build your own UI components.