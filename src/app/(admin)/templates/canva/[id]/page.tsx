'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  ArrowLeft, FolderOpen, RefreshCw, ExternalLink, Calendar, User, Info, FileText, Check, ChevronLeft, ChevronRight, X, Pencil
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
  const [isAlreadySaved, setIsAlreadySaved] = useState(false);
  const [savedContentId, setSavedContentId] = useState<number | null>(null);

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

  const checkSavedStatus = async (designTitle: string) => {
    try {
      const { data: contentRes } = await cmsApi.get('/cc/content', { params: { page: 0, size: 100 } });
      const items = contentRes?.content || contentRes || [];
      const matched = items.find((item: any) => item.name === designTitle);
      if (matched) {
        setIsAlreadySaved(true);
        setSavedContentId(matched.id);
      } else {
        setIsAlreadySaved(false);
        setSavedContentId(null);
      }
    } catch (err) {
      console.error('Failed to check if template is saved:', err);
    }
  };

  const loadDesignDetails = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch design details
      const { data: res } = await cmsApi.get(`/canva/designs/${id}`);
      const designData = res?.design || res;
      setDesign(designData);

      if (designData?.title) {
        await checkSavedStatus(designData.title);
      }

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
      const { data: savedContent } = await cmsApi.post('/cc/content/by-url', exportData);
      toast.success('Successfully imported design into File Manager!');
      setIsAlreadySaved(true);
      if (savedContent?.id) {
        setSavedContentId(savedContent.id);
      }
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
      <div className="canva-detail-page">
        {/* Skeleton Header */}
        <div className="detail-header">
          <div style={{ width: 60, height: 20, borderRadius: 6, background: 'var(--border)', animation: 'skeleton-pulse 1.4s ease-in-out infinite' }} />
        </div>

        {/* Skeleton Grid */}
        <div className="detail-grid">
          {/* Left: image skeleton */}
          <div style={{ width: '100%', aspectRatio: '4/3', maxHeight: '72vh', borderRadius: 8, background: 'var(--card-bg)', border: '1px solid var(--border)', animation: 'skeleton-pulse 1.4s ease-in-out infinite' }} />

          {/* Right: info skeleton */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingTop: '0.25rem' }}>
            {/* Title */}
            <div style={{ width: '75%', height: 32, borderRadius: 6, background: 'var(--card-bg)', border: '1px solid var(--border)', animation: 'skeleton-pulse 1.4s ease-in-out infinite' }} />
            {/* Subtitle */}
            <div style={{ width: '45%', height: 16, borderRadius: 4, background: 'var(--card-bg)', border: '1px solid var(--border)', animation: 'skeleton-pulse 1.4s ease-in-out infinite 0.1s' }} />
            {/* Button */}
            <div style={{ width: 140, height: 40, borderRadius: 8, background: 'var(--card-bg)', border: '1px solid var(--border)', marginTop: '0.5rem', animation: 'skeleton-pulse 1.4s ease-in-out infinite 0.15s' }} />
            {/* Meta rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
              {[0.2, 0.25, 0.3].map((delay, i) => (
                <div key={i} style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <div style={{ width: 80, height: 12, borderRadius: 4, background: 'var(--card-bg)', border: '1px solid var(--border)', animation: `skeleton-pulse 1.4s ease-in-out ${delay}s infinite` }} />
                  <div style={{ width: 120, height: 12, borderRadius: 4, background: 'var(--card-bg)', border: '1px solid var(--border)', animation: `skeleton-pulse 1.4s ease-in-out ${delay}s infinite` }} />
                </div>
              ))}
            </div>
            {/* Action card skeleton */}
            <div style={{ width: '100%', height: 80, borderRadius: 12, background: 'var(--card-bg)', border: '1px solid var(--border)', marginTop: '1rem', animation: 'skeleton-pulse 1.4s ease-in-out infinite 0.35s' }} />
          </div>
        </div>

        <style>{`
          @keyframes skeleton-pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.4; }
          }
        `}</style>
      </div>
    );
  }

  if (!loading && !design) {
    return (
      <div className="canva-detail-page">
        <div style={{ textAlign: 'center', padding: '6rem 2rem', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>😕</div>
          <h2 style={{ color: 'var(--text)', marginBottom: '0.5rem' }}>Design not found</h2>
          <p style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>This Canva design may not be accessible.</p>
          <p style={{ fontSize: '0.82rem', marginBottom: '1.5rem' }}>Make sure your Canva account is connected and you have access to this design.</p>
          <button
            onClick={() => router.push('/templates')}
            style={{
              background: 'var(--accent)', color: '#fff', border: 'none',
              padding: '0.65rem 1.5rem', borderRadius: 10, fontWeight: 700,
              fontSize: '0.85rem', cursor: 'pointer',
            }}
          >
            ← Back to Templates
          </button>
        </div>
      </div>
    );
  }

  const previewSrc = highResImageUrl || design?.thumbnail?.url || '';
  const ownerName = design?.owner?.display_name || design?.owner?.name || 'You';

  return (
    <div className="canva-detail-page">
      {/* Header back link */}
      <div className="detail-header">
        <button className="back-btn" onClick={() => router.push('/templates')}>
          <ArrowLeft size={16} className="arrow-icon" />
          <span>Back</span>
        </button>
      </div>

      {/* Two Column Grid */}
      <div className="detail-grid">
        {/* Left Column: Design Image */}
        <div className="image-section">
          <div className="preview-image-wrapper">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewSrc || 'https://picsum.photos/id/10/800/600'}
              alt={design?.title || 'Preview'}
              className="main-preview-img"
              onLoad={handleImageLoad}
            />
          </div>
        </div>

        {/* Right Column: Info and Actions */}
        <div className="info-section">
          <div className="info-content-wrapper">
            <h1 className="template-title">{design?.title || 'Untitled Design'}</h1>
            <span className="template-type">From your Canva account</span>

            <div className="action-buttons">
              <button className="btn-primary" onClick={handleEditInCanva}>
                <Pencil size={15} style={{ marginRight: 8 }} /> Edit in Canva
              </button>
            </div>

            {/* Metadata breakdown */}
            <div className="metadata-table">
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
            </div>

            {/* Actions Card: Save to File Manager */}
            <div className="actions-section">
              <h3>Use this design</h3>
              {isAlreadySaved ? (
                <div className="action-card saved" onClick={() => router.push('/content')}>
                  <div className="icon-box saved">
                    <Check size={20} />
                  </div>
                  <div className="card-content">
                    <div className="card-header-row">
                      <span className="card-title">Saved to File Manager</span>
                      <span className="badge-saved">In Library</span>
                    </div>
                    <p className="card-desc">
                      This design is already in your library. Click to view and manage it in the File Manager.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="action-card" onClick={handleSaveToFileManager}>
                  <div className="icon-box">
                    <FolderOpen size={20} />
                  </div>
                  <div className="card-content">
                    <div className="card-header-row">
                      <span className="card-title">Save to File Manager</span>
                    </div>
                    <p className="card-desc">
                      Import this Canva design and save it as a reusable asset in DShub.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Folders Badge Section */}
            {folders.length > 0 && (
              <div className="folders-section">
                <h3>Your canva folders</h3>
                <div className="folder-grid">
                  {folders.map((item, idx) => (
                    <a
                      key={idx}
                      href={`https://www.canva.com/folder/${item.folder.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="folder-badge"
                    >
                      <FolderOpen size={14} className="folder-icon" />
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
                onClick={() => router.push(`/templates/canva/${d.id}`)}
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
          padding: 2.5rem 3rem;
          max-width: 1400px;
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
          margin-bottom: 1.5rem;
        }
        .back-btn {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          background: transparent;
          border: none;
          padding: 0;
          color: var(--text);
          font-size: 0.95rem;
          font-weight: 500;
          cursor: pointer;
          transition: color 0.2s ease;
          box-shadow: none;
        }
        .back-btn .arrow-icon {
          transition: transform 0.2s ease;
        }
        .back-btn:hover {
          color: #7D2AE8;
        }
        .back-btn:hover .arrow-icon {
          transform: translateX(-3px);
        }

        /* Layout Grid */
        .detail-grid {
          display: grid;
          grid-template-columns: 1.25fr 0.75fr;
          gap: 4rem;
          align-items: start;
          margin-top: 1rem;
        }

        /* Gallery/Preview Container */
        .image-section {
          width: 100%;
        }
        .preview-image-wrapper {
          display: flex;
          justify-content: center;
          align-items: flex-start;
          width: 100%;
          background: transparent;
          border: none;
          box-shadow: none;
        }
        .main-preview-img {
          width: auto;
          max-width: 100%;
          max-height: 82vh;
          object-fit: contain;
          border-radius: 4px;
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
        }

        /* Info Section */
        .info-content-wrapper {
          background: transparent;
          border: none;
          padding: 0;
          box-shadow: none;
        }
        .template-title {
          font-size: 1.85rem;
          font-weight: 700;
          margin: 0 0 0.25rem;
          line-height: 1.25;
          color: var(--text);
        }
        .template-type {
          font-size: 0.85rem;
          color: var(--text-muted);
          font-weight: 400;
          text-transform: none;
          letter-spacing: normal;
        }

        /* Action button */
        .action-buttons {
          margin-top: 1.5rem;
          margin-bottom: 2rem;
        }
        .btn-primary {
          width: auto;
          min-width: 140px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: #7D2AE8;
          color: #ffffff;
          border: none;
          padding: 0.65rem 1.5rem;
          border-radius: 8px;
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 2px 8px rgba(37, 99, 235, 0.15);
        }
        .btn-primary:hover {
          background: #6a21cb;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25);
        }
        .btn-primary:active {
          transform: translateY(0);
        }

        /* Metadata table */
        .metadata-table {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          border: none;
          padding: 0;
          margin-bottom: 2.5rem;
        }
        .meta-row {
          display: flex;
          align-items: baseline;
          font-size: 0.85rem;
        }
        .meta-row .lbl {
          color: #4b5563;
          font-weight: 700;
          text-transform: uppercase;
          font-size: 0.72rem;
          letter-spacing: 0.05em;
          width: 130px;
          flex-shrink: 0;
        }
        .meta-row .val {
          font-weight: 500;
          color: #1f2937;
        }
        html.dark .meta-row .lbl {
          color: var(--text-muted);
        }
        html.dark .meta-row .val {
          color: var(--text);
        }

        /* Save card section */
        .actions-section h3, .folders-section h3 {
          font-size: 0.95rem;
          font-weight: 700;
          text-transform: none;
          letter-spacing: normal;
          color: var(--text);
          margin: 0 0 0.85rem;
        }
        .action-card {
          display: flex;
          align-items: center;
          gap: 1rem;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 1.25rem 1.5rem;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .action-card:hover {
          background: #f8fafc;
          border-color: #cbd5e1;
        }
        html.dark .action-card {
          background: rgba(255, 255, 255, 0.02);
          border-color: var(--border);
        }
        html.dark .action-card:hover {
          background: rgba(255, 255, 255, 0.04);
          border-color: rgba(255, 255, 255, 0.15);
        }
        .action-card.saved {
          background: rgba(34, 197, 94, 0.02);
          border-color: rgba(34, 197, 94, 0.2);
        }
        .action-card.saved:hover {
          background: rgba(34, 197, 94, 0.04);
          border-color: rgba(34, 197, 94, 0.4);
        }
        .icon-box {
          width: 42px;
          height: 42px;
          border-radius: 8px;
          background: #f1f5f9;
          color: #475569;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        html.dark .icon-box {
          background: rgba(255, 255, 255, 0.05);
          color: var(--text-muted);
        }
        .icon-box.saved {
          background: rgba(34, 197, 94, 0.1);
          color: #22c55e;
        }
        .card-content {
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
        }
        .card-header-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .card-title {
          font-size: 0.95rem;
          font-weight: 600;
          color: var(--text);
        }
        .badge-saved {
          background: #22c55e;
          color: #ffffff;
          font-size: 0.65rem;
          font-weight: 700;
          padding: 0.15rem 0.4rem;
          border-radius: 4px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .card-desc {
          font-size: 0.825rem;
          color: var(--text-muted);
          line-height: 1.4;
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
          background: #f1f5f9;
          border: 1px solid #e2e8f0;
          padding: 0.4rem 0.9rem;
          border-radius: 9999px;
          font-size: 0.85rem;
          color: #475569;
          font-weight: 500;
          text-decoration: none;
          transition: all 0.2s;
          gap: 0.35rem;
        }
        html.dark .folder-badge {
          background: rgba(255, 255, 255, 0.03);
          border-color: var(--border);
          color: var(--text-muted);
        }
        .folder-badge:hover {
          border-color: #cbd5e1;
          background: #e2e8f0;
        }
        html.dark .folder-badge:hover {
          border-color: rgba(255, 255, 255, 0.15);
          background: rgba(255, 255, 255, 0.08);
          color: var(--text);
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
