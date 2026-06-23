'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  MapPin, Plus, Star, Pencil, Trash2, RefreshCw,
  Building2, Phone, Mail, Lock, X
} from 'lucide-react';
import { omsApi, umsApi } from '@/lib/api';
import { useDSStore } from '@/store/useDSStore';
import { useLanguage } from '@/context/LanguageContext';


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

  useEffect(() => {
    setUserRole(localStorage.getItem('role') || '');
    fetchLocations();
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
    if (locations.length >= 1) {
      toast.info(t('LOCATIONS.upgrade_toast'));
      return;
    }
    router.push('/admin/locations/0');
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
      {/* Header */}
      <div className="loc-toolbar">
        <div className="toolbar-left">
          <MapPin size={20} />
          <h1 className="page-title">{t('LOCATIONS.title')}</h1>
          <span className="count-pill">{locations.length}</span>
        </div>
        {isAdmin && (
          <button className="btn-primary" onClick={handleAddNew} id="add-location-btn">
            <Plus size={14} />
            {t('LOCATIONS.add_location')}
          </button>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="loc-loading">
          <RefreshCw size={24} className="spin" />
          <span>{t('LOCATIONS.loading_locations')}</span>
        </div>
      ) : locations.length === 0 ? (
        <div className="loc-empty">
          <MapPin size={48} opacity={.2} />
          <h3>{t('LOCATIONS.no_locations_yet')}</h3>
          <p>{t('LOCATIONS.add_first_location')}</p>
          {isAdmin && (
            <button className="btn-primary" onClick={() => router.push('/admin/locations/0')} id="create-first-loc-btn">
              <Plus size={14} /> {t('LOCATIONS.create_location')}
            </button>
          )}
        </div>
      ) : (
        <div className="loc-grid">
          {locations.map((loc) => (
            <div key={loc.id} className={`loc-card${loc.default ? ' loc-card-default' : ''}`}>
              {/* Default badge */}
              {loc.default && (
                <div className="default-ribbon">
                  <Star size={11} fill="currentColor" />
                  {t('LOCATIONS.default')}
                </div>
              )}

              {/* Icon & name */}
              <div className="loc-card-head">
                <div className="loc-icon">
                  <Building2 size={20} />
                </div>
                <div>
                  <h3 className="loc-name">{loc.name}</h3>
                  <p className="loc-address">{loc.address}</p>
                </div>
              </div>

              {/* Details */}
              <div className="loc-details">
                {loc.contactPerson && (
                  <div className="loc-detail-row">
                    <span className="detail-label">{t('LOCATIONS.contact')}</span>
                    <span>{loc.contactPerson}</span>
                  </div>
                )}
                {loc.contactEmail && (
                  <div className="loc-detail-row">
                    <Mail size={13} />
                    <span>{loc.contactEmail}</span>
                  </div>
                )}
                {loc.contactNumber && (
                  <div className="loc-detail-row">
                    <Phone size={13} />
                    <span>{loc.contactNumber}</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              {isAdmin && (
                <div className="loc-card-actions">
                  {!loc.default && (
                    <button
                      className="loc-action-btn"
                      onClick={() => handleSetDefault(loc)}
                      id={`set-default-${loc.id}`}
                      title={t('LOCATIONS.set_default')}
                    >
                      <Star size={13} />
                      {t('LOCATIONS.set_default')}
                    </button>
                  )}
                  <button
                    className="loc-action-btn"
                    onClick={() => router.push(`/admin/locations/${loc.id}`)}
                    id={`edit-loc-${loc.id}`}
                  >
                    <Pencil size={13} />
                    {t('LOCATIONS.edit')}
                  </button>
                  {!loc.default && (
                    <button
                      className="loc-action-btn loc-action-danger"
                      onClick={() => handleDelete(loc)}
                      id={`delete-loc-${loc.id}`}
                    >
                      <Trash2 size={13} />
                      {t('LOCATIONS.delete')}
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Add more card (teaser) */}
          {isAdmin && locations.length >= 1 && (
            <div className="loc-card loc-card-add" onClick={handleAddNew} id="add-more-loc-btn">
              <div className="loc-add-inner">
                <div className="loc-add-icon">
                  <Lock size={20} />
                </div>
                <p className="loc-add-label">{t('LOCATIONS.add_another_location')}</p>
                <p className="loc-add-hint">{t('LOCATIONS.upgrade_hint')}</p>
              </div>
            </div>
          )}
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

        .loc-toolbar {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 1.5rem;
        }
        .toolbar-left { display: flex; align-items: center; gap: .75rem; }
        .page-title { font-size: 1.25rem; font-weight: 700; margin: 0; }
        .count-pill {
          background: var(--accent); color: white;
          font-size: .7rem; font-weight: 700; padding: .2rem .6rem; border-radius: 999px;
        }

        /* Loading / empty */
        .loc-loading, .loc-empty {
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; gap: 1rem; padding: 5rem 2rem;
          color: var(--text-muted); text-align: center;
        }
        .loc-empty h3 { font-size: 1.1rem; font-weight: 600; margin: 0; color: var(--text); }
        .loc-empty p { margin: 0; font-size: .875rem; }

        /* Grid */
        .loc-grid {
          display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 1.25rem;
        }

        /* Card */
        .loc-card {
          background: var(--card-bg); border: 1px solid var(--border);
          border-radius: 16px; padding: 1.5rem; position: relative;
          transition: box-shadow .2s, border-color .2s;
        }
        .loc-card:hover { box-shadow: 0 4px 24px rgba(0,0,0,.15); }
        .loc-card-default {
          border-color: var(--accent);
          box-shadow: 0 0 0 1px var(--accent), 0 4px 24px rgba(99,102,241,.15);
        }

        /* Default ribbon */
        .default-ribbon {
          position: absolute; top: 1rem; right: 1rem;
          display: flex; align-items: center; gap: .3rem;
          background: var(--accent); color: white;
          font-size: .65rem; font-weight: 700; letter-spacing: .05em;
          padding: .25rem .6rem; border-radius: 999px; text-transform: uppercase;
        }

        /* Head */
        .loc-card-head { display: flex; align-items: flex-start; gap: 1rem; margin-bottom: 1rem; }
        .loc-icon {
          width: 44px; height: 44px; border-radius: 12px; flex-shrink: 0;
          background: var(--btn-cta-bg);
          display: flex; align-items: center; justify-content: center; color: white;
        }
        .loc-name { font-size: 1rem; font-weight: 700; margin: 0 0 .2rem; }
        .loc-address { font-size: .8rem; color: var(--text-muted); margin: 0; }

        /* Details */
        .loc-details { display: flex; flex-direction: column; gap: .5rem; margin-bottom: 1rem; }
        .loc-detail-row {
          display: flex; align-items: center; gap: .5rem;
          font-size: .8rem; color: var(--text-muted);
        }
        .detail-label { font-weight: 600; color: var(--text); min-width: 60px; }

        /* Actions */
        .loc-card-actions {
          display: flex; gap: .5rem; padding-top: 1rem;
          border-top: 1px solid var(--border); flex-wrap: wrap;
        }
        .loc-action-btn {
          display: inline-flex; align-items: center; gap: .35rem;
          font-size: .75rem; font-weight: 600; padding: .4rem .85rem;
          border-radius: 8px; border: 1px solid var(--border);
          background: transparent; color: var(--text-muted); cursor: pointer;
          transition: all .15s;
        }
        .loc-action-btn:hover { border-color: var(--accent); color: var(--accent); background: var(--accent-light, #ede9fe); }
        .loc-action-btn.loc-action-danger:hover { border-color: #ef4444; color: #ef4444; background: #fee2e2; }

        /* Add more card */
        .loc-card-add {
          cursor: pointer; border-style: dashed;
          display: flex; align-items: center; justify-content: center;
          min-height: 200px;
        }
        .loc-card-add:hover { border-color: var(--accent); }
        .loc-add-inner { text-align: center; }
        .loc-add-icon {
          width: 48px; height: 48px; border-radius: 12px;
          background: var(--sidebar-bg); border: 1px solid var(--border);
          display: flex; align-items: center; justify-content: center;
          color: var(--text-muted); margin: 0 auto 1rem;
        }
        .loc-add-label { font-size: .9rem; font-weight: 600; margin: 0 0 .25rem; }
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
    </div>
  );
}
