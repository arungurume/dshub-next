'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  ArrowLeft, FolderOpen, RefreshCw, ExternalLink, Calendar, User, Info, FileText, Check, ChevronLeft, ChevronRight, X
} from 'lucide-react';
import { cmsApi } from '@/lib/api';
import { useLanguage } from '@/context/LanguageContext';

interface CanvaDesign {
  id: string;
  title?: string;
  thumbnail?: { url: string };
  urls?: { edit_url?: string };
  owner?: { display_name?: string; name?: string };
  type?: string;
  created_at?: number;
  updated_at?: number;
  folder?: { name?: string } | string;
  page_count?: number;
}

interface CanvaFolder {
  folder: {
    id: string;
    name: string;
  };
}

export default function CanvaDesignDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { t } = useLanguage();

  const [design, setDesign] = useState<CanvaDesign | null>(null);
  const [highResImageUrl, setHighResImageUrl] = useState<string | null>(null);
  const [relatedDesigns, setRelatedDesigns] = useState<CanvaDesign[]>([]);
  const [folders, setFolders] = useState<CanvaFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState('');

  const loadDesignDetails = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch design details
      const { data: res } = await cmsApi.get(`/canva/designs/${id}`);
      const designData = res?.design || res;
      setDesign(designData);

      // Fetch high-res export preview
      try {
        const { data: exportRes } = await cmsApi.get(`/canva/designs/${id}/export?format=png&quality=hd`);
        if (exportRes?.url) {
          setHighResImageUrl(exportRes.url);
        }
      } catch {
        // ignore
      }

      // Fetch related
      fetchRelatedDesigns(id);

      // Fetch folders
      fetchCanvaFolders();

    } catch (err) {
      console.error(err);
      toast.error('Failed to load design details');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (id) {
      loadDesignDetails();
    }
  }, [id, loadDesignDetails]);

  const fetchRelatedDesigns = async (currentId: string) => {
    try {
      const { data: res } = await cmsApi.get('/canva/designs', { params: { size: 100 } });
      const items = res?.items || [];
      if (items.length > 0) {
        // filter out current, shuffle and take 6
        const related = items
          .filter((d: any) => d.id !== currentId)
          .sort(() => 0.5 - Math.random())
          .slice(0, 6);
        setRelatedDesigns(related);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchCanvaFolders = async () => {
    try {
      const { data: res } = await cmsApi.get('/canva/folders/root');
      if (res && res.items) {
        setFolders(res.items);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleEditInCanva = () => {
    const editUrl = design?.urls?.edit_url ||
      (design as any)?.urls?.editUrl ||
      (design as any)?.edit_url ||
      (design as any)?.editUrl;

    if (editUrl) {
      window.open(editUrl, '_blank');
    } else if (design?.id) {
      window.open(`https://www.canva.com/design/${design.id}/edit`, '_blank');
    } else {
      toast.error('Could not find edit URL for this design');
    }
  };

  const handleSaveToFileManager = async () => {
    setExporting(true);
    setExportProgress('Starting export from Canva…');
    try {
      const { data: exportRes } = await cmsApi.post(`/canva/designs/export/${id}`);
      if (exportRes && exportRes.id) {
        pollExportStatus(exportRes.id);
      } else {
        throw new Error('Export could not be started');
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Failed to start export');
      setExporting(false);
    }
  };

  const pollExportStatus = (exportId: string) => {
    setExportProgress('Export in progress…');
    const interval = setInterval(async () => {
      try {
        const { data: statusRes } = await cmsApi.get(`/canva/designs/export/status/${exportId}`);
        if (statusRes.status === 'COMPLETED') {
          clearInterval(interval);
          finalizeExport(statusRes);
        } else if (statusRes.status === 'FAILED') {
          clearInterval(interval);
          toast.error('Canva export failed on the server');
          setExporting(false);
        }
      } catch (err) {
        clearInterval(interval);
        console.error(err);
        toast.error('Unable to verify export status');
        setExporting(false);
      }
    }, 4000);
  };

  const finalizeExport = async (exportData: any) => {
    setExportProgress('Saving exported file to DSHub…');
    try {
      await cmsApi.post('/cc/content/by-url', exportData);
      toast.success('Successfully imported design into File Manager!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save exported file to storage');
    } finally {
      setExporting(false);
    }
  };

  const formatTimestamp = (ts: any) => {
    if (!ts) return '—';
    // Canva timestamps can be in seconds, so multiply by 1000
    const d = new Date(ts * 1000);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="design-loading">
        <RefreshCw className="spin" size={24} />
        <span>Loading Canva design details…</span>
      </div>
    );
  }

  const previewSrc = highResImageUrl || design?.thumbnail?.url || '';
  const ownerName = design?.owner?.display_name || design?.owner?.name || 'You';

  return (
    <div className="canva-detail-page">
      {/* Header back link */}
      <div className="detail-header">
        <button className="back-btn" onClick={() => router.push('/admin/templates')}>
          <ArrowLeft size={15} />
          <span>Back to Templates</span>
        </button>
      </div>

      {/* Two Column Grid */}
      <div className="detail-grid">
        {/* Left Column: Design Image */}
        <div className="image-section">
          <div className="preview-container">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewSrc || 'https://picsum.photos/id/10/800/600'}
              alt={design?.title || 'Preview'}
              className="main-preview-img"
            />
          </div>
        </div>

        {/* Right Column: Info and Actions */}
        <div className="info-section">
          <div className="info-card">
            <h1 className="template-title">{design?.title || 'Untitled Design'}</h1>
            <span className="template-type">From your Canva account</span>

            <div className="action-buttons">
              <button className="btn-primary" onClick={handleEditInCanva}>
                <ExternalLink size={14} style={{ marginRight: 6 }} /> Edit in Canva
              </button>
            </div>

            {/* Metadata breakdown */}
            <div className="metadata-table">
              <div className="meta-row">
                <span className="lbl">Owner:</span>
                <span className="val">{ownerName}</span>
              </div>
              {design?.type && (
                <div className="meta-row">
                  <span className="lbl">Type:</span>
                  <span className="val">{design.type}</span>
                </div>
              )}
              <div className="meta-row">
                <span className="lbl">Pages:</span>
                <span className="val">{design?.page_count || 1}</span>
              </div>
              {design?.updated_at && (
                <div className="meta-row">
                  <span className="lbl">Last updated:</span>
                  <span className="val">{formatTimestamp(design.updated_at)}</span>
                </div>
              )}
            </div>

            {/* Actions Card: Save to File Manager */}
            <div className="actions-section">
              <h3>Use this design</h3>
              <div className="action-card" onClick={handleSaveToFileManager}>
                <div className="icon-box">
                  <FolderOpen size={20} />
                </div>
                <div className="card-content">
                  <div className="card-header-row">
                    <span className="card-title">Save to File Manager</span>
                    <span className="badge-rec">Recommended</span>
                  </div>
                  <p className="card-desc">
                    Import this Canva design directly and save it as a high-resolution reusable asset in DSHub.
                  </p>
                </div>
              </div>
            </div>

            {/* Folders Badge Section */}
            {folders.length > 0 && (
              <div className="folders-section">
                <h3>Your Canva Folders</h3>
                <div className="folder-grid">
                  {folders.map((item, idx) => (
                    <a
                      key={idx}
                      href={`https://www.canva.com/folder/${item.folder.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="folder-badge"
                    >
                      <FolderOpen size={12} style={{ marginRight: 4, opacity: 0.6 }} />
                      <span>{item.folder.name}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Related Designs Grid */}
      {relatedDesigns.length > 0 && (
        <div className="related-section">
          <h2>More of your designs</h2>
          <div className="related-grid">
            {relatedDesigns.map((d) => (
              <div
                key={d.id}
                className="related-card"
                onClick={() => router.push(`/admin/templates/canva/${d.id}`)}
              >
                <div className="related-img-frame">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={d.thumbnail?.url || 'https://picsum.photos/id/10/800/600'} alt="" />
                </div>
                <div className="related-title">{d.title || 'Untitled'}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Export Loader Overlay */}
      {exporting && (
        <div className="modal-overlay">
          <div className="export-loader-card">
            <RefreshCw className="spin" size={32} style={{ color: 'var(--accent)', marginBottom: 12 }} />
            <h3>Importing Canva Design…</h3>
            <p>{exportProgress}</p>
          </div>
        </div>
      )}

      <style>{`
        .canva-detail-page {
          padding: 1.5rem 2rem;
          max-width: 1200px;
          margin: 0 auto;
        }
        .design-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 1rem;
          padding: 6rem;
          color: var(--text-muted);
        }
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* Header */
        .detail-header {
          margin-bottom: 2rem;
        }
        .back-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: var(--card-bg);
          border: 1px solid var(--border);
          padding: 0.5rem 1rem;
          border-radius: 10px;
          color: var(--text-muted);
          font-size: 0.82rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
        }
        .back-btn:hover {
          border-color: var(--accent);
          color: var(--accent);
        }

        /* Layout Grid */
        .detail-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 2.5rem;
          align-items: start;
        }

        /* Gallery/Preview */
        .image-section {
          width: 100%;
        }
        .preview-container {
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 18px;
          overflow: hidden;
          aspect-ratio: 4 / 3;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 16px rgba(0,0,0,0.05);
        }
        .main-preview-img {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }

        /* Info Section */
        .info-card {
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 18px;
          padding: 2rem;
          box-shadow: 0 4px 16px rgba(0,0,0,0.04);
        }
        .template-title {
          font-size: 1.5rem;
          font-weight: 800;
          margin: 0 0 0.35rem;
          line-height: 1.25;
        }
        .template-type {
          font-size: 0.78rem;
          color: var(--text-muted);
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        /* Action button */
        .action-buttons {
          margin-top: 1.5rem;
          margin-bottom: 1.5rem;
        }
        .btn-primary {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--btn-cta-bg);
          color: var(--btn-cta-text);
          border: none;
          padding: 0.75rem;
          border-radius: 12px;
          font-size: 0.9rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s;
          box-shadow: 0 4px 14px rgba(99, 102, 241, 0.12);
        }
        .btn-primary:hover {
          background: var(--btn-cta-hover);
        }

        /* Metadata table */
        .metadata-table {
          display: flex;
          flex-direction: column;
          gap: 0.65rem;
          border-top: 1px solid var(--border);
          border-bottom: 1px solid var(--border);
          padding: 1.25rem 0;
          margin-bottom: 1.5rem;
        }
        .meta-row {
          display: flex;
          justify-content: space-between;
          font-size: 0.85rem;
        }
        .meta-row .lbl {
          color: var(--text-muted);
          font-weight: 500;
        }
        .meta-row .val {
          font-weight: 600;
          color: var(--text);
        }

        /* Save card section */
        .actions-section h3, .folders-section h3 {
          font-size: 0.85rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-muted);
          margin: 0 0 0.75rem;
        }
        .action-card {
          display: flex;
          gap: 1rem;
          background: rgba(99, 102, 241, 0.04);
          border: 1px dashed rgba(99, 102, 241, 0.25);
          border-radius: 14px;
          padding: 1.25rem;
          cursor: pointer;
          transition: all 0.18s;
        }
        .action-card:hover {
          background: rgba(99, 102, 241, 0.08);
          border-color: var(--accent);
          transform: translateY(-1px);
        }
        .icon-box {
          width: 44px;
          height: 44px;
          border-radius: 10px;
          background: rgba(99, 102, 241, 0.12);
          color: var(--accent);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .card-content {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }
        .card-header-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .card-title {
          font-size: 0.875rem;
          font-weight: 700;
          color: var(--text);
        }
        .badge-rec {
          background: var(--accent);
          color: white;
          font-size: 0.62rem;
          font-weight: 700;
          padding: 0.15rem 0.45rem;
          border-radius: 4px;
          text-transform: uppercase;
        }
        .card-desc {
          font-size: 0.78rem;
          color: var(--text-muted);
          line-height: 1.4;
          margin: 0;
        }

        /* Folders badge section */
        .folders-section {
          margin-top: 1.5rem;
        }
        .folder-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }
        .folder-badge {
          display: inline-flex;
          align-items: center;
          background: var(--sidebar-bg);
          border: 1px solid var(--border);
          padding: 0.35rem 0.75rem;
          border-radius: 20px;
          font-size: 0.78rem;
          color: var(--text-muted);
          font-weight: 600;
          text-decoration: none;
          transition: all 0.15s;
        }
        .folder-badge:hover {
          border-color: var(--accent);
          color: var(--accent);
        }

        /* Related designs list */
        .related-section {
          margin-top: 3.5rem;
        }
        .related-section h2 {
          font-size: 1.1rem;
          font-weight: 800;
          margin: 0 0 1.25rem;
        }
        .related-grid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 1rem;
        }
        .related-card {
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 12px;
          overflow: hidden;
          cursor: pointer;
          transition: all 0.15s;
          box-shadow: 0 2px 6px rgba(0,0,0,0.04);
        }
        .related-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(0,0,0,0.12);
        }
        .related-img-frame {
          aspect-ratio: 4/3;
          overflow: hidden;
          background: var(--bg-base);
        }
        .related-img-frame img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .related-title {
          padding: 8px 10px;
          font-size: 0.78rem;
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* Modals */
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          backdrop-filter: blur(4px);
        }
        .export-loader-card {
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 20px;
          width: 320px;
          padding: 2rem;
          text-align: center;
          box-shadow: 0 20px 50px rgba(0,0,0,0.3);
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .export-loader-card h3 {
          font-size: 0.95rem;
          font-weight: 700;
          margin: 0 0 0.5rem;
        }
        .export-loader-card p {
          font-size: 0.78rem;
          color: var(--text-muted);
          margin: 0;
        }

        @media (max-width: 900px) {
          .detail-grid { grid-template-columns: 1fr; }
          .related-grid { grid-template-columns: repeat(3, 1fr); }
        }
        @media (max-width: 600px) {
          .related-grid { grid-template-columns: repeat(2, 1fr); }
        }
      `}</style>
    </div>
  );
}
