'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  ArrowLeft, Calendar, ShieldCheck, Zap, Info, Play, FileText, Check, ChevronLeft, ChevronRight, X, ZoomIn, RefreshCw
} from 'lucide-react';
import { cmsApi, cmsApiV2 } from '@/lib/api';
import { useLanguage } from '@/context/LanguageContext';
import UpgradeModal from '@/components/shared/UpgradeModal';
import { useUpgradeModal } from '@/hooks/useUpgradeModal';

interface Category {
  id: number;
  name: string;
}

interface ImageItem {
  id: number;
  url: string;
}

interface TemplateDetails {
  id: number;
  templateName: string;
  price: number;
  featuredImage: string;
  fullImage: string;
  description: string;
  highlights: string[];
  details: { label: string; value: string }[];
  categories: Category[];
  editUrl: string;
  canvaDesignId: string;
  creditCost: number;
  templateType: string;
  images: ImageItem[];
}

export default function DsTemplateDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const { t } = useLanguage();

  const [template, setTemplate] = useState<TemplateDetails | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showLightbox, setShowLightbox] = useState(false);
  const [loading, setLoading] = useState(true);
  const [similarTemplates, setSimilarTemplates] = useState<any[]>([]);

  // Credits logic
  const [userCredits, setUserCredits] = useState(0);
  const [isPurchased, setIsPurchased] = useState(false);
  const [unlockModalOpen, setUnlockModalOpen] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const { upgradeModal, openUpgrade, closeUpgrade } = useUpgradeModal();
  const [licenseModalOpen, setLicenseModalOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetchTemplateDetails();
    fetchUserCredits();
    checkIfPurchased();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchTemplateDetails = async () => {
    setLoading(true);
    try {
      const { data: res } = await cmsApi.get(`/ctc/templates/${id}?includeCategories=true`);
      if (res) {
        const detailsData: TemplateDetails = {
          ...res,
          templateName: res.title,
          price: 7.05,
          fullImage: res.images?.[0]?.url || '',
          featuredImage: res.images?.[0]?.url || '',
          description: res.description || '',
          highlights: [
            'Fully editable in Canva',
            'Works with Canva Free & Pro on desktop and mobile',
            'Optimized for horizontal & vertical screen formats',
            'High-resolution output for digital signage',
            'Customizable text, pricing, colors, and fonts',
            'Ideal for digital menus, bar displays, and restaurant TV screens'
          ],
          details: [
            { label: 'File Type', value: 'Canva Template' },
            { label: 'Dimensions', value: `${res.width || 1920}x${res.height || 1080} px` },
            { label: 'Canva Version', value: res.plan || 'FREE' }
          ],
          categories: res.categories || [],
          editUrl: res.templateUrl || '',
          canvaDesignId: res.canvaDesignId || '',
          creditCost: res.creditCost || 5,
          templateType: res.templateType || 'DIGITAL',
          images: res.images || []
        };
        setTemplate(detailsData);

        // Build gallery
        if (res.images && Array.isArray(res.images)) {
          setImages(res.images.map((img: any) => img.url));
        } else {
          setImages([
            'https://picsum.photos/id/10/800/600',
            'https://picsum.photos/id/11/800/600',
            'https://picsum.photos/id/12/800/600'
          ]);
        }

        // Similar templates
        if (res.categories && res.categories.length > 0) {
          const categoryIds = res.categories.map((c: any) => c.id);
          fetchSimilarTemplates(categoryIds, res.id);
        }
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load template details');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserCredits = async () => {
    try {
      const { data: res } = await cmsApiV2.get('/sac/my/template-credits');
      if (res) {
        setUserCredits((res.totalCredits || 0) - (res.usedCredits || 0));
      } else {
        setUserCredits(0);
      }
    } catch {
      setUserCredits(0);
    }
  };

  const checkIfPurchased = async () => {
    try {
      const { data: res } = await cmsApi.get(`/ctpc/purchases/by-templates?templateIds=${id}`);
      if (res && Array.isArray(res)) {
        setIsPurchased(res.some((p: any) => p.dsCanvaTemplateId === id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSimilarTemplates = async (categoryIds: number[], currentTplId: number) => {
    try {
      const { data: res } = await cmsApi.get('/ctc/templates/by-categories', {
        params: { categoryIds: categoryIds.join(','), page: 0, size: 6 }
      });
      if (res && res.content) {
        setSimilarTemplates(res.content.filter((t: any) => t.id !== currentTplId).slice(0, 5));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleConfirmUnlock = async () => {
    if (!template) return;
    setUnlocking(true);
    try {
      const purchaseData = {
        dsCanvaTemplateId: id,
        canvaDesignId: template.canvaDesignId,
        creditCost: template.creditCost,
        templateType: template.templateType || 'DIGITAL'
      };
      await cmsApi.post('/ctpc/purchases', purchaseData);
      setIsPurchased(true);
      toast.success('Template unlocked successfully!');
      setUnlockModalOpen(false);
      fetchUserCredits();
    } catch (err) {
      console.error(err);
      toast.error('Failed to unlock template. Please try again.');
    } finally {
      setUnlocking(false);
    }
  };

  const navigateImage = (direction: 'left' | 'right') => {
    if (images.length <= 1) return;
    if (direction === 'left') {
      setCurrentImageIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
    } else {
      setCurrentImageIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
    }
  };

  const handleBuyCredits = () => {
    openUpgrade('credit');
  };

  const handleOpenInCanva = () => {
    if (template?.editUrl) {
      window.open(template.editUrl, '_blank');
    } else {
      toast.warning('No Canva edit URL found for this template.');
    }
  };

  if (loading) {
    return (
      <div className="tpl-detail-page">
        {/* Skeleton Header */}
        <div className="detail-header">
          <div style={{ width: 80, height: 20, borderRadius: 6, background: 'var(--border)', animation: 'skeleton-pulse 1.4s ease-in-out infinite' }} />
          <div style={{ width: 160, height: 34, borderRadius: 40, background: 'var(--card-bg)', border: '1px solid var(--border)', animation: 'skeleton-pulse 1.4s ease-in-out infinite 0.1s' }} />
        </div>

        {/* Skeleton Grid */}
        <div className="detail-grid">
          {/* Left: gallery skeleton */}
          <div className="gallery-section">
            <div style={{ flex: 1, aspectRatio: '4/3', borderRadius: 8, background: 'var(--card-bg)', border: '1px solid var(--border)', animation: 'skeleton-pulse 1.4s ease-in-out infinite' }} />
          </div>

          {/* Right: info skeleton */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            {/* Title */}
            <div style={{ width: '80%', height: 36, borderRadius: 6, background: 'var(--card-bg)', border: '1px solid var(--border)', animation: 'skeleton-pulse 1.4s ease-in-out infinite 0.1s' }} />
            {/* Subtitle */}
            <div style={{ width: '40%', height: 14, borderRadius: 4, background: 'var(--card-bg)', border: '1px solid var(--border)', animation: 'skeleton-pulse 1.4s ease-in-out infinite 0.15s' }} />
            {/* Price box */}
            <div style={{ width: '100%', height: 70, borderRadius: 8, background: 'var(--card-bg)', border: '1px solid var(--border)', marginTop: '0.25rem', animation: 'skeleton-pulse 1.4s ease-in-out infinite 0.2s' }} />
            {/* Unlock button */}
            <div style={{ width: '100%', height: 48, borderRadius: 10, background: 'var(--card-bg)', border: '1px solid var(--border)', animation: 'skeleton-pulse 1.4s ease-in-out infinite 0.25s' }} />
            {/* Description lines */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.5rem' }}>
              {[0.3, 0.35, 0.4, 0.45].map((delay, i) => (
                <div key={i} style={{ width: i % 2 === 0 ? '90%' : '70%', height: 12, borderRadius: 4, background: 'var(--card-bg)', border: '1px solid var(--border)', animation: `skeleton-pulse 1.4s ease-in-out ${delay}s infinite` }} />
              ))}
            </div>
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

  if (!loading && !template) {
    return (
      <div className="tpl-detail-page">
        <div style={{ textAlign: 'center', padding: '6rem 2rem', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>😕</div>
          <h2 style={{ color: 'var(--text)', marginBottom: '0.5rem' }}>Template not found</h2>
          <p style={{ fontSize: '0.9rem', marginBottom: '1.5rem' }}>This template may have been removed or the link is invalid.</p>
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

  const cost = template?.creditCost || 5;
  const canAfford = userCredits >= cost;

  return (
    <div className="tpl-detail-page">
      {/* Header Breadcrumbs & Balance */}
      <div className="detail-header">
        <button className="back-btn" onClick={() => router.push('/templates')}>
          <ArrowLeft size={15} />
          <span>Back to Templates</span>
        </button>

        <div className="credits-badge">
          <Zap size={15} className="credits-icon" />
          <span className="credits-val">{userCredits}</span>
          <span className="credits-lbl">Credits</span>
          <button className="buy-more-btn" onClick={handleBuyCredits}>Buy More</button>
        </div>
      </div>

      {/* Main content grid */}
      <div className="detail-grid">
        {/* Left Column: Gallery */}
        <div className="gallery-section">
          {/* Thumbnails row */}
          {images.length > 1 && (
            <div className="thumb-col">
              {images.map((img, i) => (
                <button
                  key={i}
                  className={`thumb-btn ${i === currentImageIndex ? 'active' : ''}`}
                  onClick={() => setCurrentImageIndex(i)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img} alt="" />
                </button>
              ))}
            </div>
          )}

          {/* Main preview frame */}
          <div className="preview-container">
            {images.length > 1 && (
              <button className="nav-arrow left" onClick={() => navigateImage('left')}>
                <ChevronLeft size={20} />
              </button>
            )}

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={images[currentImageIndex] || 'https://picsum.photos/id/10/800/600'}
              alt={template?.templateName || 'Preview'}
              className="main-preview-img"
              onClick={() => setShowLightbox(true)}
            />

            {images.length > 1 && (
              <button className="nav-arrow right" onClick={() => navigateImage('right')}>
                <ChevronRight size={20} />
              </button>
            )}

            <div className="zoom-indicator" onClick={() => setShowLightbox(true)}>
              <ZoomIn size={14} />
              <span>Click to zoom</span>
            </div>
          </div>
        </div>

        {/* Right Column: Info details */}
        <div className="info-section">
          <div className="info-content-wrapper">
            <h1 className="template-title">{template?.templateName}</h1>
            <span className="template-type">DS Canva template</span>

            <div className="price-box">
              <div className="cash-price">
                <span className="amt">€{template?.price.toFixed(2)}</span>
                <span className="vat">VAT included</span>
              </div>
              <div className="credit-price">
                <span className="lbl">Credit Cost:</span>
                <span className="val">{cost} Credits</span>
              </div>
            </div>

            {/* Purchase actions */}
            <div className="actions-box">
              {isPurchased ? (
                <div className="purchased-state">
                  <button className="btn-unlock-action" onClick={handleOpenInCanva}>
                    Open in Canva
                  </button>
                  <div className="owned-tag">✓ You own this template</div>
                </div>
              ) : canAfford ? (
                <div className="unlock-direct-wrap">
                  <button
                    className="btn-unlock-action"
                    onClick={handleConfirmUnlock}
                    disabled={unlocking}
                  >
                    {unlocking
                      ? <><RefreshCw size={15} className="spin" /> Unlocking…</>
                      : <>🔓 Unlock for <strong>{cost} Credits</strong></>}
                  </button>
                  <div className="unlock-cost-summary">
                    <span>Your balance: <strong>{userCredits}</strong> credits</span>
                    <span className="cost-arrow">→</span>
                    <span>After unlock: <strong>{userCredits - cost}</strong> credits</span>
                  </div>
                </div>
              ) : (
                <div className="insufficient-box">
                  <div className="insufficient-warning">
                    <Info size={16} />
                    <span>You need <strong>{cost - userCredits} more credits</strong> to unlock this template.</span>
                  </div>
                  <button className="btn-unlock-action secondary" onClick={handleBuyCredits}>
                    Buy Credits
                  </button>
                </div>
              )}
            </div>

            {/* Overview / Description */}
            <div className="overview-container">
              <h3>Overview</h3>
              <p>{template?.description || 'No description available.'}</p>
            </div>

            {/* Features */}
            {template?.highlights && template.highlights.length > 0 && (
              <div className="features-container">
                <h3>Features</h3>
                <ul>
                  {template.highlights.map((h, i) => (
                    <li key={i}>
                      <Check size={12} className="bullet-chk" />
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Technical details list */}
            {template?.details && template.details.length > 0 && (
              <div className="tech-details-container">
                {template.details.map((d, i) => (
                  <div key={i} className="tech-row">
                    <span className="lbl">{d.label}:</span>
                    <span className="val">{d.value}</span>
                  </div>
                ))}
              </div>
            )}

            {/* License details link */}
            <div className="license-link-wrap">
              <button className="license-terms-btn" onClick={() => setLicenseModalOpen(true)}>
                <ShieldCheck size={14} />
                <span>Template License & Usage Terms</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Recommended similar templates */}
      {similarTemplates.length > 0 && (
        <div className="similar-section">
          <h2>You may also like</h2>
          <div className="similar-grid">
            {similarTemplates.map((tpl) => (
              <div
                key={tpl.id}
                className="similar-card"
                onClick={() => router.push(`/templates/${tpl.id}`)}
              >
                <div className="similar-img-frame">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={tpl.images?.[0]?.url || 'https://picsum.photos/id/10/800/600'} alt="" />
                </div>
                <div className="similar-title">{tpl.title}</div>
                <div className="similar-cost">€7.05</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lightbox Overlay Modal */}
      {showLightbox && (
        <div className="lightbox-overlay" onClick={() => setShowLightbox(false)}>
          <button className="lightbox-close-btn" onClick={() => setShowLightbox(false)}>
            <X size={24} />
          </button>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <button className="lightbox-nav-btn prev" onClick={() => navigateImage('left')}>
              <ChevronLeft size={32} />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={images[currentImageIndex]} alt="" className="lightbox-main-img" />
            <button className="lightbox-nav-btn next" onClick={() => navigateImage('right')}>
              <ChevronRight size={32} />
            </button>
          </div>
        </div>
      )}


      {/* License Modal */}
      {licenseModalOpen && (
        <div className="modal-overlay">
          <div className="modal-card license-modal">
            <div className="modal-header">
              <h2>Template License & Usage Terms</h2>
            </div>
            <div className="modal-body">
              <div className="license-rules">
                <div className="rules-block allowed">
                  <h4>What You’re Allowed to Do</h4>
                  <ul>
                    <li>Use the template for your own business</li>
                    <li>Edit, customize, and export</li>
                    <li>Use on digital signage, menus, screens, websites, and social media</li>
                    <li>Unlimited personal and business use</li>
                  </ul>
                </div>
                <div className="rules-block forbidden">
                  <h4>What You’re NOT Allowed to Do</h4>
                  <ul>
                    <li>Resell the template</li>
                    <li>Redistribute the Canva template URL</li>
                    <li>Upload the template to Etsy, CreativeMarket, or other marketplaces</li>
                    <li>Claim the design as your own</li>
                    <li>Sell modified or unmodified versions</li>
                  </ul>
                </div>
              </div>
              <p className="license-note">
                By using this template, you agree to these terms.
                <br />
                <strong>All templates remain the property of DigitalSigns.ai</strong>
              </p>
            </div>
            <div className="modal-footer">
              <button className="modal-btn-confirm block-btn" onClick={() => setLicenseModalOpen(false)}>
                I Understand
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .tpl-detail-page {
          padding: 2.5rem 3rem;
          max-width: 1400px;
          margin: 0 auto;
          animation: fadeIn 0.4s ease-out;
        }
        .template-loading {
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
          display: flex;
          align-items: center;
          justify-content: space-between;
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
        .back-btn:hover {
          color: var(--accent);
        }
        .credits-badge {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: rgba(99, 102, 241, 0.08);
          border: 1px solid rgba(99, 102, 241, 0.25);
          padding: 0.35rem 0.5rem 0.35rem 0.75rem;
          border-radius: 40px;
          font-size: 0.8rem;
          font-weight: 600;
        }
        .credits-icon {
          color: var(--accent);
        }
        .credits-val {
          font-size: 0.9rem;
          font-weight: 800;
          color: var(--text);
        }
        .credits-lbl {
          color: var(--text-muted);
        }
        .buy-more-btn {
          background: var(--accent);
          color: white;
          border: none;
          padding: 0.25rem 0.75rem;
          border-radius: 20px;
          font-size: 0.73rem;
          font-weight: 700;
          cursor: pointer;
          margin-left: 0.25rem;
          transition: opacity 0.15s;
        }
        .buy-more-btn:hover {
          opacity: 0.9;
        }

        /* Layout Grid */
        .detail-grid {
          display: grid;
          grid-template-columns: 1.25fr 0.75fr;
          gap: 4rem;
          align-items: start;
          margin-top: 1rem;
        }

        /* Gallery */
        .gallery-section {
          display: flex;
          gap: 1rem;
          width: 100%;
        }
        .thumb-col {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          flex-shrink: 0;
        }
        .thumb-btn {
          width: 60px;
          height: 60px;
          border-radius: 8px;
          border: 1.5px solid var(--border);
          background: var(--card-bg);
          padding: 2px;
          cursor: pointer;
          overflow: hidden;
          transition: all 0.15s;
        }
        .thumb-btn.active {
          border-color: var(--accent);
          box-shadow: 0 0 0 2px var(--accent-light);
        }
        .thumb-btn img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: 6px;
        }
        .preview-container {
          position: relative;
          flex: 1;
          background: transparent;
          border: none;
          border-radius: 0;
          overflow: visible;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          cursor: zoom-in;
        }
        .main-preview-img {
          width: auto;
          max-width: 100%;
          max-height: 82vh;
          object-fit: contain;
          border-radius: 4px;
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
        }
        .nav-arrow {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: rgba(0, 0, 0, 0.45);
          color: white;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.15s;
          z-index: 5;
        }
        .nav-arrow:hover {
          background: rgba(0, 0, 0, 0.7);
        }
        .nav-arrow.left { left: 12px; }
        .nav-arrow.right { right: 12px; }
        .zoom-indicator {
          position: absolute;
          bottom: 12px;
          right: 12px;
          background: rgba(0, 0, 0, 0.55);
          color: white;
          display: flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.35rem 0.75rem;
          border-radius: 20px;
          font-size: 0.7rem;
          font-weight: 600;
          backdrop-filter: blur(2px);
          pointer-events: none;
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
        .price-box {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-top: 1px solid var(--border);
          border-bottom: 1px solid var(--border);
          padding: 1.5rem 0;
          margin: 1.75rem 0;
        }
        .cash-price {
          display: flex;
          flex-direction: column;
        }
        .cash-price .amt {
          font-size: 1.8rem;
          font-weight: 800;
          color: var(--text);
          line-height: 1;
        }
        .cash-price .vat {
          font-size: 0.72rem;
          color: var(--text-muted);
          margin-top: 0.25rem;
        }
        .credit-price {
          text-align: right;
          display: flex;
          flex-direction: column;
        }
        .credit-price .lbl {
          font-size: 0.73rem;
          color: var(--text-muted);
          font-weight: 700;
          text-transform: uppercase;
        }
        .credit-price .val {
          font-size: 1.4rem;
          font-weight: 800;
          color: var(--accent);
        }

        /* Actions */
        .actions-box {
          margin-bottom: 2rem;
        }
        .btn-unlock-action {
          width: 100%;
          background: #7D2AE8;
          color: #fff;
          border: none;
          padding: 0.85rem;
          border-radius: 10px;
          font-size: 0.92rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 2px 8px rgba(37, 99, 235, 0.15);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .btn-unlock-action:hover {
          background: #6a21cb;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25);
        }
        .btn-unlock-action:active {
          transform: translateY(0);
        }
        .btn-unlock-action.secondary {
          background: var(--btn-secondary-bg);
          color: var(--btn-secondary-text);
          border: 1px solid var(--btn-secondary-border);
          box-shadow: none;
        }
        .btn-unlock-action.secondary:hover {
          background: var(--btn-secondary-hover);
        }
        .btn-unlock-action:disabled {
          opacity: 0.7;
          cursor: not-allowed;
          transform: none;
        }
        .unlock-direct-wrap {
          display: flex;
          flex-direction: column;
          gap: 0.55rem;
        }
        .unlock-cost-summary {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.6rem;
          font-size: 0.78rem;
          color: var(--text-muted);
          padding: 0.4rem 0.75rem;
          background: rgba(37, 99, 235, 0.06);
          border-radius: 8px;
          border: 1px solid rgba(37, 99, 235, 0.12);
        }
        .unlock-cost-summary strong { color: var(--text-primary); }
        .cost-arrow { color: #7D2AE8; font-weight: 700; }
        .owned-tag {
          margin-top: 0.65rem;
          color: #22c55e;
          font-weight: 700;
          font-size: 0.82rem;
          text-align: center;
        }
        .insufficient-box {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        .insufficient-warning {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: rgba(239, 68, 68, 0.08);
          border: 1px solid rgba(239, 68, 68, 0.25);
          color: #ef4444;
          padding: 0.75rem 1rem;
          border-radius: 10px;
          font-size: 0.82rem;
        }

        /* Overview & Highlights */
        .overview-container h3, .features-container h3 {
          font-size: 0.82rem;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.07em;
          margin: 0 0 0.6rem;
        }
        .overview-container p {
          font-size: 0.875rem;
          line-height: 1.5;
          color: var(--text-muted);
          margin: 0 0 1.5rem;
        }
        .features-container ul {
          list-style: none;
          padding: 0;
          margin: 0 0 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 0.45rem;
        }
        .features-container li {
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
          font-size: 0.85rem;
          color: var(--text-muted);
        }
        .bullet-chk {
          color: #22c55e;
          margin-top: 0.2rem;
          flex-shrink: 0;
        }

        /* Tech info list */
        .tech-details-container {
          border-top: 1px solid var(--border);
          padding-top: 1.25rem;
          margin-top: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .tech-row {
          display: flex;
          gap: 0.5rem;
          font-size: 0.85rem;
        }
        .tech-row .lbl {
          font-weight: 600;
          color: var(--text);
        }
        .tech-row .val {
          color: var(--text-muted);
        }
        .license-link-wrap {
          display: flex;
          justify-content: flex-end;
          margin-top: 1.5rem;
        }
        .license-terms-btn {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          background: var(--sidebar-bg);
          border: 1px solid var(--border);
          padding: 0.35rem 0.75rem;
          border-radius: 6px;
          font-size: 0.72rem;
          color: var(--text-muted);
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
        }
        .license-terms-btn:hover {
          border-color: var(--accent);
          color: var(--accent);
        }

        /* Recommendations */
        .similar-section {
          margin-top: 3.5rem;
        }
        .similar-section h2 {
          font-size: 1.1rem;
          font-weight: 800;
          margin: 0 0 1.25rem;
        }
        .similar-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 1rem;
        }
        .similar-card {
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 12px;
          overflow: hidden;
          cursor: pointer;
          transition: all 0.15s;
          box-shadow: 0 2px 6px rgba(0,0,0,0.04);
        }
        .similar-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(0,0,0,0.12);
        }
        .similar-img-frame {
          aspect-ratio: 4/3;
          overflow: hidden;
          background: var(--bg-base);
        }
        .similar-img-frame img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .similar-title {
          padding: 8px 10px 2px;
          font-size: 0.78rem;
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .similar-cost {
          padding: 0 10px 8px;
          font-size: 0.7rem;
          color: var(--text-muted);
        }

        /* Lightbox */
        .lightbox-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.9);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .lightbox-close-btn {
          position: absolute;
          top: 16px;
          right: 16px;
          background: none;
          border: none;
          color: white;
          cursor: pointer;
        }
        .lightbox-content {
          display: flex;
          align-items: center;
          justify-content: center;
          max-width: 90vw;
          max-height: 85vh;
          gap: 1.5rem;
        }
        .lightbox-main-img {
          max-width: 75vw;
          max-height: 80vh;
          object-fit: contain;
        }
        .lightbox-nav-btn {
          background: rgba(255,255,255,0.1);
          border: none;
          color: white;
          width: 48px;
          height: 48px;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.15s;
        }
        .lightbox-nav-btn:hover {
          background: rgba(255,255,255,0.25);
        }

        /* Dialogs / Modals */
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
        .modal-card {
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 20px;
          width: 420px;
          max-width: 95vw;
          box-shadow: 0 20px 50px rgba(0,0,0,0.3);
          padding: 1.75rem;
          animation: modal-in 0.2s ease;
        }
        .modal-card.license-modal {
          width: 640px;
        }
        .modal-header h2 {
          font-size: 1.15rem;
          font-weight: 800;
          margin: 0 0 0.25rem;
        }
        .modal-header p {
          font-size: 0.8rem;
          color: var(--text-muted);
          margin: 0 0 1.25rem;
        }
        .tpl-name-row {
          background: var(--sidebar-bg);
          border: 1px solid var(--border);
          padding: 0.75rem 1rem;
          border-radius: 10px;
          font-weight: 700;
          font-size: 0.9rem;
          margin-bottom: 1.25rem;
        }
        .balance-breakdown {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          margin-bottom: 1.25rem;
        }
        .break-row {
          display: flex;
          justify-content: space-between;
          font-size: 0.85rem;
        }
        .break-row .lbl {
          color: var(--text-muted);
        }
        .break-row .val {
          font-weight: 600;
        }
        .break-row.cost .val {
          color: #ef4444;
        }
        .balance-breakdown .divider {
          border: none;
          border-top: 1px solid var(--border);
          margin: 0.25rem 0;
        }
        .break-row.remaining {
          font-size: 0.9rem;
          font-weight: 700;
        }
        .break-row.remaining .val {
          color: var(--accent);
        }
        .agreed-txt {
          font-size: 0.73rem;
          color: var(--text-muted);
          line-height: 1.5;
          text-align: center;
          margin: 1.25rem 0 0;
        }
        .agreed-txt .link-lbl {
          color: var(--accent);
          text-decoration: underline;
          cursor: pointer;
        }
        .safe-lbl {
          color: #22c55e;
          font-weight: 700;
        }
        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 0.75rem;
          margin-top: 1.5rem;
        }
        .modal-btn-cancel {
          background: transparent;
          border: 1px solid var(--border);
          color: var(--text);
          padding: 0.55rem 1.25rem;
          border-radius: 10px;
          font-size: 0.85rem;
          cursor: pointer;
        }
        .modal-btn-cancel:hover {
          border-color: var(--text-muted);
        }
        .modal-btn-confirm {
          background: var(--btn-cta-bg);
          color: var(--btn-cta-text);
          border: none;
          padding: 0.55rem 1.25rem;
          border-radius: 10px;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
        }
        .modal-btn-confirm:hover {
          background: var(--btn-cta-hover);
        }
        .modal-btn-confirm.block-btn {
          width: 100%;
        }

        /* License lists */
        .license-rules {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.25rem;
          margin-top: 1rem;
        }
        .rules-block h4 {
          font-size: 0.82rem;
          font-weight: 700;
          text-transform: uppercase;
          margin: 0 0 0.5rem;
        }
        .rules-block.allowed h4 { color: #22c55e; }
        .rules-block.forbidden h4 { color: #ef4444; }
        .rules-block ul {
          padding-left: 1.25rem;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }
        .rules-block li {
          font-size: 0.78rem;
          color: var(--text-muted);
          line-height: 1.4;
        }
        .license-note {
          text-align: center;
          font-size: 0.75rem;
          color: var(--text-muted);
          margin-top: 1.5rem;
          line-height: 1.4;
        }

        @media (max-width: 1024px) {
          .detail-grid { grid-template-columns: 1fr; gap: 2.5rem; }
          .similar-grid { grid-template-columns: repeat(3, 1fr); }
        }
        @media (max-width: 640px) {
          .tpl-detail-page { padding: 1.5rem 1.5rem; }
          .gallery-section { flex-direction: column-reverse; }
          .thumb-col { flex-direction: row; }
          .similar-grid { grid-template-columns: repeat(2, 1fr); }
          .license-rules { grid-template-columns: 1fr; }
        }
      `}</style>
      {upgradeModal && <UpgradeModal mode={upgradeModal} onClose={closeUpgrade} />}
    </div>
  );
}
