import { create } from 'zustand';
import type { LocalAccount, WalletClient } from 'viem';
import type { MonadowClient, MonadowKeys, ReceivedPayment } from 'monadow-sdk';
import { makeMonadowClient, makeWalletClient } from '@/lib/chain';
import type { UnlockResult } from '@/lib/passkey';

export type ScanState = {
  payments: ReceivedPayment[];
  scannedCount: number;
  ms: number;
  at: number;
} | null;

type SessionState = {
  keys: MonadowKeys | null;
  account: LocalAccount | null;
  walletClient: WalletClient | null;
  client: MonadowClient | null;
  credentialId: string | null;
  derivedInMs: number;
  unlockedAt: number;
  // end() for every Mera session we open (account + transient stealth ones) — all run on Lock.
  sessions: Set<() => void>;
  trackSession: (end: () => void) => () => void;
  scan: ScanState;
  setScan: (s: ScanState) => void;
  unlock: (r: UnlockResult) => void;
  lock: () => void;
};

export const useSession = create<SessionState>((set, get) => ({
  keys: null,
  account: null,
  walletClient: null,
  client: null,
  credentialId: null,
  derivedInMs: 0,
  unlockedAt: 0,
  sessions: new Set(),
  scan: null,
  setScan: (scan) => set({ scan }),
  trackSession: (end) => {
    get().sessions.add(end);
    return () => {
      end();
      get().sessions.delete(end);
    };
  },
  unlock: (r) => {
    const walletClient = makeWalletClient(r.account);
    set({
      keys: r.keys,
      account: r.account,
      walletClient,
      client: makeMonadowClient(walletClient),
      credentialId: r.credentialId,
      derivedInMs: r.derivedInMs,
      unlockedAt: Date.now(),
      sessions: new Set([r.endSession]),
      scan: null,
    });
  },
  lock: () => {
    const { sessions, keys } = get();
    for (const s of sessions) {
      try {
        s();
      } catch {
        /* already ended */
      }
    }
    keys?.vaultKey.fill(0);
    set({
      keys: null,
      account: null,
      walletClient: null,
      client: null,
      credentialId: null,
      sessions: new Set(),
      scan: null,
    });
  },
}));

export const useIsUnlocked = () => useSession((s) => s.keys !== null);
