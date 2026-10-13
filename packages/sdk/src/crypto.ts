import { secp256k1 } from '@noble/curves/secp256k1';
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha256';
import { keccak_256 } from '@noble/hashes/sha3';
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils';
import { getAddress, type Address, type Hex } from 'viem';

/** Curve order n of secp256k1. */
const N = secp256k1.CURVE.n;
const Point = secp256k1.ProjectivePoint;

/** ERC-5564 / ERC-6538 scheme id for secp256k1 + view tags. */
export const SCHEME_ID = 1n;

/** 32-byte WebAuthn PRF salt: sha256("monadow.prf.root.v1"). */
export const MONADOW_PRF_SALT: Uint8Array = sha256(utf8ToBytes('monadow.prf.root.v1'));

/** HKDF info strings used by {@link deriveMonadowKeys}. */
export const HKDF_INFO = {
  account: 'monadow/account/v1',
  spend: 'monadow/stealth/spend/v1',
  view: 'monadow/stealth/view/v1',
  vault: 'monadow/vault/v1',
} as const;

export const META_ADDRESS_PREFIX = 'st:monad:';
const ACCEPTED_PREFIXES = ['st:monad:', 'st:eth:'];

export type MonadowKeys = {
  accountPrivateKey: Hex;
  spendingPrivateKey: Hex;
  viewingPrivateKey: Hex;
  vaultKey: Uint8Array;
  spendingPublicKey: Hex;
  viewingPublicKey: Hex;
  metaAddress: string;
  accountAddress: Address;
};

// ---------------------------------------------------------------- helpers

const toHex = (b: Uint8Array): Hex => `0x${bytesToHex(b)}`;

function fromHex(h: string, label: string, len?: number): Uint8Array {
  if (typeof h !== 'string' || !/^0x[0-9a-fA-F]*$/.test(h) || h.length % 2 !== 0) {
    throw new Error(`${label}: expected 0x-prefixed even-length hex`);
  }
  const b = hexToBytes(h.slice(2));
  if (len !== undefined && b.length !== len) throw new Error(`${label}: expected ${len} bytes, got ${b.length}`);
  return b;
}

const bytesToBigInt = (b: Uint8Array): bigint => (b.length === 0 ? 0n : BigInt(`0x${bytesToHex(b)}`));

function scalarFromHex(h: string, label: string): bigint {
  const k = bytesToBigInt(fromHex(h, label, 32));
  if (k <= 0n || k >= N) throw new Error(`${label}: not a valid secp256k1 scalar`);
  return k;
}

function scalarToHex(k: bigint): Hex {
  return `0x${k.toString(16).padStart(64, '0')}`;
}

function pointFromHex(h: string, label: string) {
  const b = fromHex(h, label);
  if (b.length !== 33 && b.length !== 65) throw new Error(`${label}: expected 33 or 65 byte public key`);
  try {
    const p = Point.fromHex(b);
    p.assertValidity();
    return p;
  } catch {
    throw new Error(`${label}: not a valid secp256k1 point`);
  }
}

/** EVM address of a secp256k1 point: last 20 bytes of keccak256(uncompressed X||Y). */
export function pointToAddress(p: InstanceType<typeof Point>): Address {
  const unc = p.toRawBytes(false).slice(1);
  return getAddress(toHex(keccak_256(unc).slice(12)));
}

/** Compressed (33-byte) public key for a private key. */
export function getPublicKey(privateKey: Hex): Hex {
  return toHex(secp256k1.getPublicKey(fromHex(privateKey, 'privateKey', 32), true));
}

/** EVM address for a private key. */
export function privateKeyToAddress(privateKey: Hex): Address {
  return pointToAddress(Point.BASE.multiply(scalarFromHex(privateKey, 'privateKey')));
}

/** s_h = keccak256(compressed(k·R)). */
function sharedSecretHash(R: InstanceType<typeof Point>, k: bigint): Uint8Array {
  return keccak_256(R.multiply(k).toRawBytes(true));
}

// ---------------------------------------------------------------- key derivation

/**
 * HKDF-SHA256(root, salt = empty, info) → 32 bytes, reduced to a valid nonzero scalar by
 * re-running with `info + ":1"`, `info + ":2"`, … on the (astronomically unlikely) out-of-range case.
 */
export function deriveScalar(root: Uint8Array, info: string): bigint {
  for (let i = 0; i < 256; i++) {
    const inf = i === 0 ? info : `${info}:${i}`;
    const k = bytesToBigInt(hkdf(sha256, root, new Uint8Array(0), utf8ToBytes(inf), 32));
    if (k > 0n && k < N) return k;
  }
  /* c8 ignore next */
  throw new Error('deriveScalar: failed to find a valid scalar');
}

/** Pure, deterministic derivation of every Monadow key from a 32-byte PRF output. */
export function deriveMonadowKeys(prfOutput: Uint8Array): MonadowKeys {
  if (!(prfOutput instanceof Uint8Array) || prfOutput.length !== 32) {
    throw new Error('deriveMonadowKeys: prfOutput must be 32 bytes');
  }
  const account = deriveScalar(prfOutput, HKDF_INFO.account);
  const spend = deriveScalar(prfOutput, HKDF_INFO.spend);
  const view = deriveScalar(prfOutput, HKDF_INFO.view);
  const vaultKey = hkdf(sha256, prfOutput, new Uint8Array(0), utf8ToBytes(HKDF_INFO.vault), 32);

  const spendingPublicKey = toHex(Point.BASE.multiply(spend).toRawBytes(true));
  const viewingPublicKey = toHex(Point.BASE.multiply(view).toRawBytes(true));
  return {
    accountPrivateKey: scalarToHex(account),
    spendingPrivateKey: scalarToHex(spend),
    viewingPrivateKey: scalarToHex(view),
    vaultKey,
    spendingPublicKey,
    viewingPublicKey,
    metaAddress: encodeMetaAddress(spendingPublicKey, viewingPublicKey),
    accountAddress: pointToAddress(Point.BASE.multiply(account)),
  };
}

