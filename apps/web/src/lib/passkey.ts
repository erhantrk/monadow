import { isMeraError } from '@category-labs/mera';
import type { Hex, LocalAccount } from 'viem';
import type { MonadowKeys } from 'monadow-sdk';
import { meraAccount, unlockWithPasskey } from 'monadow-sdk/mera';

/**
 * The only thing we remember between visits: which passkey to ask for. It is a
 * public credential ID, not a secret — losing it just means the browser shows
 * its passkey picker instead of jumping straight to the right credential.
 */
const HINT_KEY = 'monadow.credentialId';

export function getCredentialHint(): string | null {
  try {
    return localStorage.getItem(HINT_KEY);
  } catch {
    return null;
  }
}
function setCredentialHint(id: string) {
  try {
    localStorage.setItem(HINT_KEY, id);
  } catch {
    /* private mode — fine, it's only a hint */
  }
}
export function clearCredentialHint() {
  try {
    localStorage.removeItem(HINT_KEY);
  } catch {
    /* ignore */
  }
}

export function rpId(): string {
  return window.location.hostname;
}

export type UnlockResult = {
  keys: MonadowKeys;
  credentialId: string;
  /** Ends the account's Mera signing session (zeroes its key copy). */
  endSession: () => void;
  account: LocalAccount;
  derivedInMs: number;
};

async function run(create: boolean, credentialId?: string): Promise<UnlockResult> {
  const t0 = performance.now();
  // ONE WebAuthn ceremony: Mera evaluates PRF(MONADOW_PRF_SALT) and the SDK
  // fans the 32-byte root out into every Monadow key via HKDF.
  const res = await unlockWithPasskey({
    rpId: rpId(),
    rpName: 'Monadow',
    create,
    userName: create ? `Monadow · ${new Date().toISOString().slice(0, 10)}` : undefined,
    credentialId,
  });
  // The account key goes straight into a Mera signing session; viem signs
  // through it, so no further prompts until Lock.
  const { account, end } = meraAccount(res.keys.accountPrivateKey);
  setCredentialHint(res.credentialId);
  return { keys: res.keys, credentialId: res.credentialId, endSession: end, account, derivedInMs: performance.now() - t0 };
}

/** One assertion ceremony → PRF root → every Monadow key. */
export function unlockWithExistingPasskey(useHint = true): Promise<UnlockResult> {
  return run(false, useHint ? (getCredentialHint() ?? undefined) : undefined);
}

/** One creation ceremony (PRF evaluated at create time where supported). */
export function createNewPasskey(): Promise<UnlockResult> {
  return run(true);
}

/** Transient Mera session for a one-time stealth key (used for withdrawals). */
export function stealthSigner(privateKey: Hex): { account: LocalAccount; end: () => void } {
  return meraAccount(privateKey);
}

export type PasskeyErrorKind = 'prf' | 'cancelled' | 'insecure' | 'unsupported' | 'other';

export function describePasskeyError(e: unknown): { kind: PasskeyErrorKind; message: string } {
  if (isMeraError(e)) {
    switch (e.code) {
      case 'PRF_UNAVAILABLE':
        return {
          kind: 'prf',
          message:
            "This passkey provider doesn't support the WebAuthn PRF extension, which Monadow needs to derive your keys. Try iCloud Keychain (Safari or Chrome on macOS / iOS 18+), Google Password Manager in Chrome, or 1Password.",
        };
      case 'CRYPTO_UNAVAILABLE':
        return {
          kind: 'insecure',
          message: 'Web Crypto is unavailable. Open Monadow over https:// (or localhost).',
        };
      case 'PASSKEY_OPERATION_FAILED':
        return {
          kind: 'cancelled',
          message:
            'The passkey prompt was dismissed, or no Monadow passkey exists on this device yet. Try again, or create a new passkey.',
        };
      default:
        return { kind: 'other', message: e.message };
    }
  }
  return { kind: 'other', message: (e as Error)?.message ?? String(e) };
}

export function webAuthnAvailable(): boolean {
  return typeof window !== 'undefined' && 'PublicKeyCredential' in window && window.isSecureContext;
}

/** Best-effort PRF capability probe (Chrome 133+/Safari 18.4+). null = unknown. */
export async function probePrfSupport(): Promise<boolean | null> {
  try {
    const PKC = window.PublicKeyCredential as unknown as {
      getClientCapabilities?: () => Promise<Record<string, boolean>>;
    };
    if (!PKC?.getClientCapabilities) return null;
    const caps = await PKC.getClientCapabilities();
    if ('extension:prf' in caps) return Boolean(caps['extension:prf']);
    return null;
  } catch {
    return null;
  }
}
