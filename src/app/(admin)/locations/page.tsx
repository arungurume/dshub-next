'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  MapPin, Plus, Star, Pencil, Trash2, RefreshCw,
  Building2, Phone, Mail, Lock, X, MoreHorizontal
} from 'lucide-react';
import { omsApi, umsApi, cmsApiV2 } from '@/lib/api';
import { useDSStore } from '@/store/useDSStore';
import { useLanguage } from '@/context/LanguageContext';
import UpgradeModal from '@/components/shared/UpgradeModal';
import { useUpgradeModal } from '@/hooks/useUpgradeModal';


interface Location {
  id: number;
  name: string;
  address: string;
  city?: string;
  state?: string;
  contactPerson?: string;
  contactEmail?: string;
  contactNumber?: string;
  default: boolean;
}

function ConfirmModal({
  title, message, confirmLabel, danger, onConfirm, onClose, loading
}: {
  title: string; message: string; confirmLabel: string; danger?: boolean;
  onConfirm: () => void; onClose: () => void; loading: boolean;
}) {
  const { t } = useLanguage();
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-header">
          <h3>{title}</h3>
          <button onClick={onClose}><X size={16} /></button>
        </div>
        <p className="confirm-msg">{message}</p>
        <div className="confirm-footer">
          <button className="btn-ghost" onClick={onClose}>{t('LOCATIONS.cancel', 'Cancel')}</button>
          <button
            className={danger ? 'btn-danger' : 'btn-primary'}
            onClick={onConfirm} disabled={loading}
            id="confirm-loc-btn"
          >
            {loading && <RefreshCw size={13} className="spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LocationsPage() {
  const { t } = useLanguage();
  const { currentUser } = useDSStore();
  const orgId = currentUser?.organizationId?.toString() || (typeof window !== 'undefined' ? localStorage.getItem('currentUserOrg') : '') || '';
  const router = useRouter();
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [userRole, setUserRole] = useState('');
  const [confirm, setConfirm] = useState<{
    title: string; message: string; label: string; danger?: boolean; action: () => void;
  } | null>(null);
  const { upgradeModal, openUpgrade, closeUpgrade } = useUpgradeModal();
  const [allowedLocations, setAllowedLocations] = useState(3);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);

  useEffect(() => {
    setUserRole(localStorage.getItem('role') || '');
    fetchLocations();
    // Fetch the actual location limit from plan config (free plan + paid entitlements)
    cmsApiV2.get('/sac/plan-config/pricing')
      .then(({ data }) => setAllowedLocations(data?.freePlan?.locations ?? 3))
      .catch(() => {});
  }, []);

  const fetchLocations = useCallback(async () => {
    setLoading(true);
    try {
      const id = orgId || JSON.parse(localStorage.getItem('currentUserOrg') || '{}')?.id || '';
      const { data } = await omsApi.get(`/organization/${id}/location`);
      setLocations(Array.isArray(data) ? data : (data.content || []));
    } catch {
      toast.error(t('LOCATIONS.toast_load_failed'));
    } finally {
      setLoading(false);
    }
  }, [orgId, t]);

  function handleAddNew() {
    if (locations.length >= allowedLocations) {
      openUpgrade('location');
      return;
    }
    router.push('/locations/0');
  }

  function handleSetDefault(loc: Location) {
    setConfirm({
      title: t('LOCATIONS.confirm_default_title'),
      message: `${t('LOCATIONS.confirm_default_msg')} "${loc.name}"`,
      label: t('LOCATIONS.set_default'),
      action: async () => {
        setActionLoading(true);
        try {
          await umsApi.put(`/me/user/location/${loc.id}`, null);
          toast.success(`${t('LOCATIONS.toast_switch_success')} "${loc.name}"`);
          setConfirm(null);
          window.location.reload();
        } catch {
          toast.error(t('LOCATIONS.toast_switch_failed'));
          setActionLoading(false);
        }
      }
    });
  }

  function handleDelete(loc: Location) {
    setConfirm({
      title: t('LOCATIONS.confirm_delete_title'),
      message: `${t('LOCATIONS.confirm_delete_msg')} "${loc.name}"`,
      label: t('LOCATIONS.delete'),
      danger: true,
      action: async () => {
        setActionLoading(true);
        try {
          const id = orgId || JSON.parse(localStorage.getItem('currentUserOrg') || '{}')?.id || '';
          await omsApi.delete(`/organization/location/${loc.id}`);
          toast.success(t('LOCATIONS.toast_delete_success'));
          setConfirm(null);
          fetchLocations();
        } catch {
          toast.error(t('LOCATIONS.toast_delete_failed'));
        } finally {
          setActionLoading(false);
        }
      }
    });
  }

  const isAdmin = userRole === 'ORGANIZATION_ADMIN';

  return (
    <div className="locations-page">
      {/* Banner */}
      <div className="loc-banner">
        <div className="loc-banner-content">
          <h1 className="loc-banner-title">My Locations</h1>
          <p className="loc-banner-desc">Manage all your storefronts and brands from a single account. Add locations for only $10/month.</p>
        </div>
        <div className="loc-banner-icon-bg">
          <MapPin size={160} strokeWidth={1} className="loc-banner-bg-svg" />
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="loc-loading">
          <RefreshCw size={24} className="spin" />
          <span>{t('LOCATIONS.loading_locations')}</span>
        </div>
      ) : (
        <div className="loc-grid">
          {openMenuId !== null && <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />}
          
          {/* Add location card — always visible for admins (moved to front) */}
          {isAdmin && (
            <div
              className={`loc-card loc-card-add${locations.length >= allowedLocations ? ' loc-card-add-locked' : ' loc-card-add-open'}`}
              onClick={handleAddNew}
              id="add-more-loc-btn"
            >
              <div className="loc-add-inner">
                <div className="loc-add-icon">
                  {locations.length >= allowedLocations ? <Lock size={22} /> : <MapPin size={28} />}
                </div>
                <p className="loc-add-label">
                  {locations.length >= allowedLocations
                    ? t('LOCATIONS.add_another_location')
                    : 'Add Location'}
                </p>
                {locations.length >= allowedLocations && (
                  <p className="loc-add-hint">{t('LOCATIONS.upgrade_hint')}</p>
                )}
              </div>
            </div>
          )}

          {locations.length === 0 && !isAdmin && (
            <div className="loc-empty-inline">
              <MapPin size={36} opacity={.25} />
              <h3>{t('LOCATIONS.no_locations_yet')}</h3>
            </div>
          )}

          {locations.map((loc) => (
            <div key={loc.id} className={`loc-card${loc.default ? ' loc-card-default' : ''}`}>
              {/* Default badge / actions */}
              <div className="loc-card-topbar">
                {loc.default ? (
                  <div className="default-ribbon">
                    <Star size={10} fill="currentColor" />
                    {t('LOCATIONS.default')}
                  </div>
                ) : <div />}
                
                {isAdmin && (
                  <div className="relative z-20">
                    <button className="loc-menu-trigger" onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === loc.id ? null : loc.id); }}>
                      <MoreHorizontal size={18} />
                    </button>
                    {openMenuId === loc.id && (
                      <div className="loc-dropdown-menu animate-in fade-in zoom-in-95 duration-100">
                        {!loc.default && (
                          <button onClick={() => { setOpenMenuId(null); handleSetDefault(loc); }} className="loc-dropdown-item">
                            <Star size={13} /> {t('LOCATIONS.set_default')}
                          </button>
                        )}
                        <button onClick={() => { setOpenMenuId(null); router.push(`/locations/${loc.id}`); }} className="loc-dropdown-item">
                          <Pencil size={13} /> {t('LOCATIONS.edit')}
                        </button>
                        {!loc.default && (
                          <button onClick={() => { setOpenMenuId(null); handleDelete(loc); }} className="loc-dropdown-item danger">
                            <Trash2 size={13} /> {t('LOCATIONS.delete')}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Icon & name (Centered) */}
              <div className="loc-card-center-head">
                <div className="loc-icon-large">
                  <MapPin size={24} />
                </div>
                <h3 className="loc-name-centered">{loc.name}</h3>
                <p className="loc-address-centered">{loc.address}</p>
              </div>

              {/* Details (Contact info) */}
              {(loc.contactPerson || loc.contactEmail || loc.contactNumber) && (
                <div className="loc-details-mini">
                  {loc.contactPerson && (
                    <div className="loc-detail-row-mini"><span>{loc.contactPerson}</span></div>
                  )}
                  {loc.contactNumber && (
                    <div className="loc-detail-row-mini"><Phone size={11} /> <span>{loc.contactNumber}</span></div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {confirm && (
        <ConfirmModal
          title={confirm.title}
          message={confirm.message}
          confirmLabel={confirm.label}
          danger={confirm.danger}
          onConfirm={confirm.action}
          onClose={() => { setConfirm(null); setActionLoading(false); }}
          loading={actionLoading}
        />
      )}

      <style>{`
        .locations-page { padding: 1.5rem 2rem; }

        /* Banner */
        .loc-banner {
          background: #3f3f46; color: #fff;
          border-radius: 12px; padding: 2rem 2.5rem;
          margin-bottom: 2rem; position: relative;
          overflow: hidden; display: flex; align-items: center;
        }
        .loc-banner-content { position: relative; z-index: 2; max-width: 600px; }
        .loc-banner-title { font-size: 1.5rem; font-weight: 800; margin: 0 0 .5rem; }
        .loc-banner-desc { font-size: .95rem; color: #a1a1aa; margin: 0; line-height: 1.5; }
        .loc-banner-icon-bg {
          position: absolute; right: -20px; top: -20px;
          color: rgba(255, 255, 255, 0.1); z-index: 1;
        }
        .loc-banner-bg-svg { width: 200px; height: 200px; }

        /* Loading / empty */
        .loc-loading {
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; gap: 1rem; padding: 5rem 2rem;
          color: var(--text-muted); text-align: center;
        }
        .loc-empty-inline {
          grid-column: 1 / -1;
          display: flex; flex-direction: column; align-items: center;
          gap: .75rem; padding: 4rem 2rem;
          color: var(--text-muted); text-align: center;
        }
        .loc-empty-inline h3 { font-size: 1.1rem; font-weight: 600; margin: 0; color: var(--text); }
        .loc-empty-inline p { margin: 0; font-size: .875rem; }

        /* Grid */
        .loc-grid {
          display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 1.25rem;
        }

        /* Card */
        .loc-card {
          background: var(--card-bg); border: 1px solid var(--border);
          border-radius: 16px; padding: 1.25rem; position: relative;
          transition: box-shadow .2s, border-color .2s;
          display: flex; flex-direction: column;
        }
        .loc-card:hover { box-shadow: 0 8px 30px rgba(0,0,0,.08); }
        .loc-card-default {
          border-color: var(--accent);
          box-shadow: 0 0 0 1px var(--accent), 0 4px 24px rgba(99,102,241,.12);
        }

        /* Topbar (Ribbon & Menu) */
        .loc-card-topbar {
          display: flex; justify-content: space-between; align-items: flex-start;
          margin-bottom: 1rem; min-height: 24px;
        }
        .default-ribbon {
          display: inline-flex; align-items: center; gap: .3rem;
          background: var(--accent); color: var(--btn-cta-text);
          font-size: .65rem; font-weight: 700; letter-spacing: .05em;
          padding: .25rem .6rem; border-radius: 999px; text-transform: uppercase;
        }
        
        .loc-menu-trigger {
          background: rgba(0,0,0,0.05); border: none; padding: .35rem;
          border-radius: 50%; color: var(--text-muted); cursor: pointer;
          transition: background .2s, color .2s;
          display: flex; align-items: center; justify-content: center;
        }
        .loc-menu-trigger:hover { background: rgba(0,0,0,0.1); color: var(--text); }
        .dark .loc-menu-trigger { background: rgba(255,255,255,0.05); }
        .dark .loc-menu-trigger:hover { background: rgba(255,255,255,0.1); }
        
        .loc-dropdown-menu {
          position: absolute; right: 0; top: 32px;
          background: var(--card-bg); border: 1px solid var(--border);
          border-radius: 10px; padding: .4rem; min-width: 150px;
          box-shadow: 0 10px 40px rgba(0,0,0,.15); z-index: 30;
        }
        .loc-dropdown-item {
          display: flex; align-items: center; gap: .5rem;
          width: 100%; text-align: left; background: none; border: none;
          padding: .5rem .75rem; font-size: .8rem; font-weight: 600;
          color: var(--text); border-radius: 6px; cursor: pointer;
        }
        .loc-dropdown-item:hover { background: rgba(0,0,0,0.05); }
        .dark .loc-dropdown-item:hover { background: rgba(255,255,255,0.05); }
        .loc-dropdown-item.danger { color: #ef4444; }
        .loc-dropdown-item.danger:hover { background: #fee2e2; }
        .dark .loc-dropdown-item.danger:hover { background: rgba(239, 68, 68, 0.15); }

        /* Centered Head */
        .loc-card-center-head {
          display: flex; flex-direction: column; align-items: center;
          text-align: center; margin-bottom: 1rem;
        }
        .loc-icon-large {
          width: 60px; height: 60px; border-radius: 50%;
          background: #ff4d6d; color: #fff;
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 1rem;
          box-shadow: 0 4px 12px rgba(255, 77, 109, 0.3);
        }
        .loc-name-centered { font-size: 1rem; font-weight: 800; margin: 0 0 .3rem; color: var(--text); }
        .loc-address-centered { font-size: .8rem; color: var(--text-muted); margin: 0; line-height: 1.4; max-width: 90%; }

        /* Details Mini */
        .loc-details-mini {
          display: flex; flex-direction: column; align-items: center;
          gap: .3rem; margin-top: auto; padding-top: 1rem;
          border-top: 1px dashed var(--border);
        }
        .loc-detail-row-mini {
          display: flex; align-items: center; gap: .4rem;
          font-size: .75rem; color: var(--text-muted);
        }

        /* Add location card */
        .loc-card-add {
          cursor: pointer; border-style: dashed;
          display: flex; align-items: center; justify-content: center;
          min-height: 200px; transition: box-shadow .2s, border-color .2s;
        }
        .loc-card-add-open { border-color: var(--accent); }
        .loc-card-add-open:hover {
          box-shadow: 0 4px 24px rgba(0,0,0,.12);
          background: var(--accent-light);
        }
        .loc-card-add-locked { border-color: var(--border); opacity: .75; }
        .loc-card-add-locked:hover { border-color: var(--text-muted); opacity: 1; }
        .loc-add-inner { text-align: center; display: flex; flex-direction: column; align-items: center; }
        .loc-add-icon {
          width: 60px; height: 60px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 1rem;
        }
        .loc-card-add-open .loc-add-icon {
          background: var(--accent-light);
          border: 1px solid var(--accent);
          color: var(--accent);
        }
        .loc-card-add-locked .loc-add-icon {
          background: var(--sidebar-bg);
          border: 1px solid var(--border);
          color: var(--text-muted);
        }
        .loc-add-label { font-size: .9rem; font-weight: 600; margin: 0 0 .25rem; color: var(--text); }
        .loc-add-hint { font-size: .75rem; color: var(--text-muted); margin: 0; }

        /* Confirm modal */
        .modal-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,.5);
          display: flex; align-items: center; justify-content: center;
          z-index: 1000; backdrop-filter: blur(4px);
        }
        .confirm-modal {
          background: var(--card-bg); border: 1px solid var(--border);
          border-radius: 18px; padding: 1.5rem; width: 380px; max-width: 95vw;
          box-shadow: 0 24px 64px rgba(0,0,0,.4);
          animation: modal-in .2s ease;
        }
        @keyframes modal-in { from { opacity:0; transform: scale(.95) translateY(8px); } }
        .confirm-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
        .confirm-header h3 { font-size: 1rem; font-weight: 700; margin: 0; }
        .confirm-header button { border: none; background: none; cursor: pointer; color: var(--text-muted); }
        .confirm-msg { font-size: .875rem; color: var(--text-muted); margin: 0 0 1.5rem; line-height: 1.5; }
        .confirm-footer { display: flex; justify-content: flex-end; gap: .75rem; }

        .btn-primary {
          display: inline-flex; align-items: center; gap: .5rem;
          background: var(--btn-cta-bg); color: var(--btn-cta-text); border: none;
          padding: .6rem 1.25rem; border-radius: 12px; font-size: .875rem; font-weight: 600;
          cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.08); transition: all 0.2s ease;
        }
        .btn-primary:hover { background: var(--btn-cta-hover); }
        .btn-primary:disabled { opacity: .55; cursor: not-allowed; }
        .btn-ghost {
          background: transparent; border: 1px solid var(--border); color: var(--text);
          padding: .6rem 1.25rem; border-radius: 12px; font-size: .875rem; cursor: pointer;
        }
        .btn-danger {
          display: inline-flex; align-items: center; gap: .5rem;
          background: var(--btn-danger-bg); color: white; border: none;
          padding: .6rem 1.25rem; border-radius: 12px; font-size: .875rem; font-weight: 600;
          cursor: pointer; box-shadow: 0 2px 8px rgba(239,68,68,0.2); transition: all 0.2s ease;
        }
        .btn-danger:hover { background: var(--btn-danger-hover); }
        .btn-danger:disabled { opacity: .55; cursor: not-allowed; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
      {upgradeModal && <UpgradeModal mode={upgradeModal} onClose={closeUpgrade} />}
    </div>
  );
}
