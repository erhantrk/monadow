import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';
import { Background, BrowserWindow, C, Mark } from './ui';

// 1920x1080 thumbnail (downscaled to 1280x720 afterwards).
export const Thumb: React.FC = () => (
  <AbsoluteFill style={{ background: C.bg }}>
    <Background frame={40} />
    <div style={{ position: 'absolute', right: -40, top: 120, transform: 'perspective(2000px) rotateY(-14deg) rotateX(4deg)', transformOrigin: '0 50%' }}>
      <BrowserWindow width={980} height={980 * 810 / 960 + 34} bar={34} url="erhantrk.github.io/monadow" actor={{ name: 'Bob', role: 'recipient' }}>
        <Img src={staticFile('thumb-app.png')} style={{ width: 980, display: 'block' }} />
      </BrowserWindow>
    </div>
    <div style={{ position: 'absolute', left: 110, top: 250, width: 820 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
        <Mark size={96} glow={1.5} />
        <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 92, color: '#fff', letterSpacing: -3 }}>Monadow</div>
      </div>
      <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 84, lineHeight: 1.02, color: '#fff', marginTop: 40, letterSpacing: -2 }}>
        Live demo:<br />
        <span style={{ background: `linear-gradient(90deg, ${C.monPale}, ${C.mon})`, WebkitBackgroundClip: 'text', color: 'transparent' }}>private payments</span><br />
        from one passkey
      </div>
      <div style={{ marginTop: 40, display: 'inline-flex', alignItems: 'center', gap: 12, fontFamily: 'Inter', fontSize: 28, fontWeight: 600, color: C.monLight, padding: '10px 24px', borderRadius: 999, border: `1.5px solid ${C.mon}88`, background: `${C.mon}1a` }}>
        <span style={{ width: 12, height: 12, borderRadius: 6, background: C.ok, boxShadow: `0 0 12px ${C.ok}` }} /> Real txs on Monad testnet
      </div>
    </div>
  </AbsoluteFill>
);
