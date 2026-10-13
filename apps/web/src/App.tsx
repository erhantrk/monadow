import type { ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from '@/components/AppShell';
import { Landing } from '@/features/Landing';
import { HomePage } from '@/features/Home';
import { SendPage } from '@/features/Send';
import { InboxPage } from '@/features/Inbox';
import { useIsUnlocked } from '@/store/session';

function Protected({ children }: { children: ReactNode }) {
  const unlocked = useIsUnlocked();
  const location = useLocation();
  // Locked (fresh load, refresh, or after Lock): the landing IS the unlock
  // screen, and one passkey prompt brings you back to where you were.
  if (!unlocked) return <Landing redirectTo={location.pathname} />;
  return <AppShell>{children}</AppShell>;
}

export function App() {
  const unlocked = useIsUnlocked();
  return (
    <Routes>
      <Route path="/" element={unlocked ? <Navigate to="/home" replace /> : <Landing />} />
      <Route path="/home" element={<Protected><HomePage /></Protected>} />
      <Route path="/send" element={<Protected><SendPage /></Protected>} />
      <Route path="/inbox" element={<Protected><InboxPage /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
