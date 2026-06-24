'use client';
import { Monitor, Plus, ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';

export default function NoPairedPage() {
  const router = useRouter();
  const { t } = useLanguage();

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'4rem', gap:'1rem', textAlign:'center', color:'var(--text-muted)' }}>
      <Monitor size={56} opacity={.15} />
      <h2 style={{ margin:0, color:'var(--text)', fontSize:'1.25rem', fontWeight:700 }}>{t('SCREENS.no_paired_title')}</h2>
      <p style={{ margin:0, fontSize:'.875rem', maxWidth:'360px', lineHeight:1.6 }}>{t('SCREENS.no_paired_sub')}</p>
      <button
        className="btn-cta"
        style={{ marginTop:'.75rem', fontSize:'.9rem' }}
        onClick={() => router.push('/screens/new')}
        id="go-pair-screen"
      >
        <Plus size={16} />
        {t('SCREENS.pair_first')}
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
    </div>
  );
}
