# Monadow: bounty answers

Live app: https://erhantrk.github.io/monadow/ · Repo: https://github.com/erhantrk/monadow · SDK: https://www.npmjs.com/package/monadow-sdk

---

## Monad Foundation: Best Mera-Powered UX

### How Mera is the entire account layer

Monadow has no seed phrase, no browser extension, no "connect wallet" and no backend. Mera supplies every account primitive:

- **Onboarding is one ceremony.** "Create new passkey" calls Mera `createPasskeyWithPrfOutput` with our PRF salt, so the passkey is created and the PRF output is returned in the same prompt. Returning users press "Continue with passkey" (`getPasskeyPrfOutput`), which is also one prompt. (On authenticators that don't evaluate PRF at creation time, Mera adds one fallback assertion.)
- **The account is a Mera signing session.** The account key derived from the PRF root goes into `createSecp256k1SigningSession`, and `@category-labs/mera/viem`'s `toViemAccount` turns it into a viem `LocalAccount`. Mint, publish meta-address, approve and send all sign through it with no further prompts.
- **Stealth keys also sign through Mera.** Each withdrawal recovers that payment's one-time private key and opens its own short-lived Mera signing session for it, which is ended right after the transaction is signed (and tracked, so Lock also ends it if it's still open).
- **Session state is visible.** A header pill shows "Signing session active · prompt-free". **Lock** ends every Mera session from this unlock, zeroes the vault key, drops all keys from the in-memory store and returns to the landing page.

### Time to first transaction

Measured from opening the landing page to the first confirmed on-chain transaction:

1. **Create new passkey**: one biometric prompt. Keys are derived locally in milliseconds (the app records the derivation time).
2. **Fund**: get MON from https://faucet.monad.xyz (the only step outside the app).
3. **Mint 100 mUSD** or **Publish meta-address on-chain**: one click, no prompt, confirmed in about a second on Monad's 400 ms blocks.

So it takes one passkey prompt and one click, and the only wait is the faucet. <!-- VERIFY: measured wall-clock time-to-first-tx on the live app, if you want to quote a number -->

### Session design

| | |
|---|---|
| Unlock | 1 Mera ceremony → PRF root → `deriveMonadowKeys` → root zeroed |
| Account signer | Mera secp256k1 signing session + `toViemAccount`; our copy of the key bytes is zeroed after handing it to Mera |
| Per-payment signer | Short-lived Mera session per stealth key, ended immediately after signing |
| Gas | Explicit, tight gas limits on every tx (Monad charges on the gas limit) |
| Reserve balance | Withdraw waits Monad's 3-block reserve window, then sweeps native MON to exactly zero |
| Lock | Ends all sessions, zeroes the vault key, drops keys from memory |
| Persisted | A public credential-ID hint, plus AES-GCM ciphertext of any private notes. Nothing needed to recover the account |

### Stateless test

Lock, clear site data (or open a brand-new browser profile, or another device with the same synced passkey), and press **Continue with passkey**. After one prompt:

- the same account address and the same `st:monad:` meta-address are derived again;
- the "Published" status is read back from the ERC-6538 registry (`stealthMetaAddressOf`);
- the inbox is rebuilt by an on-chain scan of the stored announcements (paginated `eth_call`, no indexer and no `eth_getLogs`), with the same payments and live balances.

Nothing in local storage is needed for any of this; the passkey plus Monad is the whole account.

---

## Mera: One Passkey, Many Keys

### One root, separate namespaces

One Mera PRF ceremony with salt `sha256("monadow.prf.root.v1")` produces a 32-byte root. It is never used directly. HKDF-SHA256 (empty salt) with a distinct `info` string produces each key, and secp256k1 scalars are re-derived with `info:1`, `info:2`, … in the (negligible) case that the output is out of range:

| HKDF info | Key | What it's for |
|---|---|---|
| `monadow/stealth/view/v1` | viewing key `k_view` | Scans the on-chain announcements and recognises payments meant for you (one-byte view tag, then an address check). It can't move funds. |
| `monadow/stealth/spend/v1` | spending key `k_spend` | Recovers each one-time address key, `p = k_spend + keccak256(k_view·R) mod n`, so every payment lands at a fresh, unlinkable identity that only you control. |
| `monadow/vault/v1` | 32-byte AES-256-GCM key | Encrypts private payment notes. Only ciphertext is stored, in `localStorage`, which we treat as untrusted storage; slot IDs are an HMAC of the stealth address, and the stealth address is GCM additional data, so a note can't be read, tampered with or moved to another payment. |
| `monadow/account/v1` | account key | The ordinary public Monad account (Mera signing session), used for gas, mUSD and publishing the meta-address. |

The non-account keys are the point: the spend/view pair is a privacy identity that never signs from, and can't be linked on-chain to, the public account (unless the user chooses to publish the meta-address under it), and the vault key gives the same passkey a symmetric encryption capability. HKDF domain separation means leaking one key, for example sharing the view key with a scanning service, reveals nothing about the spend, vault or account keys, or about the root. The derivation is a pure function, `deriveMonadowKeys(prfOutput)` in `monadow-sdk`, with known-answer tests that pin the info strings.

### Nothing sensitive persisted

The PRF root is zeroed right after derivation. Keys live only in memory for the session and are dropped on Lock. `localStorage` holds a public credential-ID hint and note ciphertext, nothing that helps an attacker without the passkey.

### Cross-device test

The same synced passkey (iCloud Keychain, Google Password Manager, 1Password) on another device or a fresh profile gives byte-identical keys, so it shows the same account address and meta-address, and the scan finds the same payments, ready to withdraw. The vault key is identical too, so any copy of a note's ciphertext decrypts on the new device. In the current build that ciphertext is not synced: it stays in the `localStorage` of the browser that wrote it, so notes appear on another device only if the ciphertext is carried over, and clearing site data deletes them. <!-- VERIFY: the form text claims "the same decrypted notes" cross-device; that is only true if note ciphertext is synced or exported, which apps/web/src/lib/vault.ts does not do -->
