import { useState, useEffect } from "react";
import { useStore } from "../stores/adminStore";
import { Button } from "../components/ui/button";
import {
  Plus,
  Edit,
  Trash2,
  Search,
  ExternalLink,
  Download,
  Filter,
  X,
  Save,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Toaster, toast } from "sonner";

export default function AdminLinkManager() {
  const {
    links,
    categories,
    linkLoading,
    linkError,
    fetchLinks,
    fetchCategories,
    createLink,
    updateLink,
    deleteLink,
    getLinkStats
  } = useStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingLink, setEditingLink] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'createdAt', direction: 'desc' });
  const [stats, setStats] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    version: '',
    description: '',
    downloadUrl: '',
    categoryId: '',
    tags: '',
    fileSize: '',
    platform: 'Universal'
  });

  useEffect(() => {
    fetchLinks({
      search: searchTerm,
      categoryId: selectedCategory,
      platform: selectedPlatform,
      isActive: showInactive ? undefined : true
    });
    fetchCategories();
    getLinkStats().then(setStats);
  }, [searchTerm, selectedCategory, selectedPlatform, showInactive]);

  const resetForm = () => {
    setFormData({
      name: '',
      version: '',
      description: '',
      downloadUrl: '',
      categoryId: '',
      tags: '',
      fileSize: '',
      platform: 'Universal'
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name || !formData.version || !formData.downloadUrl) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const linkData = {
        ...formData,
        tags: formData.tags ? formData.tags.split(',').map(tag => tag.trim()) : []
      };

      if (editingLink) {
        await updateLink(editingLink._id, linkData);
        toast.success('Link updated successfully');
      } else {
        await createLink(linkData);
        toast.success('Link created successfully');
      }

      setShowAddModal(false);
      setEditingLink(null);
      resetForm();
      fetchLinks();
    } catch (error) {
      toast.error(error.message || 'An error occurred');
    }
  };

  const handleEdit = (link) => {
    setEditingLink(link);
    setFormData({
      name: link.name,
      version: link.version,
      description: link.description,
      downloadUrl: link.downloadUrl,
      categoryId: link.categoryId?._id || '',
      tags: link.tags?.join(', ') || '',
      fileSize: link.fileSize || '',
      platform: link.platform || 'Universal'
    });
    setShowAddModal(true);
  };

  const handleDelete = async (linkId) => {
    if (confirm('Are you sure you want to delete this link?')) {
      try {
        await deleteLink(linkId);
        toast.success('Link deleted successfully');
        fetchLinks();
      } catch (error) {
        toast.error(error.message || 'Failed to delete link');
      }
    }
  };

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const sortedLinks = [...links].sort((a, b) => {
    const aVal = a[sortConfig.key];
    const bVal = b[sortConfig.key];

    if (sortConfig.key === 'categoryId') {
      const aName = a.categoryId?.name || '';
      const bName = b.categoryId?.name || '';
      return sortConfig.direction === 'asc'
        ? aName.localeCompare(bName)
        : bName.localeCompare(aName);
    }

    if (aVal < bVal) {
      return sortConfig.direction === 'asc' ? -1 : 1;
    }
    if (aVal > bVal) {
      return sortConfig.direction === 'asc' ? 1 : -1;
    }
    return 0;
  });

  const platforms = ['Windows', 'macOS', 'Linux', 'Android', 'iOS', 'Universal'];

  if (linkLoading && links.length === 0) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-gray-900">Loading link manager...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-4">
      <Toaster />
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Download Link Manager</h1>
            {stats && (
              <p className="text-gray-600 mt-1">
                {stats.totalLinks} links • {stats.totalDownloads} total downloads
              </p>
            )}
          </div>
          <Button onClick={() => setShowAddModal(true)} className="inline-flex items-center space-x-2">
            <Plus className="w-4 h-4" />
            <span>Add Link</span>
          </Button>
        </div>

        {/* Filters */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-600" />
              <input
                type="text"
                placeholder="Search links..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 w-full bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-600 focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="">All Categories</option>
              {categories.map(cat => (
                <option key={cat._id} value={cat._id}>{cat.name}</option>
              ))}
            </select>

            <select
              value={selectedPlatform}
              onChange={(e) => setSelectedPlatform(e.target.value)}
              className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="">All Platforms</option>
              {platforms.map(platform => (
                <option key={platform} value={platform}>{platform}</option>
              ))}
            </select>

            <label className="flex items-center space-x-2 text-gray-700">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="rounded border-gray-300 text-primary focus:ring-primary"
              />
              <span>Show inactive</span>
            </label>
          </div>
        </div>

        {/* Error Display */}
        {linkError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-600">{linkError}</p>
          </div>
        )}

        {/* Links Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left">
                    <button
                      onClick={() => handleSort('name')}
                      className="flex items-center space-x-1 text-xs font-medium text-gray-700 uppercase tracking-wider hover:text-gray-900"
                    >
                      <span>Name</span>
                      {sortConfig.key === 'name' && (
                        sortConfig.direction === 'asc' ?
                          <ChevronUp className="w-3 h-3" /> :
                          <ChevronDown className="w-3 h-3" />
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left">
                    <button
                      onClick={() => handleSort('version')}
                      className="flex items-center space-x-1 text-xs font-medium text-gray-700 uppercase tracking-wider hover:text-gray-900"
                    >
                      <span>Version</span>
                      {sortConfig.key === 'version' && (
                        sortConfig.direction === 'asc' ?
                          <ChevronUp className="w-3 h-3" /> :
                          <ChevronDown className="w-3 h-3" />
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left">
                    <button
                      onClick={() => handleSort('categoryId')}
                      className="flex items-center space-x-1 text-xs font-medium text-gray-700 uppercase tracking-wider hover:text-gray-900"
                    >
                      <span>Category</span>
                      {sortConfig.key === 'categoryId' && (
                        sortConfig.direction === 'asc' ?
                          <ChevronUp className="w-3 h-3" /> :
                          <ChevronDown className="w-3 h-3" />
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left">
                    <span className="text-xs font-medium text-gray-700 uppercase tracking-wider">Platform</span>
                  </th>
                  <th className="px-6 py-3 text-left">
                    <button
                      onClick={() => handleSort('downloadCount')}
                      className="flex items-center space-x-1 text-xs font-medium text-gray-700 uppercase tracking-wider hover:text-gray-900"
                    >
                      <span>Downloads</span>
                      {sortConfig.key === 'downloadCount' && (
                        sortConfig.direction === 'asc' ?
                          <ChevronUp className="w-3 h-3" /> :
                          <ChevronDown className="w-3 h-3" />
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left">
                    <span className="text-xs font-medium text-gray-700 uppercase tracking-wider">Status</span>
                  </th>
                  <th className="px-6 py-3 text-left">
                    <span className="text-xs font-medium text-gray-700 uppercase tracking-wider">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                <AnimatePresence>
                  {sortedLinks.map((link) => (
                    <motion.tr
                      key={link._id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="hover:bg-gray-50"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{link.name}</div>
                            {link.description && (
                              <div className="text-sm text-gray-600 truncate max-w-xs">
                                {link.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{link.version}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {link.categoryId?.name || 'Uncategorized'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          {link.platform}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{link.downloadCount}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          link.isActive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {link.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium">
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(link.downloadUrl, '_blank')}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(link)}
                            className="text-indigo-600 hover:text-indigo-900"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(link._id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>

          {sortedLinks.length === 0 && !linkLoading && (
            <div className="text-center py-12">
              <Download className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No links found</h3>
              <p className="text-gray-600 mb-4">
                {searchTerm || selectedCategory || selectedPlatform
                  ? 'Try adjusting your filters or search terms.'
                  : 'Get started by creating your first download link.'}
              </p>
              {!searchTerm && !selectedCategory && !selectedPlatform && (
                <Button onClick={() => setShowAddModal(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Your First Link
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Add/Edit Modal */}
        <AnimatePresence>
          {showAddModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50"
              onClick={() => {
                setShowAddModal(false);
                setEditingLink(null);
                resetForm();
              }}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-gray-900">
                      {editingLink ? 'Edit Link' : 'Add New Link'}
                    </h2>
                    <button
                      onClick={() => {
                        setShowAddModal(false);
                        setEditingLink(null);
                        resetForm();
                      }}
                      className="text-gray-600 hover:text-gray-900 p-2 rounded-full hover:bg-gray-100 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Software Name *
                        </label>
                        <input
                          type="text"
                          value={formData.name}
                          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Version *
                        </label>
                        <input
                          type="text"
                          value={formData.version}
                          onChange={(e) => setFormData(prev => ({ ...prev, version: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Description
                      </label>
                      <textarea
                        value={formData.description}
                        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Download URL *
                      </label>
                      <input
                        type="url"
                        value={formData.downloadUrl}
                        onChange={(e) => setFormData(prev => ({ ...prev, downloadUrl: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Category
                        </label>
                        <select
                          value={formData.categoryId}
                          onChange={(e) => setFormData(prev => ({ ...prev, categoryId: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent"
                        >
                          <option value="">No Category</option>
                          {categories.map(cat => (
                            <option key={cat._id} value={cat._id}>{cat.name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Platform
                        </label>
                        <select
                          value={formData.platform}
                          onChange={(e) => setFormData(prev => ({ ...prev, platform: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent"
                        >
                          {platforms.map(platform => (
                            <option key={platform} value={platform}>{platform}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          File Size
                        </label>
                        <input
                          type="text"
                          value={formData.fileSize}
                          onChange={(e) => setFormData(prev => ({ ...prev, fileSize: e.target.value }))}
                          placeholder="e.g., 150 MB"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Tags (comma-separated)
                        </label>
                        <input
                          type="text"
                          value={formData.tags}
                          onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
                          placeholder="e.g., utility, productivity"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end space-x-3 pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setShowAddModal(false);
                          setEditingLink(null);
                          resetForm();
                        }}
                      >
                        Cancel
                      </Button>
                      <Button type="submit">
                        <Save className="w-4 h-4 mr-2" />
                        {editingLink ? 'Update Link' : 'Create Link'}
                      </Button>
                    </div>
                  </form>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}