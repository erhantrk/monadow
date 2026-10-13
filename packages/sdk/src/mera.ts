/**
 * `monadow-sdk/mera` — passkey (WebAuthn PRF) unlock + prompt-free signing via @category-labs/mera.
 * Requires the optional peer dependency `@category-labs/mera`.
 */
import { createPasskeyWithPrfOutput, createSecp256k1SigningSession, getPasskeyPrfOutput } from '@category-labs/mera';
import { toViemAccount } from '@category-labs/mera/viem';
import { hexToBytes, type Hex, type LocalAccount } from 'viem';
import { MONADOW_PRF_SALT, deriveMonadowKeys, type MonadowKeys } from './crypto.js';
import type { AccountFactory } from './client.js';

export type UnlockWithPasskeyOptions = {
  /** WebAuthn relying-party id (host, e.g. "erhantrk.github.io"). */
  rpId: string;
  /** Relying-party name shown by the authenticator (used on create). */
  rpName: string;
  /** true → create a new passkey (1 prompt; 2 on authenticators that don't evaluate PRF at creation). */
  create?: boolean;
  /** Passkey user name/display name (create only). Default "Monadow". */
  userName?: string;
  /** Restrict the assertion to a known credential (e.g. a cached credential-id hint). */
  credentialId?: string;
  transports?: readonly string[];
  timeout?: number;
};

export type UnlockResult = {
  credentialId: string;
  keys: MonadowKeys;
  transports?: readonly string[];
};

/**
 * One passkey ceremony → all Monadow keys. PRF salt = MONADOW_PRF_SALT (sha256("monadow.prf.root.v1")),
 * passed directly to Mera on both create and get, so onboarding is a single prompt.
 */
export async function unlockWithPasskey(opts: UnlockWithPasskeyOptions): Promise<UnlockResult> {
  if (opts.create) {
    const name = opts.userName ?? 'Monadow';
    const r = await createPasskeyWithPrfOutput({
      rp: { id: opts.rpId, name: opts.rpName },
      user: { name, displayName: name },
      prfSalt: MONADOW_PRF_SALT,
      timeout: opts.timeout,
    });
    return { credentialId: r.credentialId, transports: r.transports, keys: deriveMonadowKeys(new Uint8Array(r.prfOutput)) };
  }
  const r = await getPasskeyPrfOutput({
    rpId: opts.rpId,
    prfSalt: MONADOW_PRF_SALT,
    timeout: opts.timeout,
    credential: opts.credentialId ? { credentialId: opts.credentialId, transports: opts.transports } : undefined,
  });
  return { credentialId: r.credentialId, keys: deriveMonadowKeys(new Uint8Array(r.prfOutput)) };
}

/** viem LocalAccount backed by a Mera secp256k1 signing session. Call `end()` to zero the key. */
export function meraAccount(privateKey: Hex): { account: LocalAccount; end: () => void } {
  const session = createSecp256k1SigningSession({ privateKey: hexToBytes(privateKey) });
  const account = toViemAccount(session) as unknown as LocalAccount;
  return { account, end: () => session.end() };
}

/** `accountFactory` for `MonadowClient.withdraw` that signs via a Mera session and ends it after the tx. */
export const meraAccountFactory: AccountFactory = (pk) => meraAccount(pk);
