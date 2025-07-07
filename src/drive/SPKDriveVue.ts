/**
 * SPK Drive Vue Component
 * 
 * Vue 3 component wrapper for SPK Drive functionality
 * Provides drag-and-drop, file management, and virtual file system
 */

import { defineComponent, ref, computed, watch, onMounted, onUnmounted, PropType } from 'vue';
import { SPKDrive, SPKFile, SPKFolder } from './index';
import { SPKAccount } from '../core/account';

export default defineComponent({
  name: 'SPKDriveVue',
  props: {
    account: {
      type: Object as PropType<SPKAccount>,
      required: true
    },
    viewMode: {
      type: String as PropType<'grid' | 'list'>,
      default: 'grid'
    },
    enableUpload: {
      type: Boolean,
      default: true
    },
    enableDragDrop: {
      type: Boolean,
      default: true
    }
  },
  emits: [
    'fileSelected',
    'fileOpened',
    'filesUploaded',
    'fileDeleted',
    'folderCreated',
    'error'
  ],
  setup(props, { emit }) {
    // State
    const drive = ref<SPKDrive | null>(null);
    const loading = ref(true);
    const currentPath = ref('');
    const selectedFiles = ref<Set<string>>(new Set());
    const selectedFolders = ref<Set<string>>(new Set());
    const searchQuery = ref('');
    const sortBy = ref<'name' | 'size' | 'date'>('name');
    const sortDir = ref<'asc' | 'desc'>('asc');
    const dragCounter = ref(0);
    const isDragging = ref(false);
    const contextMenu = ref<{
      show: boolean;
      x: number;
      y: number;
      type: 'file' | 'folder' | 'background';
      target: SPKFile | SPKFolder | null;
    }>({
      show: false,
      x: 0,
      y: 0,
      type: 'background',
      target: null
    });

    // Computed
    const files = computed(() => {
      if (!drive.value) return [];
      
      let fileList = searchQuery.value 
        ? drive.value.searchFiles(searchQuery.value, { folder: currentPath.value })
        : drive.value.getFiles(currentPath.value);
      
      // Sort files
      fileList.sort((a, b) => {
        let comparison = 0;
        switch (sortBy.value) {
          case 'name':
            comparison = (a.metadata?.name || '').localeCompare(b.metadata?.name || '');
            break;
          case 'size':
            comparison = a.s - b.s;
            break;
          case 'date':
            comparison = (a.t || 0) - (b.t || 0);
            break;
        }
        return sortDir.value === 'asc' ? comparison : -comparison;
      });
      
      return fileList;
    });

    const folders = computed(() => {
      if (!drive.value) return [];
      return drive.value.getSubfolders(currentPath.value);
    });

    const breadcrumb = computed(() => {
      const parts = currentPath.value.split('/').filter(Boolean);
      const crumbs = [{ name: 'My Drive', path: '' }];
      
      parts.forEach((part, index) => {
        crumbs.push({
          name: part,
          path: parts.slice(0, index + 1).join('/')
        });
      });
      
      return crumbs;
    });

    const storageStats = computed(() => {
      if (!drive.value) return null;
      return drive.value.getStorageStats();
    });

    const storagePercentage = computed(() => {
      if (!storageStats.value) return 0;
      return (storageStats.value.usedSize / storageStats.value.totalSize) * 100;
    });

    // Methods
    const initialize = async () => {
      try {
        loading.value = true;
        drive.value = new SPKDrive(props.account);
        
        // Set up event listeners
        drive.value.on('driveLoaded', handleDriveLoaded);
        drive.value.on('error', handleError);
        drive.value.on('fileDeleted', handleFileDeleted);
        drive.value.on('folderCreated', handleFolderCreated);
        drive.value.on('metadataUpdated', handleMetadataUpdated);
        
        await drive.value.loadDrive();
      } catch (error) {
        handleError(error);
      } finally {
        loading.value = false;
      }
    };

    const navigateTo = (path: string) => {
      currentPath.value = path;
      selectedFiles.value.clear();
      selectedFolders.value.clear();
      updateUrl();
    };

    const updateUrl = () => {
      if (typeof window !== 'undefined') {
        const hash = currentPath.value ? `#drive/${currentPath.value}` : '#drive';
        window.location.hash = hash;
      }
    };

    const handleFileClick = (event: MouseEvent, file: SPKFile) => {
      if (event.ctrlKey || event.metaKey) {
        // Multi-select
        if (selectedFiles.value.has(file.f)) {
          selectedFiles.value.delete(file.f);
        } else {
          selectedFiles.value.add(file.f);
        }
      } else if (event.shiftKey && selectedFiles.value.size > 0) {
        // Range select
        const allFiles = files.value;
        const lastSelected = Array.from(selectedFiles.value).pop();
        const lastIndex = allFiles.findIndex(f => f.f === lastSelected);
        const currentIndex = allFiles.findIndex(f => f.f === file.f);
        
        const start = Math.min(lastIndex, currentIndex);
        const end = Math.max(lastIndex, currentIndex);
        
        for (let i = start; i <= end; i++) {
          selectedFiles.value.add(allFiles[i].f);
        }
      } else {
        // Single select
        selectedFiles.value.clear();
        selectedFolders.value.clear();
        selectedFiles.value.add(file.f);
      }
      
      emit('fileSelected', Array.from(selectedFiles.value));
    };

    const handleFolderClick = (event: MouseEvent, folder: SPKFolder) => {
      if (event.detail === 2) {
        // Double click - navigate
        navigateTo(folder.path);
      } else {
        // Single click - select
        selectedFiles.value.clear();
        selectedFolders.value.clear();
        selectedFolders.value.add(folder.path);
      }
    };

    const handleDragStart = (event: DragEvent, item: SPKFile | SPKFolder, type: 'file' | 'folder') => {
      const data = {
        type,
        items: type === 'file' 
          ? [item as SPKFile]
          : [item as SPKFolder]
      };
      
      event.dataTransfer!.effectAllowed = 'move';
      event.dataTransfer!.setData('application/json', JSON.stringify(data));
    };

    const handleDragOver = (event: DragEvent) => {
      event.preventDefault();
      event.dataTransfer!.dropEffect = 'move';
    };

    const handleDragEnter = (event: DragEvent) => {
      event.preventDefault();
      dragCounter.value++;
      if (dragCounter.value === 1) {
        isDragging.value = true;
      }
    };

    const handleDragLeave = (event: DragEvent) => {
      dragCounter.value--;
      if (dragCounter.value === 0) {
        isDragging.value = false;
      }
    };

    const handleDrop = async (event: DragEvent, targetFolder?: string) => {
      event.preventDefault();
      dragCounter.value = 0;
      isDragging.value = false;
      
      const folder = targetFolder ?? currentPath.value;
      
      // Handle external files
      if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
        if (props.enableUpload) {
          emit('filesUploaded', {
            files: event.dataTransfer.files,
            folder
          });
        }
        return;
      }
      
      // Handle internal drag
      try {
        const data = JSON.parse(event.dataTransfer!.getData('application/json'));
        if (data.type === 'file') {
          for (const file of data.items) {
            await drive.value!.moveFile(file.f, folder);
          }
        }
      } catch (error) {
        console.error('Drop error:', error);
      }
    };

    const showContextMenu = (event: MouseEvent, type: 'file' | 'folder' | 'background', target?: SPKFile | SPKFolder) => {
      event.preventDefault();
      contextMenu.value = {
        show: true,
        x: event.clientX,
        y: event.clientY,
        type,
        target: target || null
      };
    };

    const hideContextMenu = () => {
      contextMenu.value.show = false;
    };

    const createNewFolder = async () => {
      const name = prompt('Enter folder name:');
      if (name) {
        const path = currentPath.value ? `${currentPath.value}/${name}` : name;
        try {
          await drive.value!.createFolder(path);
        } catch (error) {
          handleError(error);
        }
      }
    };

    const deleteSelected = async () => {
      if (confirm(`Delete ${selectedFiles.value.size} file(s)?`)) {
        for (const cid of selectedFiles.value) {
          await drive.value!.deleteFile(cid);
        }
        selectedFiles.value.clear();
      }
    };

    const refreshDrive = async () => {
      loading.value = true;
      try {
        await drive.value!.loadDrive();
      } catch (error) {
        handleError(error);
      } finally {
        loading.value = false;
      }
    };

    // Event handlers
    const handleDriveLoaded = (stats: any) => {
      console.log('Drive loaded:', stats);
    };

    const handleError = (error: any) => {
      console.error('Drive error:', error);
      emit('error', error);
    };

    const handleFileDeleted = (data: any) => {
      emit('fileDeleted', data);
    };

    const handleFolderCreated = (folder: SPKFolder) => {
      emit('folderCreated', folder);
    };

    const handleMetadataUpdated = (data: any) => {
      console.log('Metadata updated:', data);
    };

    // Lifecycle
    onMounted(() => {
      initialize();
      
      // Add global event listeners
      document.addEventListener('click', hideContextMenu);
      
      // Handle URL hash
      if (typeof window !== 'undefined' && window.location.hash.startsWith('#drive/')) {
        const path = window.location.hash.substring('#drive/'.length);
        currentPath.value = path;
      }
    });

    onUnmounted(() => {
      document.removeEventListener('click', hideContextMenu);
      
      if (drive.value) {
        drive.value.removeAllListeners();
      }
    });

    // Watch for account changes
    watch(() => props.account, () => {
      initialize();
    });

    return {
      // State
      loading,
      currentPath,
      selectedFiles,
      selectedFolders,
      searchQuery,
      sortBy,
      sortDir,
      isDragging,
      contextMenu,
      
      // Computed
      files,
      folders,
      breadcrumb,
      storageStats,
      storagePercentage,
      
      // Methods
      navigateTo,
      handleFileClick,
      handleFolderClick,
      handleDragStart,
      handleDragOver,
      handleDragEnter,
      handleDragLeave,
      handleDrop,
      showContextMenu,
      createNewFolder,
      deleteSelected,
      refreshDrive,
      
      // Drive instance (for advanced usage)
      drive
    };
  },
  
  template: `
    <div class="spk-drive" :class="{ 'dragging': isDragging }">
      <!-- Loading -->
      <div v-if="loading" class="text-center p-5">
        <div class="spinner-border" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
      </div>
      
      <!-- Drive Content -->
      <div v-else class="drive-content">
        <!-- Header -->
        <div class="drive-header mb-3">
          <!-- Search -->
          <div class="row g-2">
            <div class="col-md-6">
              <div class="input-group">
                <span class="input-group-text">
                  <i class="fas fa-search"></i>
                </span>
                <input 
                  type="search" 
                  class="form-control" 
                  placeholder="Search files..."
                  v-model="searchQuery"
                >
              </div>
            </div>
            
            <!-- Storage Info -->
            <div class="col-md-6">
              <div class="d-flex align-items-center justify-content-end">
                <div class="me-3">
                  <small class="text-muted">
                    {{ storageStats?.fileCount || 0 }} files
                  </small>
                </div>
                <div class="progress" style="width: 200px; height: 20px;">
                  <div 
                    class="progress-bar" 
                    :style="{ width: storagePercentage + '%' }"
                    :class="{
                      'bg-success': storagePercentage < 70,
                      'bg-warning': storagePercentage >= 70 && storagePercentage < 90,
                      'bg-danger': storagePercentage >= 90
                    }"
                  >
                    {{ storagePercentage.toFixed(1) }}%
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Toolbar -->
          <div class="d-flex justify-content-between align-items-center mt-3">
            <!-- Breadcrumb -->
            <nav aria-label="breadcrumb">
              <ol class="breadcrumb mb-0">
                <li 
                  v-for="crumb in breadcrumb" 
                  :key="crumb.path"
                  class="breadcrumb-item"
                  :class="{ active: crumb.path === currentPath }"
                >
                  <a 
                    v-if="crumb.path !== currentPath"
                    href="#" 
                    @click.prevent="navigateTo(crumb.path)"
                  >
                    {{ crumb.name }}
                  </a>
                  <span v-else>{{ crumb.name }}</span>
                </li>
              </ol>
            </nav>
            
            <!-- Actions -->
            <div class="btn-group">
              <button 
                class="btn btn-sm btn-outline-primary"
                @click="createNewFolder"
                v-if="enableUpload"
              >
                <i class="fas fa-folder-plus me-1"></i>
                New Folder
              </button>
              
              <button 
                class="btn btn-sm btn-outline-secondary"
                @click="refreshDrive"
              >
                <i class="fas fa-sync"></i>
              </button>
              
              <button 
                class="btn btn-sm"
                :class="viewMode === 'grid' ? 'btn-primary' : 'btn-outline-primary'"
                @click="$emit('update:viewMode', 'grid')"
              >
                <i class="fas fa-th"></i>
              </button>
              
              <button 
                class="btn btn-sm"
                :class="viewMode === 'list' ? 'btn-primary' : 'btn-outline-primary'"
                @click="$emit('update:viewMode', 'list')"
              >
                <i class="fas fa-list"></i>
              </button>
            </div>
          </div>
        </div>
        
        <!-- File Area -->
        <div 
          class="file-area"
          @drop="handleDrop"
          @dragover="handleDragOver"
          @dragenter="handleDragEnter"
          @dragleave="handleDragLeave"
          @contextmenu="showContextMenu($event, 'background')"
        >
          <!-- Grid View -->
          <div v-if="viewMode === 'grid'" class="file-grid">
            <!-- Folders -->
            <div
              v-for="folder in folders"
              :key="folder.path"
              class="file-item folder"
              :class="{ selected: selectedFolders.has(folder.path) }"
              draggable="true"
              @dragstart="handleDragStart($event, folder, 'folder')"
              @click="handleFolderClick($event, folder)"
              @contextmenu="showContextMenu($event, 'folder', folder)"
            >
              <i class="fas fa-folder fa-3x text-warning"></i>
              <div class="file-name">{{ folder.name }}</div>
            </div>
            
            <!-- Files -->
            <div
              v-for="file in files"
              :key="file.f"
              class="file-item"
              :class="{ selected: selectedFiles.has(file.f) }"
              draggable="true"
              @dragstart="handleDragStart($event, file, 'file')"
              @click="handleFileClick($event, file)"
              @contextmenu="showContextMenu($event, 'file', file)"
            >
              <div class="file-icon">
                <img 
                  v-if="file.metadata?.thumb_data" 
                  :src="file.metadata.thumb_data"
                  class="img-fluid"
                >
                <i v-else class="fas fa-file fa-3x"></i>
              </div>
              <div class="file-name">{{ file.metadata?.name || file.f }}</div>
              <div class="file-size">{{ formatBytes(file.s) }}</div>
            </div>
          </div>
          
          <!-- List View -->
          <table v-else class="table table-hover">
            <thead>
              <tr>
                <th>Name</th>
                <th>Size</th>
                <th>Type</th>
                <th>Modified</th>
              </tr>
            </thead>
            <tbody>
              <!-- Folders -->
              <tr
                v-for="folder in folders"
                :key="folder.path"
                class="folder-row"
                :class="{ selected: selectedFolders.has(folder.path) }"
                @click="handleFolderClick($event, folder)"
                @contextmenu="showContextMenu($event, 'folder', folder)"
              >
                <td>
                  <i class="fas fa-folder text-warning me-2"></i>
                  {{ folder.name }}
                </td>
                <td>-</td>
                <td>Folder</td>
                <td>{{ new Date(folder.modified).toLocaleString() }}</td>
              </tr>
              
              <!-- Files -->
              <tr
                v-for="file in files"
                :key="file.f"
                :class="{ selected: selectedFiles.has(file.f) }"
                @click="handleFileClick($event, file)"
                @contextmenu="showContextMenu($event, 'file', file)"
              >
                <td>
                  <i class="fas fa-file me-2"></i>
                  {{ file.metadata?.name || file.f }}
                </td>
                <td>{{ formatBytes(file.s) }}</td>
                <td>{{ file.metadata?.type || 'Unknown' }}</td>
                <td>{{ file.t ? new Date(file.t * 1000).toLocaleString() : '-' }}</td>
              </tr>
            </tbody>
          </table>
          
          <!-- Empty State -->
          <div 
            v-if="!folders.length && !files.length" 
            class="empty-state text-center p-5"
          >
            <i class="fas fa-folder-open fa-4x text-muted mb-3"></i>
            <p class="text-muted">
              {{ searchQuery ? 'No files found' : 'This folder is empty' }}
            </p>
          </div>
        </div>
        
        <!-- Context Menu -->
        <div 
          v-if="contextMenu.show"
          class="context-menu"
          :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
        >
          <div class="dropdown-menu show">
            <template v-if="contextMenu.type === 'file'">
              <a class="dropdown-item" href="#" @click.prevent="$emit('fileOpened', contextMenu.target)">
                <i class="fas fa-external-link-alt me-2"></i> Open
              </a>
              <a class="dropdown-item" href="#" @click.prevent="deleteSelected">
                <i class="fas fa-trash me-2"></i> Delete
              </a>
            </template>
            
            <template v-else-if="contextMenu.type === 'folder'">
              <a class="dropdown-item" href="#" @click.prevent="navigateTo(contextMenu.target.path)">
                <i class="fas fa-folder-open me-2"></i> Open
              </a>
            </template>
            
            <template v-else>
              <a class="dropdown-item" href="#" @click.prevent="createNewFolder">
                <i class="fas fa-folder-plus me-2"></i> New Folder
              </a>
              <a class="dropdown-item" href="#" @click.prevent="refreshDrive">
                <i class="fas fa-sync me-2"></i> Refresh
              </a>
            </template>
          </div>
        </div>
      </div>
    </div>
  `,
  
  methods: {
    formatBytes(bytes: number): string {
      const units = ['B', 'KB', 'MB', 'GB', 'TB'];
      let size = bytes;
      let unitIndex = 0;
      
      while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
      }
      
      return `${size.toFixed(2)} ${units[unitIndex]}`;
    }
  }
});