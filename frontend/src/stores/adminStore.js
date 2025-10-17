import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import Fuse from 'fuse.js';

// Use environment variable for API base URL, fallback to production URL
const API_BASE = import.meta.env.REACT_APP_API_URL || 'https://quant-file-dist.onrender.com/api';

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
};

const getFormDataHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Authorization': `Bearer ${token}`
  };
};

export const useStore = create(
  persist(
    (set, get) => ({
      categories: [],
      files: [],
      loading: false,
      error: null,
      searchTerm: '',
      uploadProgress: {},

      setLoading: (loading) => set({ loading }),
      setError: (error) => set({ error }),

      fetchCategories: async () => {
        set({ loading: true, error: null });
        try {
          const response = await fetch(`${API_BASE}/categories`, {
            headers: getAuthHeaders()
          });
          if (!response.ok) throw new Error('Failed to fetch categories');
          const categories = await response.json();
          set({ categories, loading: false });
          return categories;
        } catch (error) {
          set({ error: error.message, loading: false });
          throw error;
        }
      },

      fetchFiles: async () => {
        set({ loading: true, error: null });
        try {
          const response = await fetch(`${API_BASE}/files`, {
            headers: getAuthHeaders()
          });
          if (!response.ok) throw new Error('Failed to fetch files');
          const files = await response.json();
          set({ files, loading: false });
          return files;
        } catch (error) {
          set({ error: error.message, loading: false });
          throw error;
        }
      },

      initializeCategories: async () => {
        await get().fetchCategories();
        await get().fetchFiles();
      },

      updateFileCategory: async (fileId, categoryId) => {
        set({ loading: true, error: null });
        try {
          const response = await fetch(`${API_BASE}/files/${fileId}/category`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ categoryId })
          });
          if (!response.ok) throw new Error('Failed to update category');
          const updatedFile = await response.json();
          set((state) => ({
            files: state.files.map(file => file._id === fileId ? updatedFile : file),
            loading: false
          }));
          return updatedFile;
        } catch (error) {
          set({ error: error.message, loading: false });
          throw error;
        }
      },

      bulkDeleteFiles: async (fileIds) => {
        set({ loading: true, error: null });
        try {
          // Delete files individually since bulk endpoint doesn't exist
          const deletePromises = fileIds.map(id => get().deleteFile(id));
          await Promise.all(deletePromises);
          set({ loading: false });
          return { message: 'Files deleted successfully' };
        } catch (error) {
          set({ error: error.message, loading: false });
          throw error;
        }
      },

      bulkMoveFiles: async (fileIds, targetCategoryId) => {
        set({ loading: true, error: null });
        try {
          const promises = fileIds.map(id => get().updateFileCategory(id, targetCategoryId));
          await Promise.all(promises);
          set({ loading: false });
        } catch (error) {
          set({ error: error.message, loading: false });
          throw error;
        }
      },

      getFileDetails: async (fileId) => {
        try {
          const response = await fetch(`${API_BASE}/files/${fileId}`, {
            headers: getAuthHeaders()
          });
          if (!response.ok) throw new Error('Failed to fetch file details');
          return await response.json();
        } catch (error) {
          throw error;
        }
      },

      getStats: async () => {
        const { files, categories } = get();
        const categoryCounts = {};
        categories.forEach(cat => categoryCounts[cat.name] = 0);
        files.forEach(file => {
          const catName = file.categoryId?.name || 'Uncategorized';
          categoryCounts[catName] = (categoryCounts[catName] || 0) + 1;
        });
        const totalFiles = files.length;
        const totalSize = files.reduce((sum, file) => sum + (file.size || 0), 0);
        const averageDownloads = files.length > 0 ? files.reduce((sum, file) => sum + (file.downloadCount || 0), 0) / files.length : 0;
        const sizeDistribution = {};
        files.forEach(file => {
          const sizeStr = file.size ? (file.size < 1024 ? 'Small' : file.size < 1024*1024 ? 'Medium' : 'Large') : 'Unknown';
          sizeDistribution[sizeStr] = (sizeDistribution[sizeStr] || 0) + 1;
        });
        return {
          totalFiles,
          totalSize,
          averageDownloads,
          categoryCounts,
          sizeDistribution
        };
      },

      setUploadProgress: (fileName, progress) => set((state) => ({
        uploadProgress: { ...state.uploadProgress, [fileName]: progress }
      })),
      clearUploadProgress: (fileName) => set((state) => {
        const newProgress = { ...state.uploadProgress };
        delete newProgress[fileName];
        return { uploadProgress: newProgress };
      }),

      uploadFile: async (file, categoryId = '', onProgress = null) => {
        set({ loading: true, error: null });
        return new Promise((resolve, reject) => {
          const formData = new FormData();
          formData.append('file', file);
          if (categoryId) formData.append('categoryId', categoryId);
          // Description is optional, don't append if not provided

          const xhr = new XMLHttpRequest();
          xhr.open('POST', `${API_BASE}/files/upload`, true);

          // Set headers
          const token = localStorage.getItem('token');
          if (token) {
            xhr.setRequestHeader('Authorization', `Bearer ${token}`);
          }

          // Progress tracking
          if (onProgress) {
            xhr.upload.addEventListener('progress', (e) => {
              if (e.lengthComputable) {
                const percentComplete = (e.loaded / e.total) * 100;
                onProgress(percentComplete);
              }
            });
          }

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const uploadedFile = JSON.parse(xhr.responseText);
                set((state) => ({
                  files: [...state.files, uploadedFile],
                  loading: false
                }));
                if (onProgress) onProgress(100);
                resolve(uploadedFile);
              } catch (err) {
                set({ error: 'Invalid response', loading: false });
                reject(new Error('Invalid response'));
              }
            } else {
              set({ error: 'Upload failed', loading: false });
              reject(new Error(`Upload failed: ${xhr.status}`));
            }
          };

          xhr.onerror = () => {
            set({ error: 'Upload error', loading: false });
            reject(new Error('Upload error'));
          };

          xhr.send(formData);
        });
      },

      searchFiles: (term) => {
        set({ searchTerm: term });
        const { files } = get();
        if (!term) {
          // No need for filteredFiles since component filters
          return files;
        }
        const fuse = new Fuse(files, {
          keys: ['originalName', 'filename', 'description', 'categoryId.name'],
          threshold: 0.3,
        });
        return fuse.search(term).map((result) => result.item);
      },

      deleteFile: async (fileId) => {
        set({ loading: true, error: null });
        try {
          const response = await fetch(`${API_BASE}/files/${fileId}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
          });
          if (!response.ok) throw new Error('Failed to delete file');
          set((state) => ({
            files: state.files.filter(file => file._id !== fileId),
            loading: false
          }));
          return await response.json();
        } catch (error) {
          set({ error: error.message, loading: false });
          throw error;
        }
      },

      // Link management functions
      links: [],
      linkLoading: false,
      linkError: null,

      setLinkLoading: (loading) => set({ linkLoading: loading }),
      setLinkError: (error) => set({ linkError: error }),

      fetchLinks: async (filters = {}) => {
        set({ linkLoading: true, linkError: null });
        try {
          const queryParams = new URLSearchParams();
          Object.entries(filters).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
              queryParams.append(key, value);
            }
          });

          const response = await fetch(`${API_BASE}/links?${queryParams}`, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
              'Content-Type': 'application/json'
            }
          });
          if (!response.ok) throw new Error('Failed to fetch links');
          const data = await response.json();
          set({ links: data.links, linkLoading: false });
          return data;
        } catch (error) {
          set({ linkError: error.message, linkLoading: false });
          throw error;
        }
      },

      createLink: async (linkData) => {
        set({ linkLoading: true, linkError: null });
        try {
          const response = await fetch(`${API_BASE}/links`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(linkData)
          });
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.msg || 'Failed to create link');
          }
          const newLink = await response.json();
          set((state) => ({
            links: [newLink, ...state.links],
            linkLoading: false
          }));
          return newLink;
        } catch (error) {
          set({ linkError: error.message, linkLoading: false });
          throw error;
        }
      },

      updateLink: async (linkId, linkData) => {
        set({ linkLoading: true, linkError: null });
        try {
          const response = await fetch(`${API_BASE}/links/${linkId}`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(linkData)
          });
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.msg || 'Failed to update link');
          }
          const updatedLink = await response.json();
          set((state) => ({
            links: state.links.map(link =>
              link._id === linkId ? updatedLink : link
            ),
            linkLoading: false
          }));
          return updatedLink;
        } catch (error) {
          set({ linkError: error.message, linkLoading: false });
          throw error;
        }
      },

      deleteLink: async (linkId) => {
        set({ linkLoading: true, linkError: null });
        try {
          const response = await fetch(`${API_BASE}/links/${linkId}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          });
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.msg || 'Failed to delete link');
          }
          set((state) => ({
            links: state.links.filter(link => link._id !== linkId),
            linkLoading: false
          }));
          return await response.json();
        } catch (error) {
          set({ linkError: error.message, linkLoading: false });
          throw error;
        }
      },

      incrementDownloadCount: async (linkId) => {
        try {
          const response = await fetch(`${API_BASE}/links/${linkId}/download`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          });
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.msg || 'Failed to update download count');
          }
          const data = await response.json();

          // Update local state
          set((state) => ({
            links: state.links.map(link =>
              link._id === linkId
                ? { ...link, downloadCount: data.downloadCount }
                : link
            )
          }));

          return data;
        } catch (error) {
          console.error('Error incrementing download count:', error);
          throw error;
        }
      },

      getLinkStats: async () => {
        try {
          const response = await fetch(`${API_BASE}/links/stats/summary`, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          });
          if (!response.ok) throw new Error('Failed to fetch link stats');
          return await response.json();
        } catch (error) {
          console.error('Error fetching link stats:', error);
          throw error;
        }
      },


      login: async (username, password) => {
        set({ loading: true, error: null });
        try {
          const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password })
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.msg || 'Login failed');
          }

          const data = await response.json();
          if (data.token) {
            localStorage.setItem('token', data.token);
            // Optionally store user data if returned
            set({ loading: false });
            return data;
          } else {
            throw new Error('No token received');
          }
        } catch (error) {
          set({ error: error.message, loading: false });
          throw error;
        }
      },

      logout: () => {
        localStorage.removeItem('token');
        set({ files: [], categories: [] });
      },

      // Legacy functions for compatibility if needed
      addFile: (file) => set((state) => ({ files: [...state.files, file] })),
      deleteItem: (id) => set((state) => ({ files: state.files.filter((item) => item._id !== id) })),
      updateItem: (id, updates) => set((state) => ({
        files: state.files.map((item) => item._id === id ? { ...item, ...updates } : item)
      })),
    }),
    {
      name: 'admin-storage',
      partialize: (state) => ({ searchTerm: state.searchTerm }), // Only store search term, not sensitive data
    }
  )
);
