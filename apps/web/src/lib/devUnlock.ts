// DEV ONLY: unlock from a fixed fake PRF output so screens can be tested
// without a WebAuthn ceremony. Tree-shaken out of production builds.
import { deriveMonadowKeys } from 'monadow-sdk';
import { meraAccount } from 'monadow-sdk/mera';
import { useSession } from '@/store/session';

export function installDevUnlock() {
  (window as unknown as { __monadowStore: typeof useSession }).__monadowStore = useSession;
  (window as unknown as { __monadowDevUnlock: (seed?: number) => void }).__monadowDevUnlock = (seed = 7) => {
    const prf = new Uint8Array(32).fill(seed);
    const keys = deriveMonadowKeys(prf);
    const { account, end } = meraAccount(keys.accountPrivateKey);
    useSession.getState().unlock({ keys, account, endSession: end, credentialId: 'dev', derivedInMs: 0 });
  };
}
