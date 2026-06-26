import React from 'react';

export function PreviewTVBezel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(circle at center, rgba(255,255,255,0.03) 0%, transparent 70%)' }}>
      
      {/* TV Bezel */}
      <div style={{ 
        width: '100%', 
        aspectRatio: '16/9', 
        background: 'linear-gradient(to bottom, #1a1a1a, #0a0a0a)', 
        borderRadius: '8px', 
        padding: '12px', 
        paddingBottom: '20px', 
        boxShadow: '0 20px 40px rgba(0,0,0,0.8), inset 0 1px 1px rgba(255,255,255,0.2), inset 0 -2px 5px rgba(0,0,0,0.8)',
        border: '1px solid #333',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Screen */}
        <div style={{ flex: 1, backgroundColor: '#000', borderRadius: '4px', overflow: 'hidden', position: 'relative', boxShadow: 'inset 0 0 20px rgba(0,0,0,0.8)', display: 'flex', flexDirection: 'column' }}>
          {children}
        </div>
        
        {/* TV Hardware Details */}
        <div style={{ position: 'absolute', bottom: '8px', right: '16px', width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#ef4444', boxShadow: '0 0 6px #ef4444' }}></div>
        <div style={{ position: 'absolute', bottom: '10px', left: '50%', transform: 'translateX(-50%)', width: '24px', height: '2px', backgroundColor: '#333', borderRadius: '2px' }}></div>
      </div>
    </div>
  );
}
