import { useEffect, useState } from "react";
import { bytesToSize } from "../utils/formatters.js";
import Navbar from "./Navbar.jsx";
import { Download, ExternalLink, Link as LinkIcon } from "lucide-react";

// Use environment variable for API base URL, fallback to production URL
const API_BASE = import.meta.env.REACT_APP_API_URL || 'https://quant-file-dist.onrender.com';

export default function DownloadPage() {
  const [files, setFiles] = useState([]);
  const [links, setLinks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [downloading, setDownloading] = useState(new Set());
  const [activeTab, setActiveTab] = useState('files'); // 'files' or 'links'
  const [linkSearchTerm, setLinkSearchTerm] = useState('');
  const [linkSortBy, setLinkSortBy] = useState('uploadedAt');
  const [linkSortOrder, setLinkSortOrder] = useState('desc');
  const [linkCurrentPage, setLinkCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const linksPerPage = 10;


  const fetchFiles = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE}/files`);
      if (!res.ok) throw new Error('Failed to fetch files');
      const data = await res.json();
      // Filter out URL-type files (links) from the files array
      const actualFiles = data.filter(file => file.type !== 'url');
      setFiles(actualFiles);
    } catch (err) {
      setError('Error loading files: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchLinks = async () => {
    try {
      const params = new URLSearchParams();
      params.append('isActive', 'true');

      // Get auth token for links API
      const token = localStorage.getItem('token');
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

      const res = await fetch(`${API_BASE}/links?${params}`, { headers });
      if (!res.ok) throw new Error('Failed to fetch links');
      const data = await res.json();
      console.log('Links API response:', data);
      setLinks(data.links || []);
    } catch (err) {
      console.error('Error loading links:', err.message);
      setError('Failed to load links: ' + err.message);
    }
  };


  const fetchCategories = async () => {
    try {
      const res = await fetch(`${API_BASE}/categories/public`);
      if (!res.ok) throw new Error('Failed to fetch categories');
      const data = await res.json();
      setCategories(data);
    } catch (err) {
      console.error('Error loading categories:', err.message);
    }
  };


  useEffect(() => {
    fetchFiles();
    fetchLinks();
    fetchCategories();
  }, []);


  const handleDownload = async (itemId, itemType) => {
    setDownloading(prev => new Set([...prev, itemId]));
    try {
      if (itemType === 'file') {
        const response = await fetch(`${API_BASE}/files/download/${itemId}`);

        if (!response.ok) {
          throw new Error('Download failed');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = itemId;
        link.setAttribute('aria-label', `Download ${files.find(f => f._id === itemId)?.filename}`);

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        window.URL.revokeObjectURL(url);
      } else if (itemType === 'link') {
        // For links, increment download count and redirect to external URL
        await fetch(`${API_BASE}/links/${itemId}/download`, {
          method: 'POST'
        });

        const linkItem = links.find(l => l._id === itemId);
        if (linkItem) {
          window.open(linkItem.downloadUrl, '_blank');
        }
      }
    } catch (err) {
      setError(`Error downloading ${itemType}: ` + err.message);
    } finally {
      setDownloading(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
    }
  };

  const handleLinkOpen = async (linkItem) => {
    try {
      // Validate URL before opening
      if (!linkItem.downloadUrl || !linkItem.downloadUrl.trim()) {
        setError('This link appears to be broken or missing');
        return;
      }

      // Try to validate URL format
      try {
        new URL(linkItem.downloadUrl);
      } catch {
        setError('This link has an invalid URL format');
        return;
      }

      // Increment download count with auth header
      const token = localStorage.getItem('token');
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

      await fetch(`${API_BASE}/links/${linkItem._id}/download`, {
        method: 'POST',
        headers
      });

      // Open link in new tab
      window.open(linkItem.downloadUrl, '_blank');
    } catch (err) {
      console.error('Error opening link:', err);
      setError('Failed to open link: ' + err.message);
    }
  };


  const handleSort = (key) => {
    if (sortBy === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setSortOrder('asc');
    }
  };

  const handleLinkSort = (key) => {
    if (linkSortBy === key) {
      setLinkSortOrder(linkSortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setLinkSortBy(key);
      setLinkSortOrder('asc');
    }
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handleLinkPageChange = (page) => {
    setLinkCurrentPage(page);
  };

  // Filter and sort files
  const filteredFiles = files.filter(file => {
    const searchFields = [file.filename, file.originalName, file.description];
    const matchesSearch = searchTerm === '' || searchFields.some(field =>
      field?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    return matchesSearch;
  }).sort((a, b) => {
    let aVal, bVal;

    if (sortBy === 'name') {
      aVal = a.originalName || a.filename;
      bVal = b.originalName || b.filename;
    } else if (sortBy === 'size') {
      aVal = a.size || 0;
      bVal = b.size || 0;
    } else if (sortBy === 'uploadedAt') {
      aVal = new Date(a.uploadedAt);
      bVal = new Date(b.uploadedAt);
    } else {
      aVal = a[sortBy] || '';
      bVal = b[sortBy] || '';
    }

    if (typeof aVal === 'string') {
      aVal = aVal.toLowerCase();
      bVal = bVal.toLowerCase();
    }

    if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  // Filter and sort links from the dedicated links API
  const filteredLinks = links.filter(link => {
    const searchFields = [link.name, link.description, link.version, link.downloadUrl];
    const matchesSearch = linkSearchTerm === '' || searchFields.some(field =>
      field?.toLowerCase().includes(linkSearchTerm.toLowerCase())
    );
    return matchesSearch;
  }).sort((a, b) => {
    let aVal, bVal;

    if (linkSortBy === 'name') {
      aVal = a.name || '';
      bVal = b.name || '';
    } else if (linkSortBy === 'description') {
      aVal = a.description || '';
      bVal = b.description || '';
    } else if (linkSortBy === 'createdAt') {
      aVal = new Date(a.createdAt);
      bVal = new Date(b.createdAt);
    } else if (linkSortBy === 'downloadCount') {
      aVal = a.downloadCount || 0;
      bVal = b.downloadCount || 0;
    } else {
      aVal = a[linkSortBy] || '';
      bVal = b[linkSortBy] || '';
    }

    if (typeof aVal === 'string') {
      aVal = aVal.toLowerCase();
      bVal = bVal.toLowerCase();
    }

    if (aVal < bVal) return linkSortOrder === 'asc' ? -1 : 1;
    if (aVal > bVal) return linkSortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const totalPages = Math.ceil(filteredFiles.length / itemsPerPage);
  const paginatedFiles = filteredFiles.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const linkTotalPages = Math.ceil(filteredLinks.length / linksPerPage);
  const paginatedLinks = filteredLinks.slice((linkCurrentPage - 1) * linksPerPage, linkCurrentPage * linksPerPage);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-16">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-light text-gray-900 mb-6">
            Available Files,{' '}
            <span className="text-green-500 font-normal">the simple way.</span>
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
            File Server is a clean, simple file sharing platform designed to make 
            downloading files effortless and secure.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex justify-center mb-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-1">
            <button
              onClick={() => setActiveTab('files')}
              className={`px-6 py-2 rounded-md font-medium transition-colors ${
                activeTab === 'files'
                  ? 'bg-green-500 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Files ({files.filter(f => f.type !== 'url').length})
            </button>
            <button
              onClick={() => setActiveTab('links')}
              className={`px-6 py-2 rounded-md font-medium transition-colors ${
                activeTab === 'links'
                  ? 'bg-purple-500 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Links ({links.length})
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col lg:flex-row gap-4 max-w-4xl mx-auto mb-12">
          <div className="relative flex-1">
            <input
              type="search"
              placeholder={activeTab === 'files' ? "Search files..." : "Search links..."}
              value={activeTab === 'files' ? searchTerm : linkSearchTerm}
              onChange={(e) => activeTab === 'files' ? setSearchTerm(e.target.value) : setLinkSearchTerm(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
              aria-label={activeTab === 'files' ? "Search files" : "Search links"}
            />
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Stats Display */}
        <div className="flex justify-center space-x-6 mb-8 text-sm text-gray-600">
          <span className="flex items-center">
            <Download className="w-4 h-4 mr-2" />
            {files.length} Files
          </span>
          <span className="flex items-center">
            <LinkIcon className="w-4 h-4 mr-2" />
            {links.length} Links
          </span>
          <span className="flex items-center">
            Total: {files.length + links.length} Items
          </span>
        </div>

        {/* Error Display */}
        {error && (
          <div className="max-w-md mx-auto mb-8 p-4 bg-red-50 bg-red-50 border border-red-200 border-red-200 rounded-lg" role="alert">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-400 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="text-red-700 text-red-700">{error}</span>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="text-center py-16" role="status" aria-live="polite">
            <div className="inline-block w-8 h-8 border-2 border-gray-300 border-t-green-500 rounded-full animate-spin mb-4"></div>
            <p className="text-gray-600">Loading content...</p>
          </div>
        ) : (activeTab === 'files' ? filteredFiles : filteredLinks).length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              {activeTab === 'files' ? (
                <Download className="w-8 h-8 text-gray-400" />
              ) : (
                <LinkIcon className="w-8 h-8 text-gray-400" />
              )}
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No {activeTab === 'files' ? 'files' : 'links'} found
            </h3>
            <p className="text-gray-600">
              {linkSearchTerm || searchTerm ? 'Try adjusting your search.' : `No ${activeTab === 'files' ? 'files' : 'links'} have been uploaded yet.`}
            </p>
          </div>
        ) : activeTab === 'files' ? (
          <>
            {/* Files Table */}
            <div className="overflow-x-auto bg-white rounded-lg shadow-lg">
              <table className="w-full table-auto">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      onClick={() => handleSort('name')}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700"
                    >
                      Name
                      {sortBy === 'name' && (
                        <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                      Description
                    </th>
                    <th
                      onClick={() => handleSort('uploadedAt')}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700"
                    >
                      Date
                      {sortBy === 'uploadedAt' && (
                        <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </th>
                    <th
                      onClick={() => handleSort('size')}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700 hidden md:table-cell"
                    >
                      Size
                      {sortBy === 'size' && (
                        <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {paginatedFiles.map((file) => (
                    <tr key={file._id} className="hover:bg-gray-50 transition-colors">
                      {/* Name Column */}
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-gray-900 truncate" title={file.originalName || file.filename}>
                              {file.originalName || file.filename}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Description Column */}
                      <td className="px-6 py-4 hidden md:table-cell">
                        <div className="text-sm text-gray-500 max-w-xs truncate" title={file.description}>
                          {file.description || '-'}
                        </div>
                      </td>

                      {/* Date Column */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {new Date(file.uploadedAt).toLocaleDateString()}
                        </div>
                      </td>

                      {/* Size Column */}
                      <td className="px-6 py-4 whitespace-nowrap hidden md:table-cell">
                        <div className="text-sm text-gray-900">
                          {bytesToSize(file.size)}
                        </div>
                      </td>

                      {/* Action Column */}
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleDownload(file._id, 'file')}
                          disabled={downloading.has(file._id)}
                          className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50 flex items-center space-x-2"
                          aria-label={`Download ${file.originalName || file.filename}`}
                        >
                          <Download className="w-4 h-4" />
                          <span>{downloading.has(file._id) ? 'Downloading...' : 'Download'}</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between mt-8 gap-4">
                <div className="text-sm text-gray-600">
                  Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredFiles.length)} of {filteredFiles.length} files
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handlePageChange(Math.max(currentPage - 1, 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                  >
                    Previous
                  </button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    const page = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
                    return (
                      <button
                        key={page}
                        onClick={() => handlePageChange(page)}
                        className={`px-3 py-2 border rounded-lg transition-colors ${
                          currentPage === page
                            ? 'border-green-500 bg-green-50 text-green-600'
                            : 'border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {page}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => handlePageChange(Math.min(currentPage + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Links Table */}
            <div className="overflow-x-auto bg-white rounded-lg shadow-lg">
              <table className="w-full table-auto">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      onClick={() => handleLinkSort('filename')}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700"
                    >
                      Name
                      {linkSortBy === 'filename' && (
                        <span className="ml-1">{linkSortOrder === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                      Description
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      URL
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                      Category
                    </th>
                    <th
                      onClick={() => handleLinkSort('uploadedAt')}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700"
                    >
                      Date
                      {linkSortBy === 'uploadedAt' && (
                        <span className="ml-1">{linkSortOrder === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </th>
                    <th
                      onClick={() => handleLinkSort('downloadCount')}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700 hidden md:table-cell"
                    >
                      Downloads
                      {linkSortBy === 'downloadCount' && (
                        <span className="ml-1">{linkSortOrder === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {paginatedLinks.map((link) => (
                    <tr key={link._id} className="hover:bg-gray-50 transition-colors">
                      {/* Name Column */}
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-gray-900 truncate" title={link.name}>
                              {link.name}
                            </div>
                            {link.version && (
                              <span className="text-xs text-gray-500">v{link.version}</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Description Column */}
                      <td className="px-6 py-4 hidden md:table-cell">
                        <div className="text-sm text-gray-500 max-w-xs truncate" title={link.description}>
                          {link.description || '-'}
                        </div>
                      </td>

                      {/* URL Column */}
                      <td className="px-6 py-4">
                        <div className="text-sm text-purple-600 max-w-xs truncate" title={link.downloadUrl}>
                          {link.downloadUrl}
                        </div>
                      </td>

                      {/* Category Column */}
                      <td className="px-6 py-4 whitespace-nowrap hidden lg:table-cell">
                        <div className="text-sm text-gray-900">
                          {link.categoryId?.name || 'Uncategorized'}
                        </div>
                      </td>

                      {/* Date Column */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {new Date(link.createdAt).toLocaleDateString()}
                        </div>
                      </td>

                      {/* Downloads Column */}
                      <td className="px-6 py-4 whitespace-nowrap hidden md:table-cell">
                        <div className="text-sm text-gray-900">
                          {link.downloadCount || 0}
                        </div>
                      </td>

                      {/* Action Column */}
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleLinkOpen(link)}
                          className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-lg transition-colors flex items-center space-x-2"
                          aria-label={`Open link ${link.name}`}
                        >
                          <ExternalLink className="w-4 h-4" />
                          <span>Open Link</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Links Pagination */}
            {linkTotalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between mt-8 gap-4">
                <div className="text-sm text-gray-600">
                  Showing {((linkCurrentPage - 1) * linksPerPage) + 1} to {Math.min(linkCurrentPage * linksPerPage, filteredLinks.length)} of {filteredLinks.length} links
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleLinkPageChange(Math.max(linkCurrentPage - 1, 1))}
                    disabled={linkCurrentPage === 1}
                    className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                  >
                    Previous
                  </button>
                  {Array.from({ length: Math.min(linkTotalPages, 5) }, (_, i) => {
                    const page = Math.max(1, Math.min(linkTotalPages - 4, linkCurrentPage - 2)) + i;
                    return (
                      <button
                        key={page}
                        onClick={() => handleLinkPageChange(page)}
                        className={`px-3 py-2 border rounded-lg transition-colors ${
                          linkCurrentPage === page
                            ? 'border-purple-500 bg-purple-50 text-purple-600'
                            : 'border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {page}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => handleLinkPageChange(Math.min(linkCurrentPage + 1, linkTotalPages))}
                    disabled={linkCurrentPage === linkTotalPages}
                    className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}

      </main>

      {/* Simple Footer */}
      <footer className="mt-24 py-8 border-t border-gray-200">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <p className="text-gray-500 text-sm">
            Powered by modern file sharing technology
          </p>
        </div>
      </footer>
    </div>
  );
}