import { describe, expect, it } from 'vitest';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { bytesToHex, keccak256, toBytes, type Hex } from 'viem';
import { sha256 } from '@noble/hashes/sha256';
import {
  MONADOW_PRF_SALT,
  checkStealthAddress,
  computeStealthPrivateKey,
  decodeMetaAddress,
  deriveMonadowKeys,
  encodeMetaAddress,
  generateStealthAddress,
  getPublicKey,
  isMetaAddress,
  metaAddressToBytes,
  privateKeyToAddress,
} from '../src/index.js';

const prf = (seed: number) => {
  const b = new Uint8Array(32);
  b.fill(seed);
  return b;
};

describe('constants', () => {
  it('MONADOW_PRF_SALT = sha256("monadow.prf.root.v1")', () => {
    expect(bytesToHex(MONADOW_PRF_SALT)).toBe(bytesToHex(sha256(new TextEncoder().encode('monadow.prf.root.v1'))));
    expect(MONADOW_PRF_SALT.length).toBe(32);
  });
});

describe('deriveMonadowKeys', () => {
  it('is deterministic', () => {
    const a = deriveMonadowKeys(prf(7));
    const b = deriveMonadowKeys(prf(7));
    expect(a).toEqual(b);
  });
  it('different PRF → different keys; all keys distinct', () => {
    const a = deriveMonadowKeys(prf(7));
    const b = deriveMonadowKeys(prf(8));
    expect(a.accountPrivateKey).not.toBe(b.accountPrivateKey);
    const set = new Set([a.accountPrivateKey, a.spendingPrivateKey, a.viewingPrivateKey, bytesToHex(a.vaultKey)]);
    expect(set.size).toBe(4);
  });
  it('public keys / address / meta-address are consistent', () => {
    const k = deriveMonadowKeys(prf(1));
    expect(getPublicKey(k.spendingPrivateKey)).toBe(k.spendingPublicKey);
    expect(getPublicKey(k.viewingPrivateKey)).toBe(k.viewingPublicKey);
    expect(privateKeyToAccount(k.accountPrivateKey).address).toBe(k.accountAddress);
    expect(k.metaAddress).toBe(`st:monad:0x${k.spendingPublicKey.slice(2)}${k.viewingPublicKey.slice(2)}`);
    expect(k.vaultKey.length).toBe(32);
  });
  it('rejects wrong-length input', () => {
    expect(() => deriveMonadowKeys(new Uint8Array(31))).toThrow();
  });
  it('known-answer vector (pins HKDF info strings)', () => {
    const k = deriveMonadowKeys(prf(0));
    expect(k).toMatchSnapshot();
  });
});

describe('meta-address', () => {
  const k = deriveMonadowKeys(prf(2));
  it('round-trips', () => {
    const meta = encodeMetaAddress(k.spendingPublicKey, k.viewingPublicKey);
    expect(decodeMetaAddress(meta)).toEqual({ spendingPublicKey: k.spendingPublicKey, viewingPublicKey: k.viewingPublicKey });
    expect(metaAddressToBytes(meta)).toBe(`0x${k.spendingPublicKey.slice(2)}${k.viewingPublicKey.slice(2)}`);
  });
  it('accepts st:eth: and bare hex', () => {
    const body = k.metaAddress.slice('st:monad:'.length);
    expect(decodeMetaAddress(`st:eth:${body}`).spendingPublicKey).toBe(k.spendingPublicKey);
    expect(decodeMetaAddress(body).viewingPublicKey).toBe(k.viewingPublicKey);
  });
  it('rejects garbage', () => {
    expect(isMetaAddress('st:monad:0x1234')).toBe(false);
    expect(isMetaAddress(`st:monad:0x${'00'.repeat(66)}`)).toBe(false);
    expect(isMetaAddress('hello')).toBe(false);
    expect(isMetaAddress(k.metaAddress)).toBe(true);
  });
});

describe('stealth round-trip', () => {
  it('generate → check → recover (100 iterations)', () => {
    const k = deriveMonadowKeys(prf(3));
    for (let i = 0; i < 100; i++) {
      const g = generateStealthAddress(k.metaAddress);
      expect(g.viewTag).toMatch(/^0x[0-9a-f]{2}$/);
      expect(g.ephemeralPublicKey.length).toBe(2 + 66);
      expect(checkStealthAddress(g, k.viewingPrivateKey, k.spendingPublicKey)).toBe(true);
      const p = computeStealthPrivateKey(g.ephemeralPublicKey, k.viewingPrivateKey, k.spendingPrivateKey);
      expect(privateKeyToAccount(p).address).toBe(g.stealthAddress);
      expect(privateKeyToAddress(p)).toBe(g.stealthAddress);
    }
  });
  it('view tag = first byte of keccak256(compressed shared secret)', async () => {
    const { secp256k1 } = await import('@noble/curves/secp256k1');
    const k = deriveMonadowKeys(prf(4));
    const r = generatePrivateKey();
    const g = generateStealthAddress(k.metaAddress, r);
    const S = secp256k1.getSharedSecret(toBytes(r), toBytes(k.viewingPublicKey), true);
    expect(g.viewTag).toBe(keccak256(S).slice(0, 4));
    expect(g.ephemeralPublicKey).toBe(getPublicKey(r));
  });
  it('wrong view key fails', () => {
    const k = deriveMonadowKeys(prf(5));
    const other = deriveMonadowKeys(prf(6));
    let fails = 0;
    for (let i = 0; i < 50; i++) {
      const g = generateStealthAddress(k.metaAddress);
      if (!checkStealthAddress(g, other.viewingPrivateKey, k.spendingPublicKey)) fails++;
      expect(checkStealthAddress(g, k.viewingPrivateKey, other.spendingPublicKey)).toBe(false);
    }
    expect(fails).toBe(50);
  });
  it('wrong stealth address / tampered view tag fails', () => {
    const k = deriveMonadowKeys(prf(9));
    const g = generateStealthAddress(k.metaAddress);
    expect(checkStealthAddress({ ...g, stealthAddress: privateKeyToAddress(generatePrivateKey()) }, k.viewingPrivateKey, k.spendingPublicKey)).toBe(false);
    const badTag = (`0x${((parseInt(g.viewTag.slice(2), 16) + 1) % 256).toString(16).padStart(2, '0')}`) as Hex;
    expect(checkStealthAddress({ ...g, viewTag: badTag }, k.viewingPrivateKey, k.spendingPublicKey)).toBe(false);
    expect(checkStealthAddress({ ...g, ephemeralPublicKey: '0x02' }, k.viewingPrivateKey, k.spendingPublicKey)).toBe(false);
  });
  it('deterministic with fixed ephemeral key', () => {
    const k = deriveMonadowKeys(prf(10));
    const r = generatePrivateKey();
    expect(generateStealthAddress(k.metaAddress, r)).toEqual(generateStealthAddress(k.metaAddress, r));
  });
});