// ---------------------------------------------------------------- meta-address

/** `st:monad:0x<spendPub33><viewPub33>` */
export function encodeMetaAddress(spendPub: Hex, viewPub: Hex): string {
  const s = pointFromHex(spendPub, 'spendPub').toRawBytes(true);
  const v = pointFromHex(viewPub, 'viewPub').toRawBytes(true);
  return `${META_ADDRESS_PREFIX}0x${bytesToHex(s)}${bytesToHex(v)}`;
}

/** Raw 66-byte meta-address bytes (as stored in the ERC-6538 registry). */
export function metaAddressToBytes(meta: string): Hex {
  const { spendingPublicKey, viewingPublicKey } = decodeMetaAddress(meta);
  return `0x${spendingPublicKey.slice(2)}${viewingPublicKey.slice(2)}`;
}

/** Accepts `st:monad:0x…`, `st:eth:0x…`, or bare 66-byte `0x…` hex. */
export function decodeMetaAddress(meta: string): { spendingPublicKey: Hex; viewingPublicKey: Hex } {
  if (typeof meta !== 'string') throw new Error('decodeMetaAddress: expected string');
  let body = meta.trim();
  const prefix = ACCEPTED_PREFIXES.find((p) => body.toLowerCase().startsWith(p));
  if (prefix) body = body.slice(prefix.length);
  const b = fromHex(body, 'metaAddress');
  if (b.length !== 66) throw new Error(`metaAddress: expected 66 bytes, got ${b.length}`);
  const spendingPublicKey = toHex(b.slice(0, 33));
  const viewingPublicKey = toHex(b.slice(33));
  pointFromHex(spendingPublicKey, 'metaAddress spending key');
  pointFromHex(viewingPublicKey, 'metaAddress viewing key');
  return { spendingPublicKey, viewingPublicKey };
}

/** True if `s` parses as a meta-address. */
export function isMetaAddress(s: string): boolean {
  try {
    decodeMetaAddress(s);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------- stealth math

/** Sender side: fresh one-time stealth address for `metaAddress`. */
export function generateStealthAddress(
  metaAddress: string,
  ephemeralPrivateKey?: Hex,
): { stealthAddress: Address; ephemeralPublicKey: Hex; viewTag: Hex } {
  const { spendingPublicKey, viewingPublicKey } = decodeMetaAddress(metaAddress);
  const Kspend = pointFromHex(spendingPublicKey, 'spendingPublicKey');
  const Kview = pointFromHex(viewingPublicKey, 'viewingPublicKey');
  const r = ephemeralPrivateKey
    ? scalarFromHex(ephemeralPrivateKey, 'ephemeralPrivateKey')
    : bytesToBigInt(secp256k1.utils.randomPrivateKey());
  const R = Point.BASE.multiply(r);
  const sh = sharedSecretHash(Kview, r);
  const shScalar = bytesToBigInt(sh) % N;
  const P = Kspend.add(Point.BASE.multiply(shScalar));
  return {
    stealthAddress: pointToAddress(P),
    ephemeralPublicKey: toHex(R.toRawBytes(true)),
    viewTag: toHex(sh.slice(0, 1)),
  };
}

/** Recipient side: does this announcement belong to (viewingPrivateKey, spendingPublicKey)? */
export function checkStealthAddress(
  a: { ephemeralPublicKey: Hex; viewTag: Hex; stealthAddress: Address },
  viewingPrivateKey: Hex,
  spendingPublicKey: Hex,
): boolean {
  let R;
  try {
    R = pointFromHex(a.ephemeralPublicKey, 'ephemeralPublicKey');
  } catch {
    return false;
  }
  const sh = sharedSecretHash(R, scalarFromHex(viewingPrivateKey, 'viewingPrivateKey'));
  if (a.viewTag.toLowerCase() !== toHex(sh.slice(0, 1))) return false;
  const shScalar = bytesToBigInt(sh) % N;
  const P = pointFromHex(spendingPublicKey, 'spendingPublicKey').add(Point.BASE.multiply(shScalar));
  return pointToAddress(P).toLowerCase() === a.stealthAddress.toLowerCase();
}

/** p = (k_spend + s_h) mod n */
export function computeStealthPrivateKey(ephemeralPublicKey: Hex, viewingPrivateKey: Hex, spendingPrivateKey: Hex): Hex {
  const R = pointFromHex(ephemeralPublicKey, 'ephemeralPublicKey');
  const sh = sharedSecretHash(R, scalarFromHex(viewingPrivateKey, 'viewingPrivateKey'));
  const p = (scalarFromHex(spendingPrivateKey, 'spendingPrivateKey') + bytesToBigInt(sh)) % N;
  if (p === 0n) throw new Error('computeStealthPrivateKey: degenerate key');
  return scalarToHex(p);
}
