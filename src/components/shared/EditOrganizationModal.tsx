'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  isValidPhoneNumber,
  AsYouType,
} from 'libphonenumber-js/min';
import { X, Building2, Save, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { omsApi } from '@/lib/api';
import { useDSStore } from '@/store/useDSStore';
import { useLanguage } from '@/context/LanguageContext';

const orgSchema = z.object({
  organization: z.string().min(1, 'Organization name is required'),
  address: z.string().min(1, 'Address is required'),
  contactEmailId: z.string().email('Valid email required'),
  contactNumber: z
    .string()
    .min(1, 'Phone number is required')
    .refine(
      (val) => isValidPhoneNumber(val),
      'Please enter a valid international phone number (e.g. +1 555 000 0000)'
    ),
});

type OrgForm = z.infer<typeof orgSchema>;

interface EditOrganizationModalProps {
  open: boolean;
  onClose: () => void;
}

export const EditOrganizationModal: React.FC<EditOrganizationModalProps> = ({ open, onClose }) => {
  const { t } = useLanguage();
  const currentUser = useDSStore((state) => state.currentUser);
  const setCurrentUser = useDSStore((state) => state.setCurrentUser);

  const [orgId, setOrgId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  // Derived: we have data once orgId has been set after the GET resolved.
  const loading = orgId === null;

  const orgForm = useForm<OrgForm>({ resolver: zodResolver(orgSchema) });

  // Load org data whenever the modal opens.
  // The fetch repopulates both orgId and form fields, so stale values
  // from a previous open are overwritten as soon as the GET resolves.
  useEffect(() => {
    if (!open) return;
    omsApi.get('/organization')
      .then(({ data }) => {
        setOrgId(data.id);
        orgForm.reset({
          organization: data.name,
          address: data.address,
          contactEmailId: data.contactEmailId || '',
          contactNumber: data.contactNumber || '',
        });
      })
      .catch(() => toast.error('Failed to load organization data'));
  }, [open, orgForm]);

  // ESC key closes the modal
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function onOrgSubmit(data: OrgForm) {
    if (!orgId) return;
    setSaving(true);
    try {
      await omsApi.put('/organization', { id: orgId, name: data.organization, ...data });
      toast.success('Organization updated successfully');

      // Merge the fresh fields into the Zustand store so the header
      // swaps the amber CTA for the real org name without a reload.
      if (currentUser) {
        const updatedUser = {
          ...currentUser,
          organization: {
            ...(currentUser.organization || {}),
            id: orgId,
            name: data.organization,
            address: data.address,
            contactEmailId: data.contactEmailId,
            contactNumber: data.contactNumber,
          },
        };
        setCurrentUser(updatedUser);
        if (typeof window !== 'undefined') {
          localStorage.setItem('currentUser', JSON.stringify(updatedUser));
        }
      }

      onClose();
    } catch {
      toast.error('Failed to update organization');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      {/* Modal card — stop click propagation so inside clicks don't close it */}
      <div
        style={{ background: 'var(--bg-base)', color: 'var(--text)', border: '1px solid var(--border)' }}
        className="w-full max-w-[520px] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2">
            <Building2 size={18} style={{ color: 'var(--text-muted)' }} />
            <h2 className="text-base font-bold tracking-tight">
              {t('MY_ACCOUNT.org_details_title', 'Organization details')}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1 rounded-lg transition-all hover:bg-white/5"
            style={{ color: 'var(--text-muted)' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Subtitle */}
        <p className="px-6 pt-4 text-xs" style={{ color: 'var(--text-muted)' }}>
          {t('MY_ACCOUNT.org_details_sub', 'Tell us about your organization so screens, playlists, and invoices can be branded correctly.')}
        </p>

        {/* Form */}
        <form onSubmit={orgForm.handleSubmit(onOrgSubmit)} className="px-6 py-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              {t('MY_ACCOUNT.organization_name', 'Organization name')}
            </label>
            <input
              {...orgForm.register('organization')}
              disabled={loading}
              placeholder="Acme Inc."
              className="px-3 py-2 rounded-lg text-sm outline-none transition-all disabled:opacity-50"
              style={{
                background: 'var(--bg-base)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
              }}
            />
            {orgForm.formState.errors.organization && (
              <span className="text-[11px] text-red-500 mt-0.5">
                {orgForm.formState.errors.organization.message}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              {t('LOCATIONS.address', 'Address')}
            </label>
            <input
              {...orgForm.register('address')}
              disabled={loading}
              placeholder="123 Main Street"
              className="px-3 py-2 rounded-lg text-sm outline-none transition-all disabled:opacity-50"
              style={{
                background: 'var(--bg-base)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
              }}
            />
            {orgForm.formState.errors.address && (
              <span className="text-[11px] text-red-500 mt-0.5">
                {orgForm.formState.errors.address.message}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                {t('MY_ACCOUNT.contact_email', 'Contact email')}
              </label>
              <input
                {...orgForm.register('contactEmailId')}
                type="email"
                disabled={loading}
                placeholder="contact@company.com"
                className="px-3 py-2 rounded-lg text-sm outline-none transition-all disabled:opacity-50"
                style={{
                  background: 'var(--bg-base)',
                  color: 'var(--text)',
                  border: '1px solid var(--border)',
                }}
              />
              {orgForm.formState.errors.contactEmailId && (
                <span className="text-[11px] text-red-500 mt-0.5">
                  {orgForm.formState.errors.contactEmailId.message}
                </span>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                {t('MY_ACCOUNT.contact_number', 'Contact number')}
              </label>
              <input
                {...orgForm.register('contactNumber')}
                type="tel"
                inputMode="tel"
                disabled={loading}
                maxLength={25}
                placeholder="+1 555 000 0000"
                onChange={(e) => {
                  // Live-format as the user types using libphonenumber-js.
                  // Auto-adds spaces, parens, hyphens, and the leading +.
                  // AsYouType doesn't enforce a length cap, so we strip
                  // any digits beyond the E.164 max of 15 to prevent the
                  // user from typing absurdly long numbers like
                  // "+1 34567778888999999008658595957".
                  const ayt = new AsYouType();
                  let formatted = ayt.input(e.target.value);
                  const digits = formatted.replace(/\D/g, '');
                  if (digits.length > 15) {
                    const keep = 15;
                    let kept = 0;
                    let out = '';
                    for (const ch of formatted) {
                      if (/\d/.test(ch)) {
                        if (kept >= keep) continue;
                        kept++;
                      }
                      out += ch;
                    }
                    formatted = out;
                  }
                  if (formatted !== e.target.value) {
                    e.target.value = formatted;
                  }
                  orgForm.setValue('contactNumber', formatted, { shouldValidate: true });
                }}
                className="px-3 py-2 rounded-lg text-sm outline-none transition-all disabled:opacity-50"
                style={{
                  background: 'var(--bg-base)',
                  color: 'var(--text)',
                  border: '1px solid var(--border)',
                }}
              />
              {orgForm.formState.errors.contactNumber && (
                <span className="text-[11px] text-red-500 mt-0.5">
                  {orgForm.formState.errors.contactNumber.message}
                </span>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold transition-all"
              style={{ color: 'var(--text-muted)', background: 'transparent' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || loading}
              id="modal-save-org-btn"
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
              style={{ background: 'var(--primary, #3b82f6)', color: '#fff' }}
            >
              {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
              {t('MY_ACCOUNT.save_changes', 'Save changes')}
            </button>
          </div>
        </form>
      </div>

      {/* Spin animation for the loader icon — matches the convention used in my-account/page.tsx */}
      <style>{`
        @keyframes ds-spin { to { transform: rotate(360deg); } }
        .animate-spin { animation: ds-spin 0.8s linear infinite; }
      `}</style>
    </div>
  );
};

export default EditOrganizationModal;
