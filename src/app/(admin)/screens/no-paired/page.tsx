'use client';
import { useEffect, useState } from 'react';
import { Monitor, Plus, ExternalLink, ShoppingBag } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import { cmsApiV2 } from '@/lib/api';
import TrialExpiredUpgradeModal, { type TrialScreenSummary } from '@/components/shared/TrialExpiredUpgradeModal';

export default function NoPairedPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [availableSlots, setAvailableSlots] = useState<number | null>(null);
  const [trialExpiredWithActiveScreens, setTrialExpiredWithActiveScreens] = useState(false);
  const [trialScreens, setTrialScreens] = useState<TrialScreenSummary[]>([]);
  const [showTrialModal, setShowTrialModal] = useState(false);
  const [isPaidPlan, setIsPaidPlan] = useState(false);

  useEffect(() => {
    cmsApiV2.get('/sac/my/plan')
      .then(({ data }) => {
        const allowed = data.allowedScreens ?? 0;
        const used    = data.totalScreens   ?? 0;
        setAvailableSlots(Math.max(0, allowed - used));
        setTrialExpiredWithActiveScreens(data.trialExpiredWithActiveScreens ?? false);
        setTrialScreens(data.trialScreens ?? []);
        
        const type = data.planType || '';
        setIsPaidPlan(!['TRIAL_PLAN', 'FREE_PLAN', ''].includes(type));
      })
      .catch(() => setAvailableSlots(0));
  }, []);

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'4rem', gap:'1rem', textAlign:'center', color:'var(--text-muted)' }}>

      {/* Purchased-slots callout — shown when user has paid capacity waiting to be paired */}
      {isPaidPlan && availableSlots !== null && availableSlots > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '.75rem',
          background: 'rgba(16,185,129,.08)', border: '1px solid rgba(16,185,129,.3)',
          borderRadius: '14px', padding: '.9rem 1.4rem', marginBottom: '.5rem',
          maxWidth: '420px', width: '100%',
        }}>
          <ShoppingBag size={20} color="#059669" style={{ flexShrink: 0 }} />
          <div style={{ textAlign: 'left' }}>
            <p style={{ margin: 0, fontSize: '.875rem', fontWeight: 700, color: '#059669' }}>
              You have {availableSlots} purchased screen slot{availableSlots === 1 ? '' : 's'}
            </p>
            <p style={{ margin: '2px 0 0', fontSize: '.8rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Pair a device below to activate {availableSlots === 1 ? 'it' : 'them'}.
            </p>
          </div>
        </div>
      )}

      <Monitor size={56} opacity={.15} />
      <h2 style={{ margin:0, color:'var(--text)', fontSize:'1.25rem', fontWeight:700 }}>{t('SCREENS.no_paired_title')}</h2>
      <p style={{ margin:0, fontSize:'.875rem', maxWidth:'360px', lineHeight:1.6 }}>{t('SCREENS.no_paired_sub')}</p>
      <button
        className="btn-cta"
        style={{ marginTop:'.75rem', fontSize:'.9rem' }}
        onClick={() => {
          if (trialExpiredWithActiveScreens) { setShowTrialModal(true); return; }
          router.push('/screens/new');
        }}
        id="go-pair-screen"
      >
        <Plus size={16} />
        {trialExpiredWithActiveScreens ? 'Reactivate Screens' : t('SCREENS.pair_first')}
      </button>
      <div style={{ display:'flex', gap:'1rem', marginTop:'1rem' }}>
        <a
          href="https://kb.digitalsigns.ai/hc/dssupport/articles/1742605605-adding-screen"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-ghost"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '.4rem', fontSize: '.8rem', padding: '.45rem .8rem', borderRadius: '8px', whiteSpace: 'nowrap' }}
        >
          {t('SCREENS.learn_how')} <ExternalLink size={12} />
        </a>
        <a
          href="https://player.digitalsigns.ai/"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-ghost"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '.4rem', fontSize: '.8rem', padding: '.45rem .8rem', borderRadius: '8px', whiteSpace: 'nowrap' }}
        >
          {t('SCREENS.open_player')} <ExternalLink size={12} />
        </a>
      </div>

      {showTrialModal && trialScreens.length > 0 && (
        <TrialExpiredUpgradeModal
          trialScreens={trialScreens}
          onClose={result => {
            setShowTrialModal(false);
            if (result?.success) router.push('/screens');
          }}
        />
      )}
    </div>
  );
}
