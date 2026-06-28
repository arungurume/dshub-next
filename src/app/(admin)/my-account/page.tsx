'use client';

import { useState, useEffect, useTransition } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  User, Building2, Globe, Lock, Camera, Eye, EyeOff,
  Save, RefreshCw, ChevronRight, Check, CreditCard, Puzzle,
  Monitor, Zap, Receipt, BarChart3, Link, ExternalLink, Users
} from 'lucide-react';
import { umsApi, omsApi, cmsApi } from '@/lib/api';
import { useLanguage } from '@/context/LanguageContext';
import { LANG_META, SUPPORTED_LANGUAGES, SupportedLang } from '@/lib/i18n';


// ─── Schemas ─────────────────────────────────────────────────────────────────

const profileSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  userName: z.string().email('Valid email required'),
});

const orgSchema = z.object({
  organization: z.string().min(1, 'Organization name is required'),
  address: z.string().min(1, 'Address is required'),
  contactEmailId: z.string().email('Valid email required'),
  contactNumber: z.string().min(5, 'Phone number is required'),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(6, 'Min 6 characters')
    .regex(/^(?=.*[A-Za-z])(?=.*\d)(?=.*[!@#$%^&*])/, 'Must contain letter, number, and special char'),
  confirmNewPassword: z.string().min(1, 'Please confirm your password'),
}).refine((d) => d.newPassword === d.confirmNewPassword, {
  message: "Passwords don't match",
  path: ['confirmNewPassword'],
});

type ProfileForm = z.infer<typeof profileSchema>;
type OrgForm = z.infer<typeof orgSchema>;
type PasswordForm = z.infer<typeof passwordSchema>;

// TABS is now defined inside the component so it can use t() — see below



// ─── Component ────────────────────────────────────────────────────────────────

export default function MyAccountPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'profile');
  const [user, setUser] = useState<any>(null);
  const [orgId, setOrgId] = useState<number | null>(null);
  const [isGoogleUser, setIsGoogleUser] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  // Billing state
  const [plan, setPlan] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [activeBillingTab, setActiveBillingTab] = useState('usage');
  // Language — wired to global context
  const { lang: selectedLanguage, setLang: setSelectedLanguage, t } = useLanguage();

  // Tabs — inside component so labels react to language changes
  const TABS = [
    { id: 'profile',      label: t('MY_ACCOUNT.tab_profile'),      icon: User },
    { id: 'organization', label: t('MY_ACCOUNT.tab_organization'),  icon: Building2 },
    { id: 'language',     label: t('MY_ACCOUNT.language'),          icon: Globe },
    { id: 'security',     label: t('LOGIN.setting'),                icon: Lock },
    { id: 'billing',      label: t('MY_ACCOUNT.tab_billing'),       icon: CreditCard },
    { id: 'integrations', label: t('MY_ACCOUNT.tab_integrations'),  icon: Puzzle },
  ];

  const profileForm = useForm<ProfileForm>({ resolver: zodResolver(profileSchema) });
  const orgForm = useForm<OrgForm>({ resolver: zodResolver(orgSchema) });
  const passwordForm = useForm<PasswordForm>({ resolver: zodResolver(passwordSchema) });

  // ── Load user & org data ──
  useEffect(() => {
    umsApi.get('/me/user').then(({ data }) => {
      const u = Array.isArray(data) ? data[0] : data;
      setUser(u);
      setIsGoogleUser(u.loginProviderType === 'GOOGLE');
      profileForm.reset({
        userName: u.userName,
        firstName: u.firstName,
        lastName: u.lastName,
      });
    }).catch(() => toast.error('Failed to load account data'));

    omsApi.get('/organization').then(({ data }) => {
      setOrgId(data.id);
      orgForm.reset({
        organization: data.name,
        address: data.address,
        contactEmailId: data.contactEmailId || '',
        contactNumber: data.contactNumber || '',
      });
    }).catch(() => {});

    // Load billing plan & invoices
    cmsApi.get('/sac/my/subscriptions')
      .then(({ data }) => setPlan(Array.isArray(data) ? data[0] : data))
      .catch(() => {});
    cmsApi.get('/sac/my/purchase-history')
      .then(({ data }) => setInvoices(data.purchaseHistory || data.invoices || []))
      .catch(() => {});
  }, []);
  function switchTab(tab: string) {
    setActiveTab(tab);
    router.replace(`?tab=${tab}`, { scroll: false });
  }

  // ── Profile submit ──
  async function onProfileSubmit(data: ProfileForm) {
    if (!user?.id) return;
    setSaving(true);
    try {
      await umsApi.put('/me/user', { id: user.id, ...data });
      toast.success('Profile updated successfully');
    } catch {
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  }

  // ── Org submit ──
  async function onOrgSubmit(data: OrgForm) {
    if (!orgId) return;
    setSaving(true);
    try {
      await omsApi.put('/organization', { id: orgId, name: data.organization, ...data });
      toast.success('Organization updated successfully');
    } catch {
      toast.error('Failed to update organization');
    } finally {
      setSaving(false);
    }
  }

  // ── Password submit ──
  async function onPasswordSubmit(data: PasswordForm) {
    if (isGoogleUser) {
      toast.info('Password change is disabled for Google accounts');
      return;
    }
    setSaving(true);
    try {
      await umsApi.put('/me/user/resetpassword', data);
      toast.success('Password changed successfully');
      passwordForm.reset();
    } catch {
      toast.error('Failed to change password');
    } finally {
      setSaving(false);
    }
  }

  // ── Language save ── (persisted via context automatically)
  function saveLanguage() {
    toast.success('Language preference saved');
  }

  const initials = user
    ? `${user.firstName?.charAt(0) || ''}${user.lastName?.charAt(0) || ''}`.toUpperCase() || '?'
    : '?';

  return (
    <div className="account-page">
      {/* Header */}
      <div className="account-header">
        <div className="account-avatar-wrap">
          <div className="account-avatar">{initials}</div>
          <button className="avatar-upload-btn" title="Change photo">
            <Camera size={14} />
          </button>
        </div>
        <div className="account-header-info">
          <h1 className="account-name">
            {user ? `${user.firstName} ${user.lastName}` : t('MY_ACCOUNT.loading')}
          </h1>
          <p className="account-email">{user?.userName}</p>
          <span className={`account-role-badge role-${user?.roles?.[0]?.name?.toLowerCase().replace('_', '-') || 'user'}`}>
            {user?.roles?.[0]?.name?.replace(/_/g, ' ') || 'User'}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="account-body">
        {/* Sidebar tabs */}
        <nav className="account-tabs">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                id={`account-tab-${tab.id}`}
                className={`account-tab-btn${activeTab === tab.id ? ' active' : ''}`}
                onClick={() => switchTab(tab.id)}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
                <ChevronRight size={14} className="tab-chevron" />
              </button>
            );
          })}
        </nav>

        {/* Tab panels */}
        <div className="account-panel">

          {/* ── Profile ── */}
          {activeTab === 'profile' && (
            <form className="account-form" onSubmit={profileForm.handleSubmit(onProfileSubmit)}>
              <h2 className="panel-title">{t('MY_ACCOUNT.personal_info_title')}</h2>
              <p className="panel-subtitle">{t('MY_ACCOUNT.personal_info_sub')}</p>

              <div className="form-row">
                <div className="form-group">
                  <label>{t('LOGIN.first_name')}</label>
                  <input {...profileForm.register('firstName')} placeholder={t('LOGIN.first_name')} />
                  {profileForm.formState.errors.firstName && (
                    <span className="field-error">{profileForm.formState.errors.firstName.message}</span>
                  )}
                </div>
                <div className="form-group">
                  <label>{t('LOGIN.last_name')}</label>
                  <input {...profileForm.register('lastName')} placeholder={t('LOGIN.last_name')} />
                  {profileForm.formState.errors.lastName && (
                    <span className="field-error">{profileForm.formState.errors.lastName.message}</span>
                  )}
                </div>
              </div>

              <div className="form-group">
                <label>{t('MY_ACCOUNT.email_address')}</label>
                <input {...profileForm.register('userName')} type="email" placeholder="you@example.com" />
                {profileForm.formState.errors.userName && (
                  <span className="field-error">{profileForm.formState.errors.userName.message}</span>
                )}
              </div>

              <div className="form-actions">
                <button type="submit" className="btn-primary" disabled={saving} id="save-profile-btn">
                  {saving ? <RefreshCw size={14} className="spin" /> : <Save size={14} />}
                  {t('MY_ACCOUNT.save_changes')}
                </button>
              </div>
            </form>
          )}

          {/* ── Organization ── */}
          {activeTab === 'organization' && (
            <form className="account-form" onSubmit={orgForm.handleSubmit(onOrgSubmit)}>
              <h2 className="panel-title">{t('MY_ACCOUNT.org_details_title')}</h2>
              <p className="panel-subtitle">{t('MY_ACCOUNT.org_details_sub')}</p>

              <div className="form-group">
                <label>{t('MY_ACCOUNT.organization_name')}</label>
                <input {...orgForm.register('organization')} placeholder="Acme Inc." />
                {orgForm.formState.errors.organization && (
                  <span className="field-error">{orgForm.formState.errors.organization.message}</span>
                )}
              </div>

              <div className="form-group">
                <label>{t('LOCATIONS.address')}</label>
                <input {...orgForm.register('address')} placeholder="123 Main Street" />
                {orgForm.formState.errors.address && (
                  <span className="field-error">{orgForm.formState.errors.address.message}</span>
                )}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>{t('MY_ACCOUNT.contact_email')}</label>
                  <input {...orgForm.register('contactEmailId')} type="email" placeholder="contact@company.com" />
                  {orgForm.formState.errors.contactEmailId && (
                    <span className="field-error">{orgForm.formState.errors.contactEmailId.message}</span>
                  )}
                </div>
                <div className="form-group">
                  <label>{t('MY_ACCOUNT.contact_number')}</label>
                  <input {...orgForm.register('contactNumber')} placeholder="+1 555 000 0000" />
                  {orgForm.formState.errors.contactNumber && (
                    <span className="field-error">{orgForm.formState.errors.contactNumber.message}</span>
                  )}
                </div>
              </div>

              <div className="form-actions">
                <button type="submit" className="btn-primary" disabled={saving} id="save-org-btn">
                  {saving ? <RefreshCw size={14} className="spin" /> : <Save size={14} />}
                  {t('MY_ACCOUNT.save_changes')}
                </button>
              </div>
            </form>
          )}

          {/* ── Organization – Admin Controls (non-form, below form) ── */}
          {activeTab === 'organization' && (
            <div className="admin-controls-strip">
              <div className="admin-control-card">
                <Users size={18} />
                <div>
                  <p className="admin-ctrl-title">{t('MY_ACCOUNT.team_members_short')}</p>
                  <p className="admin-ctrl-desc">{t('MY_ACCOUNT.team_members_desc_short')}</p>
                </div>
                <button className="btn-outline-sm" onClick={() => router.push('/users')} id="manage-team-btn">{t('MY_ACCOUNT.manage')}</button>
              </div>
              <div className="admin-control-card">
                <Monitor size={18} />
                <div>
                  <p className="admin-ctrl-title">{t('MY_ACCOUNT.locations_short')}</p>
                  <p className="admin-ctrl-desc">{t('MY_ACCOUNT.locations_desc_short')}</p>
                </div>
                <button className="btn-outline-sm" onClick={() => router.push('/locations')} id="manage-locations-btn">{t('MY_ACCOUNT.manage')}</button>
              </div>
            </div>
          )}

          {/* ── Language ── */}
          {activeTab === 'language' && (
            <div className="account-form">
              <h2 className="panel-title">{t('MY_ACCOUNT.language_region_title')}</h2>
              <p className="panel-subtitle">{t('MY_ACCOUNT.language_region_sub')}</p>

              <div className="language-grid">
                {SUPPORTED_LANGUAGES.map((code) => {
                  const meta = LANG_META[code];
                  return (
                    <button
                      key={code}
                      id={`lang-${code}`}
                      className={`language-card${selectedLanguage === code ? ' selected' : ''}`}
                      onClick={() => setSelectedLanguage(code as SupportedLang)}
                      type="button"
                    >
                      <span className="lang-flag">{meta.flag}</span>
                      <div className="lang-names">
                        <span className="lang-name">{meta.nativeName}</span>
                        <span className="lang-english">{meta.name}</span>
                      </div>
                      {selectedLanguage === code && <Check size={16} className="lang-check" />}
                    </button>
                  );
                })}
              </div>

              <div className="form-actions">
                <button className="btn-primary" onClick={saveLanguage} type="button" id="save-language-btn">
                  <Check size={14} />
                  {t('MY_ACCOUNT.language_set')}
                </button>
              </div>
            </div>
          )}

          {/* ── Security ── */}
          {activeTab === 'security' && (
            <div className="account-form">
              <h2 className="panel-title">{t('MY_ACCOUNT.security_title')}</h2>
              <p className="panel-subtitle">
                {isGoogleUser
                  ? t('MY_ACCOUNT.security_sub_google')
                  : t('MY_ACCOUNT.security_sub_password')}
              </p>

              {isGoogleUser ? (
                <div className="google-auth-notice">
                  <Globe size={32} />
                  <p>{t('MY_ACCOUNT.google_notice')}</p>
                </div>
              ) : (
                <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)}>
                  <div className="form-group">
                    <label>{t('MY_ACCOUNT.current_password')}</label>
                    <div className="password-wrap">
                      <input
                        {...passwordForm.register('currentPassword')}
                        type={showCurrent ? 'text' : 'password'}
                        placeholder={t('MY_ACCOUNT.current_password_ph')}
                      />
                      <button type="button" className="pw-toggle" onClick={() => setShowCurrent(!showCurrent)}>
                        {showCurrent ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                    {passwordForm.formState.errors.currentPassword && (
                      <span className="field-error">{passwordForm.formState.errors.currentPassword.message}</span>
                    )}
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>{t('MY_ACCOUNT.new_password')}</label>
                      <div className="password-wrap">
                        <input
                          {...passwordForm.register('newPassword')}
                          type={showNew ? 'text' : 'password'}
                          placeholder={t('MY_ACCOUNT.new_password_ph')}
                        />
                        <button type="button" className="pw-toggle" onClick={() => setShowNew(!showNew)}>
                          {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                      {passwordForm.formState.errors.newPassword && (
                        <span className="field-error">{passwordForm.formState.errors.newPassword.message}</span>
                      )}
                    </div>
                    <div className="form-group">
                      <label>{t('MY_ACCOUNT.confirm_new_password')}</label>
                      <div className="password-wrap">
                        <input
                          {...passwordForm.register('confirmNewPassword')}
                          type={showConfirm ? 'text' : 'password'}
                          placeholder={t('MY_ACCOUNT.confirm_password_ph')}
                        />
                        <button type="button" className="pw-toggle" onClick={() => setShowConfirm(!showConfirm)}>
                          {showConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                      {passwordForm.formState.errors.confirmNewPassword && (
                        <span className="field-error">{passwordForm.formState.errors.confirmNewPassword.message}</span>
                      )}
                    </div>
                  </div>

                  <div className="form-actions">
                    <button type="submit" className="btn-primary" disabled={saving} id="change-password-btn">
                      {saving ? <RefreshCw size={14} className="spin" /> : <Lock size={14} />}
                      {t('MY_ACCOUNT.change_password_btn')}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* ── Billing ── */}
          {activeTab === 'billing' && (
            <div className="account-form">
              <h2 className="panel-title">{t('MY_ACCOUNT.billing_title')}</h2>
              <p className="panel-subtitle">{t('MY_ACCOUNT.billing_sub')}</p>
              <div className="billing-sub-tabs">
                {(['usage','history','invoices'] as const).map(tab => (
                  <button key={tab} id={`billing-subtab-${tab}`}
                    className={`billing-sub-btn${activeBillingTab === tab ? ' active' : ''}`}
                    onClick={() => setActiveBillingTab(tab)}>
                    {tab === 'usage' ? <BarChart3 size={14} /> : tab === 'history' ? <Zap size={14} /> : <Receipt size={14} />}
                    {tab === 'usage' ? t('MY_ACCOUNT.billing_usage_tab') : tab === 'history' ? t('MY_ACCOUNT.billing_history_tab') : t('MY_ACCOUNT.billing_invoices_tab')}
                  </button>
                ))}
              </div>
              {activeBillingTab === 'usage' && (
                <div className="billing-usage">
                  <div className="plan-summary-card">
                    <div className="plan-icon"><CreditCard size={22} /></div>
                    <div>
                      <p className="plan-name-lg">{plan?.planType || plan?.metadata?.productName || 'Free Plan'}</p>
                      <p className="plan-meta-sm">{plan?.currentPeriodEnd ? `${t('MY_ACCOUNT.renews_on')} ${new Date(plan.currentPeriodEnd).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}` : t('MY_ACCOUNT.no_active_sub')}</p>
                    </div>
                    <button className="btn-primary btn-sm-inline" onClick={() => router.push('/billing')} id="manage-plan-btn">
                      <ExternalLink size={13} /> {t('MY_ACCOUNT.manage_plan')}
                    </button>
                  </div>
                  <div className="usage-grid">
                    <div className="usage-stat"><Monitor size={18} /><span className="usage-val">{plan?.usedScreens ?? '—'}</span><span className="usage-label">{t('MY_ACCOUNT.screens_used_label')}</span><span className="usage-of">of {plan?.totalScreens ?? '—'}</span></div>
                    <div className="usage-stat"><Zap size={18} /><span className="usage-val">{plan?.canCreateScreen ? t('MY_ACCOUNT.yes') : t('MY_ACCOUNT.no')}</span><span className="usage-label">{t('MY_ACCOUNT.can_add_screens')}</span></div>
                  </div>
                  {plan?.totalScreens > 0 && plan?.usedScreens !== undefined && (
                    <div className="screen-bar-wrap">
                      <div className="screen-bar-label"><span>{t('MY_ACCOUNT.screen_usage_bar')}</span><span>{plan.usedScreens}/{plan.totalScreens}</span></div>
                      <div className="screen-bar-track"><div className="screen-bar-fill" style={{ width: `${Math.min(100,(plan.usedScreens/plan.totalScreens)*100)}%` }} /></div>
                    </div>
                  )}
                </div>
              )}
              {activeBillingTab === 'history' && (
                invoices.length === 0
                  ? <div className="billing-empty"><Receipt size={32} opacity={.2} /><p>{t('MY_ACCOUNT.no_purchases')}</p></div>
                  : <div className="billing-table-wrap"><table className="billing-table"><thead><tr><th>{t('MY_ACCOUNT.billing_col_item')}</th><th>{t('MY_ACCOUNT.billing_col_amount')}</th><th>{t('MY_ACCOUNT.billing_col_date')}</th><th>{t('MY_ACCOUNT.billing_col_status')}</th></tr></thead><tbody>
                      {invoices.map((inv: any, i: number) => (
                        <tr key={inv.id || i}>
                          <td>{inv.description || inv.name || t('MY_ACCOUNT.credit_pack')}</td>
                          <td>{inv.currency?.toUpperCase()} {((inv.amount||0)/100).toFixed(2)}</td>
                          <td className="cell-muted">{inv.created ? new Date(inv.created*1000).toLocaleDateString('en-GB') : '—'}</td>
                          <td><span className={`inv-status ${inv.status==='succeeded'?'st-paid':'st-pending'}`}>{inv.status||'N/A'}</span></td>
                        </tr>
                      ))}
                    </tbody></table></div>
              )}
              {activeBillingTab === 'invoices' && (
                <div className="billing-empty"><Receipt size={32} opacity={.2} /><p>{t('MY_ACCOUNT.invoices_portal')}</p>
                  <button className="btn-primary btn-sm-inline" onClick={() => router.push('/billing')} id="open-billing-portal-btn"><ExternalLink size={14} /> {t('MY_ACCOUNT.open_billing')}</button>
                </div>
              )}
            </div>
          )}

          {/* ── Integrations ── */}
          {activeTab === 'integrations' && (
            <div className="account-form">
              <h2 className="panel-title">{t('MY_ACCOUNT.connected_apps_title')}</h2>
              <p className="panel-subtitle">{t('MY_ACCOUNT.connected_apps_sub')}</p>
              <div className="integrations-list">
                {[
                  { id:'ig', name:'Instagram',  desc:'Social feed integration.',     bg:'#E1306C', label: (searchParams.get('integration') === 'instagram' && searchParams.get('status') === 'success') ? 'Connected' : 'Connect',     disabled:false },
                  { id:'cn', name:'Canva',       desc:'Design and publish directly.', bg:'#00C4CC', label:'Coming Soon', disabled:true  },
                  { id:'to', name:'Toast',       desc:'POS Integration.',             bg:'#ea5b0c', label:'Coming Soon', disabled:true  },
                  { id:'cl', name:'Clover',      desc:'POS Integration.',             bg:'#235d3b', label:'Coming Soon', disabled:true  },
                  { id:'sq', name:'Square POS',  desc:'POS Integration.',             bg:'#000000', label:'Coming Soon', disabled:true  },
                ].map(app => (
                  <div key={app.id} className="integration-row" id={`integration-${app.id}`}>
                    <div className="integration-icon" style={{ background: app.bg }}>{app.name.slice(0,2)}</div>
                    <div className="integration-info">
                      <p className="integration-name">{app.name}</p>
                      <p className="integration-desc">{app.desc}</p>
                    </div>
                    <button 
                      className={app.disabled ? 'btn-outline-sm btn-disabled' : 'btn-primary btn-sm-inline'} 
                      disabled={app.disabled || app.label === 'Connected'} 
                      id={`connect-${app.id}`}
                      onClick={() => {
                        if (app.id === 'ig' && app.label === 'Connect') {
                           toast.success('Redirecting to Instagram to authorize...');
                           setTimeout(() => {
                             router.replace('?tab=integrations&integration=instagram&status=success', { scroll: false });
                             toast.success('Instagram connected successfully!');
                           }, 1500);
                        }
                      }}
                    >
                      <Link size={13} /> {app.label}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

      <style>{`
        .account-page { padding: 1.5rem 2rem; max-width: 1000px; }

        /* Header */
        .account-header {
          display: flex; align-items: center; gap: 1.5rem;
          background: var(--card-bg); border: 1px solid var(--border);
          border-radius: 16px; padding: 1.5rem 2rem; margin-bottom: 1.5rem;
        }
        .account-avatar-wrap { position: relative; flex-shrink: 0; }
        .account-avatar {
          width: 72px; height: 72px; border-radius: 50%;
          background: var(--btn-cta-bg);
          color: white; font-size: 1.5rem; font-weight: 700;
          display: flex; align-items: center; justify-content: center;
        }
        .avatar-upload-btn {
          position: absolute; bottom: 0; right: 0;
          width: 24px; height: 24px; border-radius: 50%;
          background: var(--accent); color: var(--btn-cta-text); border: none; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
        }
        .account-name { font-size: 1.25rem; font-weight: 700; margin: 0 0 .25rem; }
        .account-email { font-size: .875rem; color: var(--text-muted); margin: 0 0 .5rem; }
        .account-role-badge {
          display: inline-block; font-size: .7rem; font-weight: 600;
          padding: .25rem .75rem; border-radius: 999px; text-transform: uppercase; letter-spacing: .05em;
        }
        .role-organization-admin { background: #ede9fe; color: #7c3aed; }
        .role-location-admin { background: #dbeafe; color: #1d4ed8; }
        .role-user { background: #f3f4f6; color: #6b7280; }

        /* Body */
        .account-body { display: flex; gap: 1.5rem; }

        /* Tabs nav */
        .account-tabs {
          width: 220px; flex-shrink: 0;
          background: var(--card-bg); border: 1px solid var(--border);
          border-radius: 16px; padding: .5rem; display: flex; flex-direction: column; gap: .25rem;
          align-self: flex-start;
        }
        .account-tab-btn {
          display: flex; align-items: center; gap: .75rem; padding: .75rem 1rem;
          border-radius: 10px; border: none; cursor: pointer; text-align: left;
          background: transparent; color: var(--text-muted); font-size: .875rem; font-weight: 500;
          transition: all .15s; width: 100%;
        }
        .account-tab-btn:hover { background: var(--sidebar-hover); color: var(--text); }
        .account-tab-btn.active { background: var(--accent); color: var(--btn-cta-text); }
        .account-tab-btn.active .tab-chevron { color: var(--btn-cta-text); }
        .tab-chevron { margin-left: auto; opacity: .5; }
        .account-tab-btn.active .tab-chevron { opacity: 1; }

        /* Panel */
        .account-panel {
          flex: 1; background: var(--card-bg); border: 1px solid var(--border);
          border-radius: 16px; padding: 2rem;
        }
        .panel-title { font-size: 1.1rem; font-weight: 700; margin: 0 0 .25rem; }
        .panel-subtitle { font-size: .875rem; color: var(--text-muted); margin: 0 0 1.5rem; }

        /* Form */
        .account-form {}
        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
        .form-group { display: flex; flex-direction: column; gap: .4rem; margin-bottom: 1rem; }
        .form-group label { font-size: .8rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: .05em; }
        .form-group input, .form-group select {
          background: var(--input-bg, var(--sidebar-bg)); border: 1px solid var(--border);
          border-radius: 10px; padding: .65rem 1rem; font-size: .9rem; color: var(--text);
          outline: none; transition: border-color .15s;
        }
        .form-group input:focus { border-color: var(--accent); }
        .field-error { font-size: .75rem; color: #ef4444; }
        .form-actions { margin-top: 1.5rem; }
        .btn-primary {
          display: inline-flex; align-items: center; gap: .5rem;
          background: var(--btn-cta-bg); color: var(--btn-cta-text); border: none;
          padding: .65rem 1.5rem; border-radius: 12px; font-size: .875rem; font-weight: 600;
          cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.08); transition: all 0.2s ease;
        }
        .btn-primary:hover { background: var(--btn-cta-hover); }
        .btn-primary:disabled { opacity: .55; cursor: not-allowed; }

        /* Password */
        .password-wrap { position: relative; }
        .password-wrap input { width: 100%; padding-right: 2.5rem; box-sizing: border-box; }
        .pw-toggle {
          position: absolute; right: .75rem; top: 50%; transform: translateY(-50%);
          border: none; background: none; cursor: pointer; color: var(--text-muted);
        }

        .language-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; margin-bottom: 1.5rem; }
        .language-card {
          display: flex; align-items: center; gap: .75rem;
          border: 2px solid var(--border); border-radius: 14px;
          padding: 1rem 1.25rem; cursor: pointer; background: var(--sidebar-bg);
          transition: all .2s; position: relative; text-align: left;
        }
        .language-card:hover { border-color: var(--accent); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(99,102,241,.1); }
        .language-card.selected { border-color: var(--accent); background: rgba(99,102,241,.06); box-shadow: 0 0 0 1px var(--accent); }
        .lang-flag { font-size: 1.75rem; flex-shrink: 0; }
        .lang-names { display: flex; flex-direction: column; flex: 1; }
        .lang-name { font-size: .95rem; font-weight: 700; color: var(--text); }
        .lang-english { font-size: .75rem; color: var(--text-muted); margin-top: .1rem; }
        .lang-check { color: var(--accent); flex-shrink: 0; }

        /* Google auth */
        .google-auth-notice {
          display: flex; flex-direction: column; align-items: center;
          gap: 1rem; padding: 2rem; text-align: center;
          color: var(--text-muted); border: 1px dashed var(--border); border-radius: 12px;
        }

        /* Spin */
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* Admin controls strip */
        .admin-controls-strip { display: flex; flex-direction: column; gap: .75rem; margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid var(--border); }
        .admin-control-card { display: flex; align-items: center; gap: 1rem; padding: 1rem 1.25rem; border: 1px solid var(--border); border-radius: 12px; background: var(--sidebar-bg); }
        .admin-control-card > svg { color: var(--accent); flex-shrink: 0; }
        .admin-control-card > div { flex: 1; }
        .admin-ctrl-title { font-size: .9rem; font-weight: 600; margin: 0; }
        .admin-ctrl-desc { font-size: .8rem; color: var(--text-muted); margin: .15rem 0 0; }
        .btn-outline-sm {
          display: inline-flex; align-items: center; gap: .35rem;
          padding: .4rem .9rem; border-radius: 8px; font-size: .8rem; font-weight: 600;
          border: 1px solid var(--border); background: transparent; color: var(--text); cursor: pointer;
          transition: border-color .15s; white-space: nowrap;
        }
        .btn-outline-sm:hover { border-color: var(--accent); color: var(--accent); }
        .btn-disabled { opacity: .5; cursor: not-allowed; }
        .btn-sm-inline { padding: .4rem .9rem; font-size: .8rem; }

        /* Billing sub-tabs */
        .billing-sub-tabs { display: flex; gap: .5rem; margin-bottom: 1.5rem; }
        .billing-sub-btn {
          display: inline-flex; align-items: center; gap: .4rem;
          padding: .45rem 1rem; border-radius: 8px; font-size: .8rem; font-weight: 600;
          border: 1px solid var(--border); background: transparent; color: var(--text-muted); cursor: pointer; transition: all .15s;
        }
        .billing-sub-btn.active { background: var(--accent); color: var(--btn-cta-text); border-color: var(--accent); }
        .billing-sub-btn:hover:not(.active) { border-color: var(--accent); color: var(--accent); }

        /* Plan summary */
        .plan-summary-card { display: flex; align-items: center; gap: 1rem; padding: 1rem 1.25rem; border: 1px solid rgba(99,102,241,.3); border-radius: 12px; background: linear-gradient(135deg,rgba(99,102,241,.08),rgba(139,92,246,.06)); margin-bottom: 1.25rem; }
        .plan-icon { width: 44px; height: 44px; border-radius: 12px; background: var(--accent); display: flex; align-items: center; justify-content: center; color: var(--btn-cta-text); flex-shrink: 0; }
        .plan-name-lg { font-size: 1rem; font-weight: 700; margin: 0; }
        .plan-meta-sm { font-size: .78rem; color: var(--text-muted); margin: .15rem 0 0; }
        .plan-summary-card > button { margin-left: auto; }

        /* Usage stats */
        .usage-grid { display: flex; gap: 1rem; margin-bottom: 1.25rem; }
        .usage-stat { flex: 1; border: 1px solid var(--border); border-radius: 12px; padding: 1rem; display: flex; flex-direction: column; align-items: center; gap: .25rem; background: var(--sidebar-bg); }
        .usage-val { font-size: 1.5rem; font-weight: 800; }
        .usage-label { font-size: .75rem; color: var(--text-muted); text-align: center; }
        .usage-of { font-size: .72rem; color: var(--text-muted); }
        .screen-bar-wrap { margin-bottom: 1rem; }
        .screen-bar-label { display: flex; justify-content: space-between; font-size: .78rem; color: var(--text-muted); margin-bottom: .4rem; }
        .screen-bar-track { height: 8px; background: var(--border); border-radius: 999px; overflow: hidden; }
        .screen-bar-fill { height: 100%; background: var(--accent); border-radius: 999px; transition: width .4s; }

        /* Billing table */
        .billing-table-wrap { border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
        .billing-table { width: 100%; border-collapse: collapse; }
        .billing-table th { text-align: left; padding: .65rem 1rem; font-size: .72rem; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--text-muted); background: var(--sidebar-bg); border-bottom: 1px solid var(--border); }
        .billing-table td { padding: .75rem 1rem; font-size: .875rem; border-bottom: 1px solid var(--border); }
        .billing-table tr:last-child td { border-bottom: none; }
        .cell-muted { color: var(--text-muted); }
        .inv-status { font-size: .7rem; font-weight: 700; padding: .2rem .55rem; border-radius: 999px; }
        .st-paid { background: #dcfce7; color: #16a34a; }
        .st-pending { background: #fef3c7; color: #d97706; }
        .billing-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: .75rem; padding: 3rem 1rem; color: var(--text-muted); text-align: center; }

        /* Integrations */
        .integrations-list { display: flex; flex-direction: column; gap: .75rem; }
        .integration-row { display: flex; align-items: center; gap: 1rem; padding: 1rem 1.25rem; border: 1px solid var(--border); border-radius: 12px; background: var(--sidebar-bg); transition: border-color .15s; }
        .integration-row:hover { border-color: var(--border); }
        .integration-icon { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: .9rem; flex-shrink: 0; }
        .integration-info { flex: 1; }
        .integration-name { font-size: .9rem; font-weight: 600; margin: 0; }
        .integration-desc { font-size: .8rem; color: var(--text-muted); margin: .1rem 0 0; }

        @media (max-width: 768px) {
          .account-body { flex-direction: column; }
          .account-tabs { width: 100%; flex-direction: row; flex-wrap: wrap; }
          .form-row { grid-template-columns: 1fr; }
          .language-grid { grid-template-columns: 1fr 1fr; }
          .usage-grid { flex-direction: column; }
        }
      `}</style>
    </div>
  );
}
