/**
 * Private notes, sealed with the passkey-derived vault key
 * (HKDF namespace "monadow/vault/v1"). Ciphertext goes to localStorage, which
 * we treat as untrusted storage: without the passkey it is opaque bytes, and
 * the AES-GCM tag + AAD make tampering or swapping notes between payments fail.
 */
const PREFIX = 'monadow.note.v1.';

const te = new TextEncoder();
const td = new TextDecoder();

const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const hex = (u: Uint8Array) => Array.from(u, (b) => b.toString(16).padStart(2, '0')).join('');

async function aesKey(vaultKey: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', vaultKey.slice(), 'AES-GCM', false, ['encrypt', 'decrypt']);
}

/** Storage slot id: HMAC(vaultKey, stealthAddress) — doesn't reveal which addresses are yours. */
async function slotId(vaultKey: Uint8Array, subject: string): Promise<string> {
  const k = await crypto.subtle.importKey('raw', vaultKey.slice(), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', k, te.encode(`slot:${subject.toLowerCase()}`)));
  return PREFIX + hex(mac.slice(0, 16));
}

export async function saveNote(vaultKey: Uint8Array, subject: string, text: string): Promise<void> {
  const id = await slotId(vaultKey, subject);
  if (!text.trim()) {
    try {
      localStorage.removeItem(id);
    } catch {
      /* ignore */
    }
    return;
  }
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData: te.encode(subject.toLowerCase()) },
      await aesKey(vaultKey),
      te.encode(text),
    ),
  );
  localStorage.setItem(id, JSON.stringify({ v: 1, iv: b64(iv), ct: b64(ct) }));
}

/** Returns null when there is no note; throws if the ciphertext fails authentication. */
export async function loadNote(vaultKey: Uint8Array, subject: string): Promise<string | null> {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(await slotId(vaultKey, subject));
  } catch {
    return null;
  }
  if (!raw) return null;
  const { iv, ct } = JSON.parse(raw) as { iv: string; ct: string };
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: unb64(iv), additionalData: te.encode(subject.toLowerCase()) },
    await aesKey(vaultKey),
    unb64(ct),
  );
  return td.decode(pt);
}
