import React, { useState, useEffect, useRef } from 'react';
import {
  BookOpen,
  UploadCloud,
  FileText,
  Trash2,
  Search,
  CheckCircle2,
  AlertCircle,
  X,
  Layers,
  Shield,
  Loader2,
  RefreshCw,
  Plus,
} from 'lucide-react';
import { kbApi } from '../lib/api';

interface KbDocument {
  id: string;
  title: string;
  source_file_url?: string;
  visibility_role: 'all' | 'salesperson' | 'manager' | 'manager_plus' | 'admin' | 'admin_only';
  uploaded_by: string;
  updated_at: string;
  chunk_count?: number;
}

interface KnowledgeBaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  isAdmin: boolean;
}

export default function KnowledgeBaseModal({
  isOpen,
  onClose,
  isAdmin,
}: KnowledgeBaseModalProps) {
  const [activeTab, setActiveTab] = useState<'library' | 'upload'>('library');
  const [documents, setDocuments] = useState<KbDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Upload Form State
  const [docTitle, setDocTitle] = useState('');
  const [docContent, setDocContent] = useState('');
  const [visibilityRole, setVisibilityRole] = useState<string>('all');
  const [fileName, setFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const res = await kbApi.listDocuments();
      const rawData = res.data?.data || res.data || [];
      const list: KbDocument[] = Array.isArray(rawData)
        ? rawData
        : Array.isArray(rawData?.documents)
        ? rawData.documents
        : [];
      setDocuments(list);
    } catch (err: any) {
      console.error('Failed to fetch KB documents:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchDocuments();
      setUploadSuccess(null);
      setUploadError(null);
    }
  }, [isOpen]);

  const handleFileUpload = (file: File) => {
    setFileName(file.name);
    if (!docTitle) {
      // Auto-populate title from filename without extension
      setDocTitle(file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '));
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setDocContent(content || '');
    };
    reader.onerror = () => {
      setUploadError('Failed to read selected file.');
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docTitle.trim() || !docContent.trim()) {
      setUploadError('Document title and content are required.');
      return;
    }

    try {
      setUploading(true);
      setUploadError(null);
      setUploadSuccess(null);

      const res = await kbApi.uploadDocument({
        title: docTitle.trim(),
        content: docContent.trim(),
        visibilityRole,
        sourceFileUrl: fileName || undefined,
      });

      const resData = res.data?.data || res.data;
      const chunksCount = resData?.chunkCount || 'Multiple';
      setUploadSuccess(
        `Successfully ingested "${docTitle}" into the Knowledge Base (${chunksCount} vector chunks generated)!`
      );

      // Reset form
      setDocTitle('');
      setDocContent('');
      setFileName(null);
      setVisibilityRole('all');
      if (fileInputRef.current) fileInputRef.current.value = '';

      // Refresh list and switch tab after short delay
      await fetchDocuments();
      setTimeout(() => {
        setActiveTab('library');
      }, 1800);
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        'Failed to ingest document.';
      setUploadError(msg);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docId: string) => {
    try {
      setDeleting(true);
      await kbApi.deleteDocument(docId);
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      setDeleteConfirmId(null);
    } catch (err: any) {
      alert(
        'Failed to delete document: ' +
          (err.response?.data?.message || err.message)
      );
    } finally {
      setDeleting(false);
    }
  };

  if (!isOpen) return null;

  const filteredDocuments = documents.filter(
    (d) =>
      d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.visibility_role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getVisibilityBadge = (role: string) => {
    switch (role) {
      case 'all':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            All Employees
          </span>
        );
      case 'salesperson':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-800 border border-blue-200">
            Sales Reps & Above
          </span>
        );
      case 'manager':
      case 'manager_plus':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-800 border border-purple-200">
            Managers & Admins
          </span>
        );
      case 'admin':
      case 'admin_only':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            Admin Only
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-700">
            {role}
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50/80">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
              <BookOpen size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                Knowledge Base Management
                <span className="text-[11px] font-normal px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                  RAG Vector Index
                </span>
              </h2>
              <p className="text-xs text-gray-500">
                Upload and index company SOPs, product catalogs, and policies for the AI Assistant.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center justify-between px-6 border-b border-gray-200 bg-white">
          <div className="flex space-x-6">
            <button
              onClick={() => setActiveTab('library')}
              className={`py-3 text-xs font-semibold border-b-2 flex items-center gap-2 transition-all ${
                activeTab === 'library'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-900'
              }`}
            >
              <Layers size={15} />
              <span>Document Library ({documents.length})</span>
            </button>
            {isAdmin && (
              <button
                onClick={() => setActiveTab('upload')}
                className={`py-3 text-xs font-semibold border-b-2 flex items-center gap-2 transition-all ${
                  activeTab === 'upload'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-900'
                }`}
              >
                <UploadCloud size={15} />
                <span>Upload & Ingest Document</span>
              </button>
            )}
          </div>
          {activeTab === 'library' && (
            <button
              onClick={fetchDocuments}
              className="text-xs text-gray-500 hover:text-blue-600 flex items-center gap-1.5 py-1 px-2.5 rounded-lg hover:bg-gray-100 transition-colors"
              title="Refresh library"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'library' ? (
            <div className="space-y-4">
              {/* Search Bar */}
              <div className="flex items-center justify-between gap-4">
                <div className="relative flex-1">
                  <Search
                    size={15}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search documents by title or visibility role..."
                    className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 placeholder-gray-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                  />
                </div>
                {isAdmin && (
                  <button
                    onClick={() => setActiveTab('upload')}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition-all shadow-xs shrink-0"
                  >
                    <Plus size={14} />
                    <span>Upload Document</span>
                  </button>
                )}
              </div>

              {/* Documents List */}
              {loading ? (
                <div className="py-12 flex flex-col items-center justify-center text-gray-400 space-y-2">
                  <Loader2 size={24} className="animate-spin text-blue-600" />
                  <p className="text-xs">Loading Knowledge Base documents...</p>
                </div>
              ) : filteredDocuments.length === 0 ? (
                <div className="py-12 text-center border-2 border-dashed border-gray-200 rounded-2xl p-6 bg-gray-50/50">
                  <BookOpen size={32} className="mx-auto text-gray-300 mb-2" />
                  <p className="text-sm font-semibold text-gray-700">
                    No documents found
                  </p>
                  <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                    {searchQuery
                      ? 'No documents matched your search criteria.'
                      : 'Your Knowledge Base is currently empty. Upload SOPs and policy guidelines to enhance AI answers.'}
                  </p>
                  {isAdmin && !searchQuery && (
                    <button
                      onClick={() => setActiveTab('upload')}
                      className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs"
                    >
                      Upload First Document
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {filteredDocuments.map((doc) => (
                    <div
                      key={doc.id}
                      className="p-4 bg-white border border-gray-200 rounded-xl hover:border-blue-200 hover:shadow-sm transition-all flex items-start justify-between gap-4"
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2.5 bg-slate-100 text-slate-700 rounded-xl shrink-0 mt-0.5">
                          <FileText size={18} />
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-bold text-gray-900">
                              {doc.title}
                            </h3>
                            {getVisibilityBadge(doc.visibility_role)}
                          </div>
                          <div className="flex items-center gap-4 text-[11px] text-gray-500">
                            <span className="flex items-center gap-1">
                              <Layers size={12} className="text-blue-500" />
                              <strong>{doc.chunk_count || 1}</strong> vector chunks
                            </span>
                            {doc.source_file_url && (
                              <span className="truncate max-w-[180px] text-gray-400">
                                Source: {doc.source_file_url}
                              </span>
                            )}
                            <span>
                              Updated:{' '}
                              {new Date(doc.updated_at).toLocaleDateString(
                                undefined,
                                { month: 'short', day: 'numeric', year: 'numeric' }
                              )}
                            </span>
                          </div>
                        </div>
                      </div>

                      {isAdmin && (
                        <div>
                          {deleteConfirmId === doc.id ? (
                            <div className="flex items-center gap-1.5 bg-red-50 p-1.5 rounded-lg border border-red-200">
                              <span className="text-[10px] text-red-700 font-semibold px-1">
                                Delete?
                              </span>
                              <button
                                onClick={() => handleDelete(doc.id)}
                                disabled={deleting}
                                className="px-2 py-0.5 bg-red-600 text-white rounded text-[10px] font-bold hover:bg-red-700 disabled:opacity-50"
                              >
                                Yes
                              </button>
                              <button
                                onClick={() => setDeleteConfirmId(null)}
                                className="px-2 py-0.5 bg-gray-200 text-gray-700 rounded text-[10px] hover:bg-gray-300"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirmId(doc.id)}
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete document and chunks"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Upload & Ingestion Tab */
            <form onSubmit={handleIngest} className="space-y-4 max-w-2xl mx-auto">
              {uploadSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  <span>{uploadSuccess}</span>
                </div>
              )}

              {uploadError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle size={16} className="text-red-600 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}

              {/* Drag and Drop Zone */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 hover:border-blue-500 bg-gray-50/70 hover:bg-blue-50/30 rounded-2xl p-6 text-center cursor-pointer transition-all space-y-2"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) =>
                    e.target.files &&
                    e.target.files.length > 0 &&
                    handleFileUpload(e.target.files[0])
                  }
                  accept=".txt,.md,.markdown,.json,.csv"
                  className="hidden"
                />
                <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto">
                  <UploadCloud size={20} />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-800">
                    {fileName ? (
                      <span className="text-blue-600">Selected: {fileName}</span>
                    ) : (
                      'Click to upload or drag and drop document'
                    )}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Supports .txt, .md, .csv, .json text files
                  </p>
                </div>
              </div>

              {/* Document Title */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Document Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  placeholder="e.g. Sales SOP 2026: Volume Discounts & Margin Guidelines"
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs text-gray-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {/* Visibility Role */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Visibility Access Scope <span className="text-red-500">*</span>
                </label>
                <select
                  value={visibilityRole}
                  onChange={(e) => setVisibilityRole(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs text-gray-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">
                    🟢 All Employees (Public SOPs, Product Specifications, FAQs)
                  </option>
                  <option value="salesperson">
                    🔵 Sales Reps & Above (Commercial terms, Quote policies)
                  </option>
                  <option value="manager">
                    🟣 Managers & Admins (Approval thresholds, Sales coaching)
                  </option>
                  <option value="admin_only">
                    🔒 Admin Only (Executive strategy, Costing formulas)
                  </option>
                </select>
              </div>

              {/* Document Text Content Editor */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-gray-700">
                    Document Text Content <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[10px] text-gray-400">
                    {docContent.length.toLocaleString()} chars (~
                    {Math.round(docContent.length / 4)} tokens)
                  </span>
                </div>
                <textarea
                  rows={8}
                  value={docContent}
                  onChange={(e) => setDocContent(e.target.value)}
                  placeholder="Paste or type the full text content of the SOP, catalog, or policy here..."
                  className="w-full p-3 bg-white border border-gray-200 rounded-xl text-xs text-gray-800 font-mono leading-relaxed focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {/* Ingestion Submit Button */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('library')}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading || !docTitle.trim() || !docContent.trim()}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition-all shadow-xs flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Generating Embeddings & Ingesting...</span>
                    </>
                  ) : (
                    <>
                      <Shield size={14} />
                      <span>Ingest into Knowledge Base</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
