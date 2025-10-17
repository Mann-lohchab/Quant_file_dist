import { useState, useEffect, useCallback } from "react";
import { useStore } from "../stores/adminStore";
import { Button } from "../components/ui/button";
import { File, Folder, Download, Edit, Trash2, Search, ChevronUp, ChevronDown, CheckSquare, Square, Eye, BarChart3, Upload, X, Link } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import Fuse from "fuse.js";
import { PieChart, Pie, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import { Toaster, toast } from "sonner";

const bytesToSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

export default function AdminPanel() {
  const { categories, files, loading, error, fetchCategories, fetchFiles, initializeCategories, updateFileCategory, bulkDeleteFiles, bulkMoveFiles, getFileDetails, getStats } = useStore();
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch] = useDebounce(searchTerm, 300);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [selectedFiles, setSelectedFiles] = useState(new Set());
  const [bulkAction, setBulkAction] = useState('');
  const [showSidebar, setShowSidebar] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [stats, setStats] = useState(null);
  const [uploadFiles, setUploadFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState({});
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedCategoryForUpload, setSelectedCategoryForUpload] = useState('');
  const [uploadMode, setUploadMode] = useState('file'); // 'file' or 'url'
  const [urlInput, setUrlInput] = useState('');

  useEffect(() => {
    fetchCategories();
    fetchFiles();
    initializeCategories();
    getStats().then(setStats);
  }, []);

  const getFilesByCategory = (categoryId) => {
    let categoryFiles = files.filter(file => file.categoryId?._id === categoryId);

    if (debouncedSearch) {
      const fuse = new Fuse(files, {
        keys: ['originalName', 'filename', 'description', 'categoryId.name'],
        threshold: 0.3
      });
      const searchResults = fuse.search(debouncedSearch).map(result => result.item);
      categoryFiles = categoryFiles.filter(file => searchResults.some(sr => sr._id === file._id));
    }

    if (sortConfig.key) {
      categoryFiles.sort((a, b) => {
        let aVal = a[sortConfig.key];
        let bVal = b[sortConfig.key];

        if (sortConfig.key === 'size') {
          aVal = aVal || 0;
          bVal = bVal || 0;
        } else if (sortConfig.key === 'uploadedAt') {
          aVal = new Date(aVal);
          bVal = new Date(bVal);
        }

        if (aVal < bVal) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aVal > bVal) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    return categoryFiles;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const toggleFileSelection = (fileId) => {
    setSelectedFiles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fileId)) {
        newSet.delete(fileId);
      } else {
        newSet.add(fileId);
      }
      return newSet;
    });
  };

  const selectAllInCategory = (categoryId) => {
    const categoryFiles = getFilesByCategory(categoryId);
    setSelectedFiles(prev => {
      const newSet = new Set(prev);
      categoryFiles.forEach(file => newSet.add(file._id));
      return newSet;
    });
  };

  const handleBulkAction = async () => {
    if (selectedFiles.size === 0) return;

    if (bulkAction === 'delete') {
      if (confirm(`Delete ${selectedFiles.size} selected files?`)) {
        await bulkDeleteFiles(Array.from(selectedFiles));
        toast.success(`${selectedFiles.size} files deleted`);
        setSelectedFiles(new Set());
      }
    } else if (bulkAction === 'move') {
      const targetCategory = prompt('Enter target category ID:');
      if (targetCategory) {
        await bulkMoveFiles(Array.from(selectedFiles), targetCategory);
        toast.success(`${selectedFiles.size} files moved`);
        setSelectedFiles(new Set());
      }
    }
    setBulkAction('');
  };

  const onDragEnd = async (result) => {
    const { source, destination } = result;

    if (!destination) return;

    const sourceCategoryId = source.droppableId;
    const destCategoryId = destination.droppableId;
    const fileId = result.draggableId;

    if (!sourceCategoryId || !fileId) return;

    const file = files.find(f => f._id === fileId);
    if (!file) return;

    if (sourceCategoryId === destCategoryId) {
      console.log('Reordered within category');
      return;
    }

    try {
      await updateFileCategory(fileId, destCategoryId);
      toast.success('File moved successfully');
    } catch (err) {
      console.error('Error moving file:', err);
      toast.error('Error moving file');
    }
  };

  const handleFileClick = async (file) => {
    try {
      const details = await getFileDetails(file._id);
      setSelectedFile(details);
    } catch (err) {
      toast.error('Error loading file details');
    }
  };

  const handleUploadFiles = async (e) => {
    const newFiles = Array.from(e.target.files || e.dataTransfer.files);
    setUploadFiles(prev => [...prev, ...newFiles]);
  };

  const uploadSelectedFiles = async () => {
    if (uploadMode === 'file' && uploadFiles.length === 0) return;
    if (uploadMode === 'url' && !urlInput.trim()) return;

    try {
      if (uploadMode === 'file') {
        // Handle file uploads
        for (let i = 0; i < uploadFiles.length; i++) {
          const file = uploadFiles[i];
          const formData = new FormData();
          formData.append('file', file);
          if (selectedCategoryForUpload) {
            formData.append('categoryId', selectedCategoryForUpload);
          }
          // Description is optional, don't append if not provided

          try {
            setUploadProgress(prev => ({ ...prev, [file.name]: 0 }));
            const res = await fetch('http://localhost:5000/api/files/upload', {
              method: 'POST',
              headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
              body: formData
            });

            if (res.ok) {
              setUploadProgress(prev => ({ ...prev, [file.name]: 100 }));
              toast.success(`${file.name} uploaded`);
              await fetchFiles();
            } else {
              throw new Error('Upload failed');
            }
          } catch (err) {
            setUploadProgress(prev => ({ ...prev, [file.name]: 0 }));
            toast.error(`Error uploading ${file.name}: ${err.message}`);
          }
        }
      } else if (uploadMode === 'url') {
        // Handle URL upload
        const uploadData = {
          url: urlInput.trim(),
          categoryId: selectedCategoryForUpload || ''
          // Description is optional, don't include if not provided
        };

        const res = await fetch('http://localhost:5000/api/files/upload-link', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(uploadData)
        });

        if (res.ok) {
          toast.success('URL uploaded successfully');
          await fetchFiles();
          setUrlInput('');
        } else {
          try {
            const errorText = await res.text();
            console.error('URL upload error response:', {
              status: res.status,
              statusText: res.statusText,
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
              errorData = { message: `URL upload failed: ${res.status}` };
            }
            throw new Error(errorData.message || 'URL upload failed');
          } catch (parseError) {
            console.error('URL error response parse failed:', parseError);
            throw new Error(`URL upload failed: ${res.status} - ${res.statusText}`);
          }
        }
      }
    } catch (err) {
      toast.error(`Error: ${err.message}`);
    }

    if (uploadMode === 'file') {
      setUploadFiles([]);
      setUploadProgress({});
    }
    setShowUploadModal(false);
  };


  const statsData = stats ? [
    { name: 'DIET', value: stats.categoryCounts?.['DIET'] || 0 },
    { name: 'Registry', value: stats.categoryCounts?.['Registry'] || 0 },
    { name: 'UTILITY', value: stats.categoryCounts?.['UTILITY'] || 0 },
    { name: 'Uncategorized', value: stats.totalFiles - (stats.categoryCounts?.['DIET'] || 0) - (stats.categoryCounts?.['Registry'] || 0) - (stats.categoryCounts?.['UTILITY'] || 0) }
  ] : [];

  const sizeData = stats ? Object.entries(stats.sizeDistribution || {}).map(([name, value]) => ({ name, value })) : [];

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-gray-900">Loading admin panel...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-red-600 p-4 bg-red-50 rounded-lg">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-4">
      <Toaster />
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Admin File Management</h1>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => window.location.href = '/admin-links'}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-900 border border-gray-200 rounded-md hover:bg-gray-200 transition-colors"
            >
              <Link className="w-4 h-4" />
              <span>Manage Links</span>
            </button>
            <button onClick={() => setShowUploadModal(true)} className="inline-flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-900 border border-gray-200 rounded-md hover:bg-gray-200 transition-colors">
              <Upload className="w-4 h-4" />
              <span>Upload Files</span>
            </button>
            <button onClick={() => setShowSidebar(!showSidebar)} className="inline-flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-900 border border-gray-200 rounded-md hover:bg-gray-200 transition-colors">
              <BarChart3 className="w-4 h-4" />
              <span>Stats</span>
            </button>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-600" />
              <input
                type="text"
                placeholder="Search files..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-muted-foreground focus:ring-2 focus:ring-primary focus:border-transparent w-64"
              />
            </div>
            {selectedFiles.size > 0 && (
              <div className="flex items-center space-x-2 bg-destructive/10 text-destructive px-3 py-1 rounded">
                <span>{selectedFiles.size} selected</span>
                <select value={bulkAction} onChange={(e) => setBulkAction(e.target.value)} className="bg-transparent border-none">
                  <option value="">Actions</option>
                  <option value="move">Move to category</option>
                  <option value="delete">Delete</option>
                </select>
                <button onClick={handleBulkAction} className="px-3 py-1 bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/80 transition-colors text-sm">
                  Apply
                </button>
              </div>
            )}
          </div>
        </div>
        
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {categories.map((category) => {
              const categoryFiles = getFilesByCategory(category._id);
              const isAllSelected = categoryFiles.every(file => selectedFiles.has(file._id));
              return (
                <div key={category._id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                  {/* Category Header */}
                  <div className="bg-gray-50 border-b border-gray-200 p-4 sticky top-0 z-10">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-8 bg-primary rounded" />
                        <div>
                          <h2 className="text-lg font-semibold text-gray-900">{category.name}</h2>
                          <p className="text-sm text-gray-600">{category.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 text-sm text-gray-600">
                        <button onClick={() => selectAllInCategory(category._id)} className="p-1">
                          {isAllSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                        </button>
                        <span>{categoryFiles.length} files</span>
                        <Folder className="w-4 h-4" />
                      </div>
                    </div>
                    {/* Sorting Headers */}
                    <div className="flex space-x-4 mt-2 text-xs text-gray-600">
                      <button onClick={() => handleSort('originalName')} className="flex items-center space-x-1 hover:text-gray-900">
                        <span>Name</span>
                        {sortConfig.key === 'originalName' && <ChevronUp className={`w-3 h-3 ${sortConfig.direction === 'asc' ? 'text-primary' : 'text-gray-600'}`} />}
                      </button>
                      <button onClick={() => handleSort('uploadedAt')} className="flex items-center space-x-1 hover:text-gray-900">
                        <span>Date</span>
                        {sortConfig.key === 'uploadedAt' && <ChevronUp className={`w-3 h-3 ${sortConfig.direction === 'asc' ? 'text-primary' : 'text-gray-600'}`} />}
                      </button>
                      <button onClick={() => handleSort('size')} className="flex items-center space-x-1 hover:text-gray-900">
                        <span>Size</span>
                        {sortConfig.key === 'size' && <ChevronUp className={`w-3 h-3 ${sortConfig.direction === 'asc' ? 'text-primary' : 'text-gray-600'}`} />}
                      </button>
                    </div>
                  </div>

                  {/* File Cards - Droppable */}
                  <Droppable droppableId={category._id} type="file">
                    {(provided, snapshot) => (
                      <div 
                        className={`p-4 space-y-3 max-h-[600px] overflow-y-auto ${snapshot.isDraggingOver ? 'bg-accent/10' : ''}`}
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                      >
                        {categoryFiles.length === 0 ? (
                          <div className="text-center py-8 text-gray-600">
                            No files in this category. Drag files here to add.
                          </div>
                        ) : (
                          categoryFiles.map((file, index) => (
                            <Draggable key={file._id} draggableId={file._id} index={index}>
                              {(provided, snapshot) => (
                                <motion.div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className={`bg-white rounded-lg p-3 border border-gray-200 cursor-move transition-all ${
                                    snapshot.isDragging ? 'shadow-lg opacity-80 scale-105' : 'hover:shadow-md'
                                  } ${selectedFiles.has(file._id) ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                                  role="button"
                                  tabIndex={0}
                                  aria-label={`Drag ${file.originalName || file.filename} to reorder or move category`}
                                  initial={false}
                                  animate={{ scale: snapshot.isDragging ? 1.05 : 1 }}
                                  whileHover={{ scale: 1.02 }}
                                  onClick={() => handleFileClick(file)}
                                >
                                  <div className="flex items-start space-x-3">
                                    <button onClick={(e) => { e.stopPropagation(); toggleFileSelection(file._id); }} className="flex-shrink-0 mt-1">
                                      {selectedFiles.has(file._id) ? <CheckSquare className="w-5 h-5 text-primary" /> : <Square className="w-5 h-5 text-gray-600" />}
                                    </button>
                                    <div className="flex-shrink-0 w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center mt-1">
                                      {file.type === 'url' ? (
                                        <Download className="w-5 h-5 text-gray-600" />
                                      ) : (
                                        <File className="w-5 h-5 text-gray-600" />
                                      )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <h3 className="font-medium text-gray-900 truncate" title={file.originalName || file.filename}>
                                        {file.originalName || file.filename}
                                      </h3>
                                      <p className="text-sm text-gray-600 mt-1">
                                        Size: {bytesToSize(file.size)} • Uploaded: {formatDate(file.uploadedAt)} • Downloads: {file.downloadCount}
                                      </p>
                                      {file.description && (
                                        <p className="text-xs text-gray-600 mt-1">{file.description}</p>
                                      )}
                                    </div>
                                    <div className="flex space-x-2">
                                      <Button variant="ghost" size="sm" className="p-1">
                                        <Edit className="w-4 h-4" />
                                      </Button>
                                      <Button variant="ghost" size="sm" className="p-1">
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                      <Button variant="ghost" size="sm" className="p-1">
                                        <Eye className="w-4 h-4" />
                                      </Button>
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                            </Draggable>
                          ))
                        )}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })}
          </div>
        </DragDropContext>

        {/* Stats Sidebar */}
        <AnimatePresence>
          {showSidebar && (
            <motion.div
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              className="fixed left-0 top-0 h-full w-80 bg-white border-r border-gray-200 shadow-lg z-50 overflow-y-auto"
            >
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-gray-900">Statistics</h2>
                  <button onClick={() => setShowSidebar(false)} className="p-1 rounded-md hover:bg-gray-100 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="p-4 space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Category Distribution</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={statsData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} fill="#8884d8" label />
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">File Sizes</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={sizeData}>
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip formatter={(value) => bytesToSize(value)} />
                      <Legend />
                      <Bar dataKey="value" fill="#10D9C4" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="text-sm text-gray-600 space-y-1">
                  <p>Total Files: {stats?.totalFiles || 0}</p>
                  <p>Total Size: {bytesToSize(stats?.totalSize || 0)}</p>
                  <p>Average Downloads: {stats?.averageDownloads?.toFixed(1) || 0}</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Overlay for sidebar */}
        <AnimatePresence>
          {showSidebar && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSidebar(false)}
              className="fixed inset-0 bg-gray-900/50 z-40 md:hidden"
            />
          )}
        </AnimatePresence>

        {/* File Details Modal */}
        <AnimatePresence>
          {selectedFile && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50"
              onClick={() => setSelectedFile(null)}
              role="dialog"
              aria-modal="true"
              aria-label={`Details for ${selectedFile.originalName || selectedFile.filename}`}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-card rounded-lg max-w-4xl max-h-[90vh] overflow-y-auto w-full"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="sticky top-0 bg-gray-50 border-b border-gray-200 p-4 z-10">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-gray-900">
                      {selectedFile.originalName || selectedFile.filename}
                    </h2>
                    <button
                      onClick={() => setSelectedFile(null)}
                      className="text-gray-600 hover:text-gray-900 p-2 rounded-full hover:bg-gray-100 transition-colors"
                      aria-label="Close modal"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">
                        <strong>Filename:</strong> {selectedFile.filename}
                      </p>
                      <p className="text-sm text-gray-600">
                        <strong>Size:</strong> {bytesToSize(selectedFile.size)}
                      </p>
                      <p className="text-sm text-gray-600">
                        <strong>Uploaded:</strong> {formatDate(selectedFile.uploadedAt)}
                      </p>
                      <p className="text-sm text-gray-600">
                        <strong>Downloads:</strong> {selectedFile.downloadCount}
                      </p>
                      <p className="text-sm text-gray-600">
                        <strong>Category:</strong> {selectedFile.categoryId?.name || 'Uncategorized'}
                      </p>
                      {selectedFile.description && (
                        <p className="text-sm text-gray-600">
                          <strong>Description:</strong> {selectedFile.description}
                        </p>
                      )}
                    </div>
                    <div>
                      {selectedFile.type === 'url' ? (
                        <a href={selectedFile.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center space-x-1">
                          <Download className="w-4 h-4" />
                          <span>Open URL</span>
                        </a>
                      ) : (
                        selectedFile.metadata?.previewUrl && selectedFile.metadata.type?.startsWith('image/') ? (
                          <img src={selectedFile.metadata.previewUrl} alt="Preview" className="max-w-full h-48 object-cover rounded" />
                        ) : selectedFile.metadata?.type === 'text/plain' ? (
                          <pre className="bg-gray-100 p-4 rounded text-sm max-h-48 overflow-y-auto text-gray-900">
                            {selectedFile.metadata.previewContent || 'No preview available'}
                          </pre>
                        ) : (
                          <div className="text-gray-600 text-center py-8">
                            Preview not available for this file type. <a href={`/api/files/download/${selectedFile._id}`} className="text-primary hover:underline inline-flex items-center space-x-1">
                              <Download className="w-4 h-4" />
                              <span>Download to view</span>
                            </a>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-gray-600">
                    <strong>Metadata:</strong>
                    <pre className="bg-gray-100 p-2 rounded mt-2 text-xs overflow-x-auto">
                      {JSON.stringify(selectedFile.metadata, null, 2)}
                    </pre>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Upload Modal */}
        <AnimatePresence>
          {showUploadModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50"
              onClick={() => setShowUploadModal(false)}
              role="dialog"
              aria-modal="true"
              aria-label="Upload files or URLs modal"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="sticky top-0 bg-gray-50 border-b border-gray-200 p-4 z-10">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-gray-900">Upload Files & Links</h2>
                    <button
                      onClick={() => setShowUploadModal(false)}
                      className="text-gray-600 hover:text-gray-900 p-2 rounded-full hover:bg-gray-100 transition-colors"
                      aria-label="Close upload modal"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                <div className="p-6 space-y-4">
                  {/* Upload Mode Tabs */}
                  <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
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

                  {/* File Upload Tab */}
                  {uploadMode === 'file' && (
                    <>
                      <div
                        className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center hover:border-primary transition-colors"
                        onDrop={(e) => {
                          e.preventDefault();
                          handleUploadFiles(e);
                        }}
                        onDragOver={(e) => e.preventDefault()}
                      >
                        <Upload className="mx-auto h-12 w-12 text-gray-600 mb-4" />
                        <p className="text-gray-900 mb-2">Drag and drop files here, or click to select</p>
                        <input
                          type="file"
                          multiple
                          onChange={handleUploadFiles}
                          className="hidden"
                          id="file-upload"
                        />
                        <label htmlFor="file-upload" className="cursor-pointer bg-primary text-primary-foreground px-4 py-2 rounded hover:bg-primary/90 inline-flex items-center space-x-2">
                          <Upload className="w-4 h-4" />
                          <span>Select Files</span>
                        </label>
                      </div>
                      {uploadFiles.length > 0 && (
                        <div className="space-y-2">
                          <h3 className="text-lg font-medium text-gray-900">Selected Files ({uploadFiles.length})</h3>
                          <div className="space-y-1">
                            {uploadFiles.map((file) => (
                              <div key={file.name} className="flex items-center justify-between text-sm">
                                <span className="text-gray-900 truncate">{file.name}</span>
                                <div className="flex items-center space-x-2">
                                  <div className="w-16 bg-gray-100 rounded-full overflow-hidden">
                                    <div
                                      className="h-2 bg-primary rounded-full transition-all duration-300"
                                      style={{ width: `${uploadProgress[file.name] || 0}%` }}
                                    />
                                  </div>
                                  <span className="text-gray-600">{uploadProgress[file.name] || 0}%</span>
                                  <button
                                    onClick={() => setUploadFiles(prev => prev.filter(f => f.name !== file.name))}
                                    className="text-destructive hover:text-destructive/80 p-1 rounded hover:bg-destructive/10 transition-colors"
                                    aria-label={`Remove ${file.name}`}
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* URL Upload Tab */}
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
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent"
                          required
                        />
                        <p className="text-sm text-gray-600 mt-1">
                          Enter the direct download URL for the file you want to share
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Category Selection (common for both modes) */}
                  <div className="flex items-center space-x-2">
                    <label className="text-sm text-gray-600">Assign to category:</label>
                    <select
                      value={selectedCategoryForUpload}
                      onChange={(e) => setSelectedCategoryForUpload(e.target.value)}
                      className="bg-white border border-gray-300 rounded px-3 py-1 text-gray-900"
                    >
                      <option value="">No category</option>
                      {categories.map(cat => (
                        <option key={cat._id} value={cat._id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-end space-x-2">
                    <button
                      onClick={() => {
                        setShowUploadModal(false);
                        setUploadFiles([]);
                        setUploadProgress({});
                        setUrlInput('');
                      }}
                      className="px-4 py-2 bg-gray-100 text-gray-900 border border-gray-200 rounded-md hover:bg-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={uploadSelectedFiles}
                      disabled={
                        (uploadMode === 'file' && uploadFiles.length === 0) ||
                        (uploadMode === 'url' && !urlInput.trim())
                      }
                      className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {uploadMode === 'file'
                        ? `Upload ${uploadFiles.length} file${uploadFiles.length !== 1 ? 's' : ''}`
                        : 'Upload Link'
                      }
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
