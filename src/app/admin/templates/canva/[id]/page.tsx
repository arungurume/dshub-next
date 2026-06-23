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
  const [aspectRatio, setAspectRatio] = useState<'portrait' | 'landscape' | 'square'>('landscape');

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const ratio = img.naturalWidth / img.naturalHeight;
    if (ratio < 0.75) {
      setAspectRatio('portrait');
    } else if (ratio > 1.3) {
      setAspectRatio('landscape');
    } else {
      setAspectRatio('square');
    }
  };

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
          <ArrowLeft size={15} className="arrow-icon" />
          <span>Back to Templates</span>
        </button>
      </div>

      {/* Two Column Grid */}
      <div className="detail-grid">
        {/* Left Column: Design Image with Blurred Background Depth */}
        <div className="image-section">
          <div className="preview-container-wrapper">
            <div className="preview-blur-bg" style={{ backgroundImage: `url(${previewSrc})` }} />
            <div className={`preview-container ${aspectRatio}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewSrc || 'https://picsum.photos/id/10/800/600'}
                alt={design?.title || 'Preview'}
                className="main-preview-img"
                onLoad={handleImageLoad}
              />
            </div>
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
          padding: 2rem 3rem;
          max-width: 1280px;
          margin: 0 auto;
          animation: fadeIn 0.4s ease-out;
        }
        .design-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 1.25rem;
          padding: 8rem;
          color: var(--text-muted);
          font-weight: 500;
        }
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
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
          padding: 0.6rem 1.2rem;
          border-radius: 12px;
          color: var(--text);
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        }
        .back-btn .arrow-icon {
          transition: transform 0.2s ease;
        }
        .back-btn:hover {
          border-color: var(--accent);
          color: var(--accent);
          box-shadow: 0 4px 12px rgba(99, 102, 241, 0.08);
        }
        .back-btn:hover .arrow-icon {
          transform: translateX(-3px);
        }

        /* Layout Grid */
        .detail-grid {
          display: grid;
          grid-template-columns: 1.1fr 0.9fr;
          gap: 3.5rem;
          align-items: start;
        }

        /* Gallery/Preview Container with Glass Background Depth */
        .image-section {
          width: 100%;
        }
        .preview-container-wrapper {
          position: relative;
          background: rgba(15, 23, 42, 0.03);
          border: 1px solid var(--border);
          border-radius: 24px;
          padding: 2.5rem;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 10px 30px rgba(0,0,0,0.03);
          min-height: 480px;
        }
        html.dark .preview-container-wrapper {
          background: rgba(255, 255, 255, 0.01);
        }
        .preview-blur-bg {
          position: absolute;
          inset: -20px;
          background-size: cover;
          background-position: center;
          filter: blur(40px) opacity(0.12);
          z-index: 0;
          transform: scale(1.05);
          pointer-events: none;
        }
        .preview-container {
          position: relative;
          z-index: 1;
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 20px 40px rgba(0,0,0,0.12);
          transition: all 0.3s ease;
          max-width: 100%;
        }
        .preview-container.portrait {
          aspect-ratio: 1 / 1.414;
          width: 380px;
        }
        .preview-container.landscape {
          aspect-ratio: 1.6 / 1;
          width: 580px;
        }
        .preview-container.square {
          aspect-ratio: 1 / 1;
          width: 460px;
        }
        .main-preview-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        /* Info Section */
        .info-card {
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 24px;
          padding: 2.5rem;
          box-shadow: 0 10px 30px rgba(0,0,0,0.03);
        }
        .template-title {
          font-size: 1.75rem;
          font-weight: 800;
          margin: 0 0 0.5rem;
          line-height: 1.25;
          letter-spacing: -0.02em;
          color: var(--text);
        }
        .template-type {
          font-size: 0.72rem;
          color: var(--text-muted);
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        /* Action button */
        .action-buttons {
          margin-top: 2rem;
          margin-bottom: 2rem;
        }
        .btn-primary {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
          color: #ffffff;
          border: none;
          padding: 0.9rem;
          border-radius: 14px;
          font-size: 0.95rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          box-shadow: 0 4px 18px rgba(99, 102, 241, 0.25);
        }
        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(99, 102, 241, 0.35);
          filter: brightness(1.05);
        }
        .btn-primary:active {
          transform: translateY(0);
        }

        /* Metadata table */
        .metadata-table {
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
          border-top: 1px solid var(--border);
          border-bottom: 1px solid var(--border);
          padding: 1.5rem 0;
          margin-bottom: 2rem;
        }
        .meta-row {
          display: flex;
          justify-content: space-between;
          font-size: 0.88rem;
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
          font-size: 0.72rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--text-muted);
          margin: 0 0 1rem;
        }
        .action-card {
          display: flex;
          gap: 1.25rem;
          background: linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(168, 85, 247, 0.03) 100%);
          border: 1px dashed rgba(99, 102, 241, 0.3);
          border-radius: 16px;
          padding: 1.5rem;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .action-card:hover {
          background: linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(168, 85, 247, 0.05) 100%);
          border-color: #6366f1;
          transform: translateY(-2px) scale(1.01);
          box-shadow: 0 8px 24px rgba(99, 102, 241, 0.06);
        }
        .icon-box {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          background: rgba(99, 102, 241, 0.1);
          color: #6366f1;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .card-content {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }
        .card-header-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .card-title {
          font-size: 0.95rem;
          font-weight: 700;
          color: var(--text);
        }
        .badge-rec {
          background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
          color: #ffffff;
          font-size: 0.6rem;
          font-weight: 800;
          padding: 0.2rem 0.5rem;
          border-radius: 6px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .card-desc {
          font-size: 0.8rem;
          color: var(--text-muted);
          line-height: 1.45;
          margin: 0;
        }

        /* Folders badge section */
        .folders-section {
          margin-top: 2rem;
        }
        .folder-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 0.6rem;
        }
        .folder-badge {
          display: inline-flex;
          align-items: center;
          background: var(--sidebar-bg);
          border: 1px solid var(--border);
          padding: 0.45rem 1rem;
          border-radius: 24px;
          font-size: 0.8rem;
          color: var(--text);
          font-weight: 600;
          text-decoration: none;
          transition: all 0.2s;
        }
        .folder-badge:hover {
          border-color: #6366f1;
          color: #6366f1;
          background: rgba(99, 102, 241, 0.02);
          transform: translateY(-1px);
        }

        /* Related designs list */
        .related-section {
          margin-top: 4.5rem;
        }
        .related-section h2 {
          font-size: 1.35rem;
          font-weight: 800;
          margin: 0 0 1.5rem;
          letter-spacing: -0.02em;
        }
        .related-grid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 1.25rem;
        }
        .related-card {
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 16px;
          overflow: hidden;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          box-shadow: 0 4px 12px rgba(0,0,0,0.02);
        }
        .related-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 28px rgba(0,0,0,0.08);
          border-color: var(--accent);
        }
        .related-img-frame {
          aspect-ratio: 4/3;
          overflow: hidden;
          background: var(--bg-base);
          border-bottom: 1px solid var(--border);
        }
        .related-img-frame img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .related-title {
          padding: 12px;
          font-size: 0.8rem;
          font-weight: 700;
          color: var(--text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* Modals */
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          backdrop-filter: blur(8px);
        }
        .export-loader-card {
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 24px;
          width: 340px;
          padding: 2.5rem;
          text-align: center;
          box-shadow: 0 25px 60px rgba(0, 0, 0, 0.15);
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .export-loader-card h3 {
          font-size: 1.1rem;
          font-weight: 800;
          margin: 0 0 0.5rem;
          color: var(--text);
        }
        .export-loader-card p {
          font-size: 0.85rem;
          color: var(--text-muted);
          margin: 0;
        }

        @media (max-width: 1024px) {
          .detail-grid { grid-template-columns: 1fr; gap: 2rem; }
          .related-grid { grid-template-columns: repeat(3, 1fr); }
        }
        @media (max-width: 640px) {
          .canva-detail-page { padding: 1.5rem 1.5rem; }
          .related-grid { grid-template-columns: repeat(2, 1fr); }
        }
      `}</style>
    </div>
  );
}
