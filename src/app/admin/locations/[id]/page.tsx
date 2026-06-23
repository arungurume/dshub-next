'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  MapPin, ArrowLeft, Save, RefreshCw, ChevronDown
} from 'lucide-react';
import { omsApi, umsApi } from '@/lib/api';
import useLoadGooglePlaces from '@/hooks/useLoadGooglePlaces';
import { useRef } from 'react';
import { useLanguage } from '@/context/LanguageContext';

// ─── Schema ───────────────────────────────────────────────────────────────────

const locationSchema = z.object({
  name: z.string().min(1, 'Location name is required'),
  address: z.string().min(1, 'Address is required'),
  contactPerson: z.string().min(1, 'Contact person is required'),
  contactEmail: z.string().email('Valid email required'),
  contactNumber: z.string().min(5, 'Phone number is required').regex(/^[0-9+\-\s]{5,}$/, 'Invalid phone number'),
  timezone: z.string().min(1, 'Timezone is required').optional(),
});

type LocationForm = z.infer<typeof locationSchema>;

// ─── Timezone data (from Angular tz.json pattern) ─────────────────────────────

const COMMON_TIMEZONES = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Sao_Paulo', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Moscow',
  'Asia/Dubai', 'Asia/Kolkata', 'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney',
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function LocationDetailPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const params = useParams();
  const locationId = Number(params.id);
  const isNew = locationId === 0;

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [orgId, setOrgId] = useState<string>('');

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<LocationForm>({ resolver: zodResolver(locationSchema) });

  const { isLoaded } = useLoadGooglePlaces();
  const addressInputRef = useRef<HTMLInputElement | null>(null);
  const autocompleteRef = useRef<any>(null);

  useEffect(() => {
    if (isLoaded && addressInputRef.current && (window as any).google?.maps?.places) {
      if (!autocompleteRef.current) {
        autocompleteRef.current = new (window as any).google.maps.places.Autocomplete(addressInputRef.current, {
          fields: ['formatted_address'],
        });
        autocompleteRef.current.addListener('place_changed', () => {
          const place = autocompleteRef.current.getPlace();
          if (place.formatted_address) {
            setValue('address', place.formatted_address, { shouldValidate: true, shouldDirty: true });
          }
        });
      }
    }
  }, [isLoaded, setValue]);

  // ── Load org id then location ──
  useEffect(() => {
    // Get orgId from user first
    umsApi.get('/me/user').then(({ data }) => {
      const u = Array.isArray(data) ? data[0] : data;
      const oid = u.organizationId?.toString() || '';
      setOrgId(oid);
      if (!isNew && oid) {
        setLoading(true);
        omsApi.get(`/organization/${oid}/location/${locationId}`)
          .then(({ data: loc }) => {
            reset({
              name: loc.name || '',
              address: loc.address || '',
              contactPerson: loc.contactPerson || '',
              contactEmail: loc.contactEmail || loc.contactEmailId || '',
              contactNumber: loc.contactNumber || '',
              timezone: loc.timezone || '',
            });
          })
          .catch(() => toast.error(t('LOCATIONS.toast_load_single_failed')))
          .finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    }).catch(() => setLoading(false));
  }, [locationId, isNew, reset, t]);

  // ── Submit ──
  async function onSubmit(data: LocationForm) {
    setSaving(true);
    try {
      if (isNew) {
        await omsApi.put('/location/create', data);
        toast.success(t('LOCATIONS.toast_create_success'));
      } else {
        await omsApi.put('/location', { id: locationId, ...data });
        toast.success(t('LOCATIONS.toast_update_success'));
      }
      router.push('/admin/locations');
    } catch {
      toast.error(isNew ? t('LOCATIONS.toast_create_failed') : t('LOCATIONS.toast_update_failed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="loc-detail-page">
      {/* Nav */}
      <div className="loc-detail-nav">
        <button className="back-btn" onClick={() => router.push('/admin/locations')} id="back-to-locations">
          <ArrowLeft size={14} />
          {t('LOCATIONS.nav_locations')}
        </button>
        <span className="nav-sep">/</span>
        <span className="nav-current">{isNew ? t('LOCATIONS.new_location') : t('LOCATIONS.edit_location')}</span>
      </div>

      {/* Card */}
      <div className="loc-detail-card">
        <div className="loc-detail-header">
          <div className="loc-detail-icon">
            <MapPin size={22} />
          </div>
          <div>
            <h1 className="loc-detail-title">
              {isNew ? t('LOCATIONS.create_new_location') : t('LOCATIONS.edit_location')}
            </h1>
            <p className="loc-detail-sub">
              {isNew ? t('LOCATIONS.add_new_location_desc') : t('LOCATIONS.update_location_desc')}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="loc-loading">
            <RefreshCw size={20} className="spin" />
            <span>{t('LOCATIONS.loading_location')}</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="loc-form">
            {/* Location name */}
            <div className="form-section">
              <h2 className="form-section-title">{t('LOCATIONS.basic_information')}</h2>
              <div className="form-grid">
                <div className="form-group form-span-2">
                  <label>{t('LOCATIONS.location_name')} <span className="required">*</span></label>
                  <input
                    {...register('name')}
                    id="loc-name"
                    placeholder="e.g. Head Office – New York"
                  />
                  {errors.name && <span className="field-error">{t('LOCATIONS.err_name_required')}</span>}
                </div>

                <div className="form-group form-span-2">
                  <label>{t('LOCATIONS.address')} <span className="required">*</span></label>
                  <input
                    {...register('address')}
                    ref={(e) => {
                      register('address').ref(e);
                      addressInputRef.current = e;
                    }}
                    id="loc-address"
                    placeholder="123 Main Street, City, Country"
                  />
                  {errors.address && <span className="field-error">{t('LOCATIONS.err_address_required')}</span>}
                </div>
              </div>
            </div>

            {/* Contact */}
            <div className="form-section">
              <h2 className="form-section-title">{t('LOCATIONS.contact_details')}</h2>
              <div className="form-grid">
                <div className="form-group">
                  <label>{t('LOCATIONS.contact_person')} <span className="required">*</span></label>
                  <input
                    {...register('contactPerson')}
                    id="loc-contact-person"
                    placeholder="Jane Smith"
                  />
                  {errors.contactPerson && <span className="field-error">{t('LOCATIONS.err_contact_person_required')}</span>}
                </div>

                <div className="form-group">
                  <label>{t('LOCATIONS.contact_email')} <span className="required">*</span></label>
                  <input
                    {...register('contactEmail')}
                    id="loc-contact-email"
                    type="email"
                    placeholder="jane@company.com"
                  />
                  {errors.contactEmail && <span className="field-error">{t('LOCATIONS.err_email_invalid')}</span>}
                </div>

                <div className="form-group">
                  <label>{t('LOCATIONS.contact_number')} <span className="required">*</span></label>
                  <input
                    {...register('contactNumber')}
                    id="loc-contact-number"
                    placeholder="+1 555 000 0000"
                  />
                  {errors.contactNumber && (
                    <span className="field-error">
                      {errors.contactNumber.type === 'regex' ? t('LOCATIONS.err_phone_invalid') : t('LOCATIONS.err_phone_required')}
                    </span>
                  )}
                </div>

                <div className="form-group">
                  <label>{t('LOCATIONS.timezone')}</label>
                  <div className="relative">
                    <select {...register('timezone')} id="loc-timezone">
                      <option value="">{t('LOCATIONS.select_timezone')}</option>
                      {COMMON_TIMEZONES.map(tz => (
                        <option key={tz} value={tz}>{tz}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-3.5 text-slate-400 pointer-events-none" />
                  </div>
                  {errors.timezone && <span className="field-error">{t('LOCATIONS.err_timezone_required')}</span>}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="form-actions">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => router.push('/admin/locations')}
                id="cancel-loc-btn"
              >
                {t('LOCATIONS.cancel')}
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={saving}
                id="save-loc-btn"
              >
                {saving ? <RefreshCw size={14} className="spin" /> : <Save size={14} />}
                {isNew ? t('LOCATIONS.create_location') : t('LOCATIONS.save_changes')}
              </button>
            </div>
          </form>
        )}
      </div>

      <style>{`
        .loc-detail-page { padding: 1.5rem 2rem; max-width: 800px; }

        /* Nav breadcrumb */
        .loc-detail-nav { display: flex; align-items: center; gap: .5rem; margin-bottom: 1.25rem; }
        .back-btn {
          display: inline-flex; align-items: center; gap: .4rem;
          background: none; border: none; cursor: pointer; color: var(--accent);
          font-size: .875rem; font-weight: 500; padding: 0;
        }
        .back-btn:hover { text-decoration: underline; }
        .nav-sep { color: var(--text-muted); }
        .nav-current { font-size: .875rem; color: var(--text-muted); }

        /* Card */
        .loc-detail-card {
          background: var(--card-bg); border: 1px solid var(--border);
          border-radius: 18px; overflow: hidden;
        }
        .loc-detail-header {
          display: flex; align-items: center; gap: 1rem;
          padding: 1.5rem 2rem; border-bottom: 1px solid var(--border);
          background: linear-gradient(135deg, rgba(99,102,241,.08), transparent);
        }
        .loc-detail-icon {
          width: 52px; height: 52px; border-radius: 14px; flex-shrink: 0;
          background: var(--btn-cta-bg);
          display: flex; align-items: center; justify-content: center; color: white;
        }
        .loc-detail-title { font-size: 1.1rem; font-weight: 700; margin: 0 0 .2rem; }
        .loc-detail-sub { font-size: .85rem; color: var(--text-muted); margin: 0; }

        /* Loading */
        .loc-loading {
          display: flex; flex-direction: column; align-items: center; gap: .75rem;
          padding: 3rem; color: var(--text-muted);
        }

        /* Form */
        .loc-form { padding: 0; }
        .form-section {
          padding: 1.5rem 2rem;
          border-bottom: 1px solid var(--border);
        }
        .form-section:last-of-type { border-bottom: none; }
        .form-section-title {
          font-size: .75rem; font-weight: 700; letter-spacing: .08em;
          text-transform: uppercase; color: var(--text-muted);
          margin: 0 0 1rem;
        }
        .form-grid {
          display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;
        }
        .form-span-2 { grid-column: span 2; }
        .form-group { display: flex; flex-direction: column; gap: .4rem; }
        .form-group label {
          font-size: .8rem; font-weight: 600; color: var(--text-muted);
          text-transform: uppercase; letter-spacing: .04em;
        }
        .required { color: #ef4444; }
        .form-group input, .form-group select {
          background: var(--sidebar-bg); border: 1px solid var(--border);
          border-radius: 10px; padding: .7rem 1rem; font-size: .9rem; color: var(--text);
          outline: none; transition: border-color .15s; width: 100%; box-sizing: border-box;
        }
        .form-group input:focus, .form-group select:focus { border-color: var(--accent); }
        .field-error { font-size: .75rem; color: #ef4444; }

        /* Actions */
        .form-actions {
          display: flex; justify-content: flex-end; gap: .75rem;
          padding: 1.25rem 2rem; border-top: 1px solid var(--border);
          background: var(--sidebar-bg);
        }

        .btn-primary {
          display: inline-flex; align-items: center; gap: .5rem;
          background: var(--btn-cta-bg); color: var(--btn-cta-text); border: none;
          padding: .65rem 1.5rem; border-radius: 12px; font-size: .875rem; font-weight: 600;
          cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.08); transition: all 0.2s ease;
        }
        .btn-primary:hover { background: var(--btn-cta-hover); }
        .btn-primary:disabled { opacity: .55; cursor: not-allowed; }
        .btn-ghost {
          background: transparent; border: 1px solid var(--border); color: var(--text);
          padding: .65rem 1.5rem; border-radius: 12px; font-size: .875rem; cursor: pointer;
        }
        .btn-ghost:hover { border-color: var(--text-muted); }

        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        @media (max-width: 640px) {
          .loc-detail-page { padding: 1rem; }
          .form-grid { grid-template-columns: 1fr; }
          .form-span-2 { grid-column: span 1; }
          .form-section { padding: 1.25rem 1rem; }
          .form-actions { padding: 1rem; }
        }
      `}</style>
    </div>
  );
}
