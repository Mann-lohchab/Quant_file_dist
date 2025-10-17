import { useState, useEffect } from "react";
import { useStore } from "../stores/adminStore";
import Navbar from "./Navbar.jsx";
import { Upload, File, X, AlertCircle, CheckCircle, Trash2, Search, ChevronLeft, ChevronRight, Download, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";

// Toast notification utility functions
const showUploadSuccess = (fileName, fileSize) => {
  toast.success(`${fileName} uploaded successfully!`, {
    description: `File size: ${fileSize}`,
    duration: 4000,
    action: {
      label: "View",
      onClick: () => {
        // Switch to manage tab to show the uploaded file
        const manageTab = document.querySelector('[data-tab="manage"]');
        if (manageTab) manageTab.click();
      },
    },
  });
};

const showUploadError = (fileName, errorMessage) => {
  toast.error(`Failed to upload ${fileName}`, {
    description: errorMessage,
    duration: 6000,
    action: {
      label: "Retry",
      onClick: () => {
        // Could implement retry logic here
        console.log('Retry upload for:', fileName);
      },
    },
  });
};

const showProgressToast = (fileName, progress) => {
  if (progress === 100) {
    toast.success(`${fileName} upload complete!`, {
      description: "Processing file...",
      duration: 2000,
    });
  } else if (progress > 0) {
    toast.loading(`Uploading ${fileName}...`, {
      description: `${progress}% complete`,
      id: `upload-${fileName}`,
    });
  }
};

/**
 * @typedef {Object} LinkMetadata
 * @property {string} title - The title of the link
 * @property {string} favicon - The favicon URL
 * @property {string} url - The link URL
 * @property {string} [description] - Optional description
 */

/**
 * @typedef {Object} LinkData
 * @property {string} url - The link URL
 * @property {string} title - The link title
 * @property {string} description - The link description
 * @property {string} categoryId - The category ID
 * @property {string} favicon - The favicon URL
 * @property {'link'} type - The type identifier
 * @property {string} createdAt - The creation timestamp
 */

const bytesToSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

export default function AdminUploadPage() {
  const { categories, files, fetchCategories, fetchFiles, deleteFile, uploadFile, uploadProgress, setUploadProgress, clearUploadProgress, loading, error, setError } = useStore();
  const [activeTab, setActiveTab] = useState('upload');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadErrors, setUploadErrors] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedFileId, setSelectedFileId] = useState(null);
  const [uploadMode, setUploadMode] = useState('file'); // 'file' or 'url'
  const [urlInput, setUrlInput] = useState('');
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const filesPerPage = 10;


  useEffect(() => {
    const initializeAdmin = async () => {
      try {
        // Always fetch categories regardless of authentication
        await fetchCategories();

        // Only fetch files if on manage tab and authenticated
        if (activeTab === 'manage') {
          const token = localStorage.getItem('token');
          if (token) {
            await fetchFiles();
          }
        }
      } catch (initError) {
        console.error('Error initializing admin panel:', initError);
        if (initError.message?.includes('Authentication')) {
          setError('Authentication required for file management.');
        } else {
          setError('Failed to load admin panel data. Please refresh the page.');
        }
      }
    };

    initializeAdmin();
  }, [activeTab, fetchCategories, fetchFiles]); // Include fetch functions in dependencies

  // Effect to refresh files when refreshTrigger changes
  useEffect(() => {
    if (refreshTrigger > 0 && activeTab === 'manage') {
      const token = localStorage.getItem('token');
      if (token) {
        fetchFiles();
      }
    }
  }, [refreshTrigger, activeTab, fetchFiles]);

  // Effect to refresh files when switching to manage tab
  useEffect(() => {
    if (activeTab === 'manage') {
      const token = localStorage.getItem('token');
      if (token) {
        fetchFiles();
      }
    }
  }, [activeTab, fetchFiles]);

  const handleFileSelect = (e) => {
    const newFiles = Array.from(e.target.files || e.dataTransfer.files).filter(file => !selectedFiles.some(f => f.name === file.name));
    setSelectedFiles(prev => [...prev, ...newFiles]);
  };


  const removeFile = (fileName) => {
    setSelectedFiles(prev => prev.filter(f => f.name !== fileName));
    clearUploadProgress(fileName);
    setUploadErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[fileName];
      return newErrors;
    });
  };


  const handleUpload = async () => {
    if (uploadMode === 'file' && selectedFiles.length === 0) return;
    if (uploadMode === 'url' && !urlInput.trim()) return;

    setUploading(true);
    setUploadErrors({});
    setError(null); // Clear any previous errors

    try {
      if (uploadMode === 'file') {
        // Handle file uploads - requires authentication
        const token = localStorage.getItem('token');
        if (!token) {
          setError('Authentication required for file uploads. Please log in.');
          return;
        }

        for (let i = 0; i < selectedFiles.length; i++) {
          const file = selectedFiles[i];
          const formData = new FormData();
          formData.append('file', file);
          if (selectedCategory) {
            formData.append('categoryId', selectedCategory);
          }
          if (description && description.trim()) {
            formData.append('description', description);
          }

          try {
            setUploadProgress(prev => ({ ...prev, [file.name]: 0 }));

            // Show initial progress toast
            showProgressToast(file.name, 0);

            // Create upload promise with timeout
            const uploadPromise = fetch('http://localhost:5000/api/files/upload', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`
              },
              body: formData
            });

            // Add timeout
            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(() => {
                reject(new Error('Upload timeout - please try again'));
              }, 60000); // 60 second timeout for large files
            });

            const response = await Promise.race([uploadPromise, timeoutPromise]);

            if (response.ok) {
              try {
                const responseText = await response.text();
                if (responseText.trim()) {
                  const uploadedFile = JSON.parse(responseText);
                  console.log('File upload successful:', uploadedFile);
                }
                setUploadProgress(prev => ({ ...prev, [file.name]: 100 }));

                // Show success toast with enhanced details
                showUploadSuccess(file.name, bytesToSize(file.size));

                // Update progress toast to success
                showProgressToast(file.name, 100);

              } catch (parseError) {
                console.warn('Could not parse upload response as JSON:', parseError);
                setUploadProgress(prev => ({ ...prev, [file.name]: 100 }));

                // Show success toast even if response parsing fails
                showUploadSuccess(file.name, bytesToSize(file.size));
                showProgressToast(file.name, 100);
              }
            } else {
              let errorMessage = `Upload failed: ${response.status}`;

              try {
                const errorText = await response.text();
                if (errorText.trim()) {
                  const errorData = JSON.parse(errorText);
                  errorMessage = errorData.message || errorMessage;

                  // Provide specific guidance for common errors
                  if (response.status === 413) {
                    errorMessage += ' - File is too large. Please choose a smaller file.';
                  } else if (response.status === 415) {
                    errorMessage += ' - File type not allowed. Please choose EXE, REG, PDF, TXT, JPG, or PNG files.';
                  } else if (response.status === 429) {
                    errorMessage += ' - Too many uploads. Please wait before trying again.';
                  }
                }
              } catch (parseError) {
                console.error('Error response parse failed:', parseError);
                if (response.status === 413) {
                  errorMessage = 'File too large. Please choose a smaller file.';
                } else if (response.status === 415) {
                  errorMessage = 'File type not allowed. Please choose EXE, REG, PDF, TXT, JPG, or PNG files.';
                } else if (response.status === 429) {
                  errorMessage = 'Too many uploads. Please wait before trying again.';
                }
              }

              throw new Error(errorMessage);
            }
          } catch (err) {
            console.error('Upload error for', file.name, ':', err);
            setUploadErrors(prev => ({ ...prev, [file.name]: err.message }));
            setUploadProgress(prev => ({ ...prev, [file.name]: 0 }));

            // Show error toast with detailed message
            showUploadError(file.name, err.message);
          }
        }

        // Clear state first
        setError(null);
        setSelectedFiles([]);
        setDescription('');
        setSelectedCategory('');
        setUploadErrors({});
        setUploadProgress({}); // Clear all progress indicators

        // Show summary toast for multiple file uploads
        if (selectedFiles.length > 1) {
          toast.success(`Successfully uploaded ${selectedFiles.length} files`, {
            description: 'All files have been processed and are now available',
            duration: 4000,
          });
        }

        // Refresh files list with error handling
        try {
          setRefreshTrigger(prev => prev + 1); // Trigger refresh
        } catch (refreshError) {
          console.warn('Could not refresh files list:', refreshError);
          // Don't show error to user as upload was successful
        }
      } else if (uploadMode === 'url') {
        // Handle URL upload - no authentication required

        // Enhanced URL validation on frontend
        let urlObj;
        try {
          urlObj = new URL(urlInput.trim());
        } catch {
          setError('Please enter a valid URL (e.g., https://example.com/file.exe)');
          return;
        }

        // Check for blocked domains
        const blockedDomains = ['localhost', '127.0.0.1', '0.0.0.0'];
        const urlHostname = urlObj.hostname.toLowerCase();

        if (blockedDomains.some(domain => urlHostname.includes(domain))) {
          setError('Local URLs are not allowed for security reasons');
          return;
        }

        const uploadData = {
          url: urlInput.trim(),
          categoryId: selectedCategory || ''
        };

        // Only include description if it's not empty
        if (description && description.trim()) {
          uploadData.description = description.trim().substring(0, 500); // Limit length
        }

        try {
          const response = await fetch('http://localhost:5000/api/files/upload-link', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(uploadData)
          });

          if (response.ok) {
            try {
              const responseText = await response.text();
              if (responseText.trim()) {
                const uploadedFile = JSON.parse(responseText);
                console.log('Link upload successful:', uploadedFile);
              }
              setError(null);
              setUrlInput('');
              setDescription('');
              setSelectedCategory('');
              toast.success('Link uploaded successfully', {
                description: `Type: Link - ${urlInput.trim()}`,
                duration: 4000,
              });
              fetchFiles();
            } catch (parseError) {
              console.warn('Could not parse link upload response as JSON:', parseError);
              setError(null);
              setUrlInput('');
              setDescription('');
              setSelectedCategory('');
              toast.success('Link uploaded successfully!', {
                description: `Type: Link - ${urlInput.trim()}`,
                duration: 4000,
              });

              // Refresh files list with error handling
              try {
                setRefreshTrigger(prev => prev + 1); // Trigger refresh
              } catch (refreshError) {
                console.warn('Could not refresh files list after link upload:', refreshError);
                // Don't show error to user as upload was successful
              }
            }
          } else {
            try {
              const errorText = await response.text();
              console.error('Link upload error response:', {
                status: response.status,
                statusText: response.statusText,
                body: errorText
              });

              let errorData;
              if (errorText.trim()) {
                try {
                  errorData = JSON.parse(errorText);
                } catch (jsonError) {
                  console.error('Failed to parse error response as JSON:', jsonError);
                  errorData = { message: errorText };
                }
              } else {
                errorData = { message: `Link upload failed: ${response.status}` };
              }
              throw new Error(errorData.message || 'Link upload failed');
            } catch (parseError) {
              console.error('Link error response parse failed:', parseError);
              throw new Error(`Link upload failed: ${response.status} - ${response.statusText}`);
            }
          }
        } catch (err) {
          console.error('Link upload error:', err);
          setError(err.message || 'Link upload failed');

          // Show error toast for link uploads
          toast.error('Failed to upload link', {
            description: err.message || 'Please check the URL and try again',
            duration: 5000,
          });
        }
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError(err.message || 'Upload failed');
      setUploadProgress({}); // Clear progress indicators on error

      // Show general upload error toast
      toast.error('Upload failed', {
        description: err.message || 'Please check your files and try again',
        duration: 5000,
      });
    } finally {
      setUploading(false);
    }
  };

  const progressForFile = (fileName) => uploadProgress[fileName] || 0;

  // Filtered and paginated files
  const filteredFiles = files.filter(file => {
    // Enhanced search to handle both files and links
    const searchFields = file.type === 'url'
      ? [file.filename, file.originalName, file.url, file.description]
      : [file.filename, file.originalName, file.description];

    const matchesSearch = searchTerm === '' || searchFields.some(field =>
      field?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    const matchesCategory = !filterCategory || file.categoryId?._id === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const totalPages = Math.ceil(filteredFiles.length / filesPerPage);
  const paginatedFiles = filteredFiles.slice((currentPage - 1) * filesPerPage, currentPage * filesPerPage);

  const handleDelete = async () => {
    if (!selectedFileId) return;
    try {
      await deleteFile(selectedFileId);
      setShowDeleteModal(false);
      setSelectedFileId(null);
      // Reset to first page if necessary
      if (currentPage > totalPages - 1) setCurrentPage(1);
      // Trigger refresh to update the file list
      setRefreshTrigger(prev => prev + 1);

      // Show success toast
      toast.success('File deleted successfully', {
        description: 'The file has been removed from the system',
        duration: 3000,
      });
    } catch (err) {
      console.error('Delete error:', err);
      setError('Failed to delete file');

      // Show error toast
      toast.error('Failed to delete file', {
        description: err.message || 'Please try again',
        duration: 4000,
      });
    }
  };

  const selectedFile = files.find(f => f._id === selectedFileId);

  const handleCleanupOrphaned = async () => {
    if (!confirm('Are you sure you want to clean up orphaned files? This will remove database records for files that no longer exist on disk.')) {
      return;
    }

    setCleanupLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/files/cleanup-orphaned', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        toast.success('Cleanup completed successfully', {
          description: result.message,
          duration: 4000,
        });
        // Refresh files list
        setRefreshTrigger(prev => prev + 1);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Cleanup failed');
      }
    } catch (error) {
      console.error('Cleanup error:', error);
      toast.error('Cleanup failed', {
        description: error.message || 'Please try again',
        duration: 5000,
      });
    } finally {
      setCleanupLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar pageTitle="Admin Panel" />
      <main className="max-w-6xl mx-auto px-4 py-16">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-light text-gray-900 mb-6">
            Admin Panel,{' '}
            <span className="text-emerald-500 font-normal">manage and upload.</span>
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
            Securely upload new files and manage existing ones with full control over categories and details.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-8">
          <button
            onClick={() => setActiveTab('upload')}
            className={`px-6 py-4 -mb-px font-medium border-b-2 ${activeTab === 'upload' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            aria-selected={activeTab === 'upload'}
          >
            Upload Files & Links
          </button>
          <button
            onClick={() => setActiveTab('manage')}
            className={`px-6 py-4 -mb-px font-medium border-b-2 ${activeTab === 'manage' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            aria-selected={activeTab === 'manage'}
          >
            Manage Files
          </button>
        </div>

        {/* Upload Mode - File Upload Only */}
        {activeTab === 'upload' && (
          <div className="mb-8">
            <div className="flex items-center space-x-2 text-emerald-600 mb-4">
              <Upload className="w-5 h-5" />
              <span className="text-lg font-medium">Upload Files & Links</span>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="max-w-md mx-auto mb-8 p-4 bg-red-50 border border-red-200 rounded-lg" role="alert" aria-live="assertive">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-red-400 mr-2" />
              <span className="text-red-700">
                {error}
              </span>
            </div>
          </div>
        )}

        {/* Upload Tab */}
        {activeTab === 'upload' && (
          <div>
            {/* Upload Mode Tabs */}
            <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
              <div className="flex space-x-1 bg-gray-100 rounded-lg p-1 mb-6">
                <button
                  onClick={() => setUploadMode('file')}
                  className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    uploadMode === 'file'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Upload Files
                </button>
                <button
                  onClick={() => setUploadMode('url')}
                  className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    uploadMode === 'url'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Upload Link
                </button>
              </div>

              {/* File Upload Mode */}
              {uploadMode === 'file' && (
                <div
                  className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-emerald-500 transition-colors"
                  onDrop={handleFileSelect}
                  onDragOver={(e) => e.preventDefault()}
                  onClick={() => document.getElementById('fileInput').click()}
                  role="button"
                  tabIndex={0}
                  aria-label="Drag and drop files here or click to select"
                >
                  <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-lg text-gray-600 mb-2">Drag and drop files here, or click to select</p>
                  <p className="text-sm text-gray-500">Supports multiple files (EXE, REG, PDF, TXT, JPG, PNG)</p>
                  <input
                    id="fileInput"
                    type="file"
                    multiple
                    accept=".exe,.reg,.pdf,.txt,.jpg,.jpeg,.png"
                    onChange={handleFileSelect}
                    className="hidden"
                    aria-hidden="true"
                  />
                </div>
              )}

              {/* URL Upload Mode */}
              {uploadMode === 'url' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Download URL *
                    </label>
                    <input
                      type="url"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      placeholder="https://example.com/file.exe"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      required
                    />
                    <p className="text-sm text-gray-600 mt-1">
                      Enter the direct download URL for the file you want to share
                    </p>
                  </div>
                </div>
              )}

              {/* Category and Description - Show for both file and URL uploads */}
              {(uploadMode === 'file' && selectedFiles.length > 0) || (uploadMode === 'url' && urlInput.trim()) ? (
                <div className="mt-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Category (optional)
                    </label>
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      aria-label="Select category for uploads"
                    >
                      <option value="">No category</option>
                      {categories.map((cat) => (
                        <option key={cat._id} value={cat._id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description (optional)
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      rows={3}
                      placeholder={uploadMode === 'file' ? "Add a description for these files..." : "Add a description for this link..."}
                      aria-label={uploadMode === 'file' ? "File description" : "Link description"}
                    />
                  </div>
                  <button
                    onClick={handleUpload}
                    disabled={
                      (uploadMode === 'file' && selectedFiles.length === 0) ||
                      (uploadMode === 'url' && !urlInput.trim()) ||
                      uploading
                    }
                    className="w-full px-6 py-3 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
                    aria-label={
                      uploadMode === 'file'
                        ? `Upload ${selectedFiles.length} file(s)`
                        : 'Upload link'
                    }
                  >
                      {uploading ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Uploading...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-5 h-5" />
                          <span>
                            {uploadMode === 'file'
                              ? `Upload ${selectedFiles.length} file${selectedFiles.length !== 1 ? 's' : ''}`
                              : 'Upload Link'
                            }
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                ) : null}

              {/* Selected Files List - Only show for file uploads */}
              {uploadMode === 'file' && selectedFiles.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Selected Files</h3>
                  <div className="space-y-3">
                    {selectedFiles.map((file) => {
                      const prog = progressForFile(file.name);
                      const hasError = uploadErrors[file.name];
                      return (
                        <div key={file.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center space-x-3 flex-1">
                            <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center">
                              <File className="w-4 h-4 text-gray-600" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-gray-900 truncate" title={file.name}>
                                {file.name}
                              </p>
                              <p className="text-xs text-gray-500">
                                {bytesToSize(file.size)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-3">
                            {hasError ? (
                              <AlertCircle className="w-5 h-5 text-red-500" aria-label="Upload error" />
                            ) : prog === 100 ? (
                              <CheckCircle className="w-5 h-5 text-emerald-500" aria-label="Upload complete" />
                            ) : null}
                            {prog > 0 && prog < 100 && (
                              <div className="w-20 bg-gray-200 rounded-full h-2">
                                <div
                                  className="bg-emerald-500 h-2 rounded-full transition-all"
                                  style={{ width: `${prog}%` }}
                                  role="progressbar"
                                  aria-valuenow={prog}
                                  aria-valuemin="0"
                                  aria-valuemax="100"
                                />
                              </div>
                            )}
                            <span className="text-sm text-gray-600 min-w-[50px] text-right">
                              {prog > 0 ? `${Math.round(prog)}%` : ''}
                            </span>
                            <button
                              onClick={() => removeFile(file.name)}
                              className="p-1 text-gray-400 hover:text-gray-600"
                              aria-label={`Remove ${file.name}`}
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                          {hasError && (
                            <div className="ml-4 text-red-600 text-xs">
                              {uploadErrors[file.name]}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Loading State */}
              {loading && (
                <div className="text-center py-8" role="status" aria-live="polite">
                  <div className="inline-block w-8 h-8 border-2 border-gray-300 border-t-emerald-500 rounded-full animate-spin mb-4"></div>
                  <p className="text-gray-600">Loading categories...</p>
                </div>
              )}

              {/* Categories Navigation (mirroring download org) */}
              {categories.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {categories.map((category) => (
                    <div
                      key={category._id}
                      className="bg-white border border-gray-200 rounded-lg p-6 hover:border-emerald-300 transition-colors cursor-pointer"
                      onClick={() => setSelectedCategory(category._id)}
                      aria-label={`Select category ${category.name}`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                          <File className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div>
                          <h3 className="text-lg font-medium text-gray-900">
                            {category.name}
                          </h3>
                          <p className="text-sm text-gray-500">
                            {category.description || 'No description'}
                          </p>
                        </div>
                      </div>
                      {selectedCategory === category._id && (
                        <div className="mt-3 p-2 bg-emerald-50 rounded text-emerald-700 text-sm">
                          Selected for upload
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Manage Tab */}
        {activeTab === 'manage' && (
          <div className="space-y-6">
            {/* Admin Controls */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-medium text-gray-900">System Maintenance</h2>
                  <p className="text-sm text-gray-600">Clean up orphaned files and maintain system health</p>
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={() => setRefreshTrigger(prev => prev + 1)}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors flex items-center space-x-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>Refresh Files</span>
                  </button>
                  <button
                    onClick={handleCleanupOrphaned}
                    disabled={cleanupLoading}
                    className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                  >
                    {cleanupLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Cleaning...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4" />
                        <span>Cleanup Orphaned Files</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Search and Filter */}
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="search"
                  placeholder="Search files by name or description..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  aria-label="Search files"
                />
              </div>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                aria-label="Filter by category"
              >
                <option value="">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat._id} value={cat._id}>{cat.name}</option>
                ))}
              </select>
            </div>

            {/* Files List */}
            {loading ? (
              <div className="text-center py-16" role="status" aria-live="polite">
                <div className="inline-block w-8 h-8 border-2 border-gray-300 border-t-emerald-500 rounded-full animate-spin mb-4"></div>
                <p className="text-gray-600">Loading files and links...</p>
              </div>
            ) : filteredFiles.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <File className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {searchTerm || filterCategory ? 'No files or links match your search' : 'No files or links uploaded yet'}
                </h3>
                <p className="text-gray-600">
                  {searchTerm || filterCategory ? 'Try adjusting your search or filter.' : 'Upload some files or share links to get started.'}
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  {paginatedFiles.map((file) => (
                    <div
                      key={file._id}
                      className="bg-white border border-gray-200 rounded-lg p-6 hover:border-gray-300 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4 flex-1">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            file.type === 'url' ? 'bg-purple-100' : 'bg-gray-100'
                          }`}>
                            {file.type === 'url' ? (
                              <LinkIcon className="w-5 h-5 text-purple-600" />
                            ) : (
                              <File className="w-5 h-5 text-gray-600" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <h3 className="text-lg font-medium text-gray-900 truncate" title={file.originalName || file.filename}>
                                  {file.originalName || file.filename}
                                </h3>
                                {file.type === 'url' && file.url && (
                                  <p className="text-sm text-purple-600 font-medium mt-1 truncate" title={file.url}>
                                    {file.url}
                                  </p>
                                )}
                              </div>
                              {file.type === 'url' && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 ml-2 flex-shrink-0">
                                  <LinkIcon className="w-3 h-3 mr-1" />
                                  Link
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-4 text-sm text-gray-500 mt-2">
                              <span>Category: {file.categoryId?.name || 'Uncategorized'}</span>
                              <span>Uploaded: {formatDate(file.uploadedAt)}</span>
                              {file.type !== 'url' && (
                                <span>Size: {bytesToSize(file.size)}</span>
                              )}
                              <span>Downloads: {file.downloadCount || 0}</span>
                            </div>
                            {file.description && (
                              <p className="text-sm text-gray-600 mt-2">{file.description}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {/* View/Open Button */}
                          <button
                            onClick={async () => {
                              if (file.type === 'url') {
                                try {
                                  // Validate URL before attempting to open
                                  if (!file.url || !file.url.trim()) {
                                    toast.error('Invalid link', {
                                      description: 'This link appears to be broken or missing',
                                      duration: 3000,
                                    });
                                    return;
                                  }

                                  // Increment download count via API
                                  await fetch(`http://localhost:5000/api/links/${file._id}/download`, {
                                    method: 'POST'
                                  });

                                  // Open external URL in new tab
                                  window.open(file.url, '_blank');
                                  toast.success(`Opened link`, {
                                    description: `${file.originalName || file.filename}`,
                                    duration: 2000,
                                  });
                                } catch (error) {
                                  console.error('Link open error:', error);
                                  toast.error('Failed to open link', {
                                    description: 'The link may be broken or inaccessible',
                                    duration: 3000,
                                  });
                                }
                              } else {
                                try {
                                  console.log('Starting download for file:', file.filename, file._id);

                                  // Download the actual file
                                  const response = await fetch(`http://localhost:5000/api/files/download/${file._id}`);
                                  if (!response.ok) {
                                    const errorData = await response.json().catch(() => ({}));
                                    console.error('Download failed:', errorData);
                                    throw new Error(errorData.message || `Download failed: ${response.status}`);
                                  }

                                  console.log('Download response OK, creating blob...');
                                  const blob = await response.blob();
                                  console.log('Blob created, size:', blob.size);

                                  const url = window.URL.createObjectURL(blob);
                                  const link = document.createElement('a');
                                  link.href = url;
                                  link.download = file.filename;
                                  link.setAttribute('aria-label', `Download ${file.filename}`);
                                  document.body.appendChild(link);
                                  link.click();
                                  document.body.removeChild(link);
                                  window.URL.revokeObjectURL(url);

                                  console.log('Download completed for:', file.filename);
                                  toast.success(`Downloaded ${file.filename}`, {
                                    description: "File saved to your device",
                                    duration: 2000,
                                  });
                                } catch (error) {
                                  console.error('Download error:', error);
                                  toast.error('Download failed', {
                                    description: error.message || 'Please try again',
                                    duration: 3000,
                                  });
                                }
                              }
                            }}
                            className={`p-2 rounded focus:outline-none focus:ring-2 ${
                              file.type === 'url'
                                ? 'text-purple-500 hover:text-purple-700 focus:ring-purple-500'
                                : 'text-green-500 hover:text-green-700 focus:ring-green-500'
                            }`}
                            aria-label={file.type === 'url' ? `Open link ${file.originalName || file.filename}` : `Download ${file.filename}`}
                          >
                            {file.type === 'url' ? (
                              <LinkIcon className="w-5 h-5" />
                            ) : (
                              <Download className="w-5 h-5" />
                            )}
                          </button>

                          {/* Edit Button - Could be implemented for editing descriptions/categories */}
                          <button
                            onClick={() => {
                              // TODO: Implement edit functionality
                              toast.info('Edit functionality coming soon', {
                                description: 'You can currently edit via category changes',
                                duration: 2000,
                              });
                            }}
                            className="p-2 text-blue-500 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                            aria-label={`Edit ${file.filename}`}
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>

                          {/* Delete Button */}
                          <button
                            onClick={() => {
                              setSelectedFileId(file._id);
                              setShowDeleteModal(true);
                            }}
                            className="p-2 text-red-500 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 rounded"
                            aria-label={`Delete ${file.filename}`}
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-8">
                    <div className="text-sm text-gray-700">
                      Showing {((currentPage - 1) * filesPerPage) + 1} to {Math.min(currentPage * filesPerPage, filteredFiles.length)} of {filteredFiles.length} files
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                        aria-label="Previous page"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`px-3 py-2 border rounded-lg ${currentPage === page ? 'border-emerald-500 bg-emerald-50 text-emerald-600' : 'border-gray-300 hover:bg-gray-50'}`}
                        >
                          {page}
                        </button>
                      ))}
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                        aria-label="Next page"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50" role="dialog" aria-modal="true" aria-labelledby="delete-modal-title">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <div className="flex items-center space-x-3 mb-4">
                <AlertCircle className="w-5 h-5 text-red-500" />
                <h3 id="delete-modal-title" className="text-lg font-medium text-gray-900">
                  Confirm Delete
                </h3>
              </div>
              <p className="text-sm text-gray-600 mb-6">
                Are you sure you want to delete "{selectedFile?.filename}"? This action cannot be undone.
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setSelectedFileId(null);
                  }}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="px-4 py-2 bg-red-500 text-white hover:bg-red-600 rounded focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}