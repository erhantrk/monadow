# Monadow architecture

This document specifies the cryptography, the contracts, the client flows and the threat model. Code references are to `packages/sdk/src/crypto.ts`, `packages/sdk/src/client.ts`, `packages/sdk/src/mera.ts`, `apps/web/src/lib/passkey.ts` and `contracts/src/*.sol`.

## 1. Components

```
 Browser (apps/web)                         Monad testnet (chainId 10143)
 ┌──────────────────────────────────┐      ┌──────────────────────────────────────┐
 │ Mera: passkey + PRF              │      │ MonadowRegistry  (ERC-6538 subset)    │
 │   └─ PRF root (32 B, transient)  │      │   address → schemeId → 66-byte meta   │
 │ monadow-sdk                      │ RPC  │ Monadow          (ERC-5564 announcer) │
 │   deriveMonadowKeys (HKDF)       │◄────►│   sendNative / sendToken              │
 │   stealth math (secp256k1)       │      │   Ann[] storage + Announcement event  │
 │   MonadowClient (viem)           │      │ MockUSD          (mUSD, 6 dp, mint)   │
 │ Mera signing sessions → viem     │      └──────────────────────────────────────┘
 └──────────────────────────────────┘
```

There is no backend, relayer or indexer. The web app talks to a public Monad RPC (`https://testnet-rpc.monad.xyz`) and is a static site on GitHub Pages.

## 2. Cryptography

Curve secp256k1, generator `G`, order `n`. Private keys are 32-byte scalars in `[1, n−1]`; public keys are 33-byte compressed points. `addr(P)` = last 20 bytes of `keccak256(X || Y)` (uncompressed point without the `0x04` prefix).

### 2.1 Root secret from the passkey

```
prfSalt = sha256(utf8("monadow.prf.root.v1"))          // MONADOW_PRF_SALT, 32 bytes
root    = WebAuthn PRF(passkey, prfSalt)               // 32 bytes, via Mera
```

- New user: `createPasskeyWithPrfOutput({ rp: { id: location.hostname, name: "Monadow" }, user, prfSalt })`. Mera creates a discoverable, user-verified passkey and evaluates PRF during creation; on authenticators that don't, Mera runs one fallback assertion.
- Returning user: `getPasskeyPrfOutput({ rpId: location.hostname, prfSalt, credential? })`. The optional credential is a cached credential-ID hint.

The relying-party ID is the page hostname, so the root (and every key) is specific to the domain the app is served from.

### 2.2 Key derivation (HKDF namespaces)

```
HKDF(info) = HKDF-SHA256(ikm = root, salt = empty, info = utf8(info), L = 32)

deriveScalar(info):
  for i = 0, 1, 2, …:
    k = int(HKDF(i == 0 ? info : info + ":" + i))
    if 0 < k < n: return k

k_account = deriveScalar("monadow/account/v1")
k_spend   = deriveScalar("monadow/stealth/spend/v1")
k_view    = deriveScalar("monadow/stealth/view/v1")
vaultKey  = HKDF("monadow/vault/v1")                     // raw 32 bytes, AES-256-GCM key

K_spend = k_spend·G,  K_view = k_view·G
accountAddress = addr(k_account·G)
metaAddress    = "st:monad:0x" || hex(K_spend) || hex(K_view)   // 66 bytes of keys
```

The retry loop is there for correctness; the probability of a retry is about 2⁻¹²⁸. A known-answer test in `packages/sdk/test/crypto.test.ts` pins the info strings.

The decoder also accepts the `st:eth:` prefix and a bare 66-byte hex string. The registry stores the raw 66 bytes `K_spend || K_view` under scheme id `1`.

Because HKDF outputs with different `info` are independent pseudo-random values, knowledge of any one key (for example the view key given to a scanning service) reveals nothing about the others or about `root`.

### 2.3 Stealth address generation (sender)

ERC-5564 scheme 1:

```
r   ← random scalar                                    // ephemeral key, discarded after sending
R   = r·G                                              // ephemeralPubKey, 33 bytes compressed
S   = r·K_view
s_h = keccak256(compressed(S))                         // 32 bytes
viewTag = s_h[0]
P   = K_spend + (s_h mod n)·G
stealthAddress = addr(P)
```

### 2.4 Scanning (recipient, needs only `k_view` and `K_spend`)

```
for each announcement (R, viewTag, stealthAddress):
  S   = k_view·R
  s_h = keccak256(compressed(S))
  if s_h[0] ≠ viewTag: skip                           // rejects ~255/256 of foreign announcements
  P = K_spend + (s_h mod n)·G
  mine ⇔ addr(P) == stealthAddress
```

### 2.5 Spending key recovery

```
p = (k_spend + s_h) mod n                              // p·G = P, so p controls stealthAddress
```

(`s_h` is used as a 256-bit integer; reducing it mod `n` first gives the same result.)

## 3. Contracts

Solidity `^0.8.24` (compiled with 0.8.28, `cancun`, optimizer 200 runs). No external dependencies besides forge-std for tests and scripts.

### 3.1 `MonadowRegistry` (ERC-6538 subset)

```solidity
event StealthMetaAddressSet(address indexed registrant, uint256 indexed schemeId, bytes stealthMetaAddress);
mapping(address => mapping(uint256 => bytes)) public stealthMetaAddressOf;
function registerKeys(uint256 schemeId, bytes calldata stealthMetaAddress) external; // keyed by msg.sender
```

Senders who only know a recipient's `0x` account address call `stealthMetaAddressOf(addr, 1)`. The client treats anything other than exactly 66 bytes of valid points as "not registered". The signature-based `registerKeysOnBehalf` from the full ERC-6538 is omitted.

### 3.2 `Monadow` (ERC-5564 announcer and sender)

```solidity
struct Ann { address stealthAddress; address caller; address token; uint96 _pad; uint256 amount;
             bytes ephemeralPubKey; bytes1 viewTag; uint64 blockNumber; }
event Announcement(uint256 indexed schemeId, address indexed stealthAddress, address indexed caller,
                   bytes ephemeralPubKey, bytes metadata);              // exact ERC-5564 signature

function sendNative(address stealth, bytes calldata ephemeralPubKey, bytes1 viewTag) external payable;
function sendToken(address token, uint256 amount, address stealth, bytes calldata ephemeralPubKey, bytes1 viewTag) external payable;
function announcementCount() external view returns (uint256);
function getAnnouncements(uint256 start, uint256 limit) external view returns (Ann[] memory); // clamps to count
```

- **Send and announce in one call.** The contract both moves the funds and announces, so an announcement can't exist without the matching transfer. `sendNative` forwards `msg.value`. `sendToken` calls `transferFrom(msg.sender, stealth, amount)` (the sender approves `Monadow` first) and forwards any `msg.value` as a MON gas tip for the stealth address.
- **Validation.** `stealth != 0`, `ephemeralPubKey.length == 33`, non-zero amount; otherwise custom-error reverts. Token transfers handle tokens that return nothing and revert on a `false` return or on a token address with no code.
- **Metadata (ERC-5564).**
  - native: `viewTag(1) || 0xeeeeeeee(4) || 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE(20) || amount(32)`
  - token: `viewTag(1) || 0xa9059cbb(4) || token(20) || amount(32)`
- **On-chain announcement storage.** Each send also pushes an `Ann` to an array, with `token = address(0)` for native MON and `blockNumber = block.number`. Clients read it in pages of 200 via `eth_call`, so scanning doesn't depend on `eth_getLogs` range limits on public RPCs. The event is still emitted for ERC-5564 indexers.
- **Safety.** A simple boolean reentrancy lock on both send functions, checks-effects-interactions (record and emit before external calls), low-level `call` for native forwarding that reverts on failure.

### 3.3 `MockUSD`

Minimal ERC-20 "Monadow USD" / `mUSD`, 6 decimals, with a public `mint(address,uint256)` acting as the testnet faucet. `type(uint256).max` allowances are not decremented.

### 3.4 Tests

`contracts/test/Monadow.t.sol` covers registry registration, MockUSD metadata, transfers and allowances, native and token sends (forwarding, stored announcements, tips), exact event metadata and the ERC-5564 `topic0`, every revert path (bad key length, zero stealth or value, rejecting recipient, failing token), reentrancy, pagination clamping and a fuzz test on `sendNative`.

## 4. Client flows (`MonadowClient`)

| Method | What it does |
|---|---|
| `registerMetaAddress(meta)` | `registerKeys(1, K_spend‖K_view)` from the account |
| `resolveMetaAddress(addr)` | registry lookup, `null` if unregistered |
| `sendNative(recipient, amount)` | recipient = meta-address or registered `0x`; generates `(stealth, R, viewTag)` and calls `sendNative` |
| `sendToken(recipient, token, amount, gasTip = 0.02 MON)` | approves exactly `amount` if allowance is short, waits for the receipt, then `sendToken` with `value = gasTip` |
| `getAnnouncements(start, limit?)` | paginated `eth_call` reads |
| `scan(keys, { start })` | view-tag filter and address check, recovers `p`, reads live token and MON balances |
| `withdraw(payment, to, { accountFactory })` | signs from the stealth key; token: transfer full token balance, gas paid from the tip; native: sweep the balance to exactly 0 |
| `withdrawAll(payment, to)` | token withdraw, then sweep leftover tip MON after the reserve delay |

`accountFactory` lets the caller choose the signer for one-time stealth keys. The web app and `monadow-sdk/mera` use a Mera `createSecp256k1SigningSession({ privateKey: p })` wrapped by `toViemAccount`, and end the session right after signing. The default is viem `privateKeyToAccount`.

### 4.1 Monad-specific transaction handling

- **Gas is charged on the gas limit.** On Monad the sender pays `gasLimit × price`, not gas used, so oversized limits waste money. Undersized limits also fail: during the smoke test, a `sendNative` estimated at about 262k gas reverted with a 300k limit (tx `0xe387894b…f208773` in `contracts/deployments/10143.json`). The SDK therefore uses `gas = max(estimate × 1.3, floor)` with per-method floors: `sendNative` 350k, `sendToken` 450k, `approve` 70k, `mint` 100k, `registerKeys` 160k, `transfer` 100k. A plain MON sweep to an EOA uses exactly 21,000.
- **Reserve balance.** Monad's consensus checks balances with a lag of k = 3 blocks and limits how far an account can drain its balance, with an "emptying" exception for an undelegated account that sent nothing in the previous blocks. A fresh stealth EOA fits that exception, so `withdraw` waits until `payment.blockNumber + 4`, then sends a legacy tx with `value = balance − gasLimit·gasPrice` (gas price = current × 1.1). The stealth balance ends at exactly zero. For token payments `withdrawAll` waits another 3+ blocks after the token transfer before sweeping the leftover tip.
- **400 ms blocks** keep the reserve-delay wait to about 1.6 s.

## 5. Session and storage model (web app)

- **Unlock.** One Mera ceremony returns `root`. `deriveMonadowKeys(root)` runs, then `root` is zeroed. The account key goes into a Mera signing session (the local copy of its bytes is zeroed) and `toViemAccount` gives a viem `LocalAccount` used for every account transaction without further prompts.
- **In memory only.** Keys, the viem client and the scan results live in a zustand store in memory.
- **Persisted.** `localStorage["monadow.credentialId"]`, a public credential ID used as a hint so the browser can offer the right passkey directly (losing it only means the browser shows its passkey picker), and the ciphertext of any private notes (section 5.1). Neither is needed to recover keys or funds.
- **Lock.** Ends every Mera session opened in this unlock (account and any transient stealth sessions), zeroes `vaultKey`, and drops all references.
- **Stateless recovery.** Same passkey + same hostname ⇒ same `root` ⇒ same keys. Payments are re-discovered by scanning the stored announcements from index 0 (the contracts were deployed at block `70789800`, so nothing older exists).

### 5.1 Vault: encrypted payment notes (`apps/web/src/lib/vault.ts`)

```
slot  = "monadow.note.v1." || hex(HMAC-SHA256(vaultKey, "slot:" || lower(stealthAddress))[0..16])
iv    ← random 12 bytes
ct    = AES-256-GCM(key = vaultKey, iv, aad = lower(stealthAddress), plaintext = note)
localStorage[slot] = {"v":1, "iv": b64(iv), "ct": b64(ct)}
```

`localStorage` is treated as untrusted storage. Without the vault key the entries are opaque: the slot ID is a keyed MAC, so it doesn't reveal which stealth addresses are the user's, and the GCM tag with the stealth address as AAD makes tampering, or moving a note to another payment, fail to decrypt. The vault key is the same on every device with the same passkey, so any copy of the ciphertext decrypts anywhere. The current build doesn't sync or export the ciphertext, so notes stay in the browser that wrote them.

## 6. Threat model

### Assets

- Funds at stealth addresses and at the account address.
- The link between a recipient's identity (account address, meta-address) and the stealth addresses that paid them.
- The PRF root and derived keys.

### Adversaries and what they learn

| Adversary | Can see | Cannot do |
|---|---|---|
| Public chain observer | Sender (`caller`), amount, token, stealth address, `R`, view tag, timing; registry entries | Tell which meta-address a stealth address belongs to (needs `k_view`, under ECDH hardness) |
| Holder of the view key `k_view` | Which announcements belong to the user, and amounts | Spend (needs `k_spend`); derive the account key or vault key |
| Sender of a payment | That stealth address (they created it) | Spend it; find the recipient's other payments |
| Malicious RPC | Which announcement pages and balances the client queries, client IP | Steal keys (all crypto is client-side); it can hide or forge announcements and balances (denial or confusion, not theft, because withdrawals are signed locally and enforced on-chain) |
| Static host (GitHub Pages) or supply chain | Can serve modified JavaScript | This is a full compromise: modified code can read keys. Same trust as any web wallet. |
| Device malware, XSS, malicious extension on the origin | Keys in memory while unlocked | Nothing once locked and no passkey prompt is approved |

### Explicit non-goals and known leaks

0. **Local notes.** Note ciphertext is local to one browser; clearing site data deletes it.
1. **Sender privacy.** The sender's account is public and is stored as `caller`.
2. **Amount privacy.** Amounts and assets are public.
3. **Withdrawal linkage.** Sweeping to the recipient's public account links that payment to the account. Withdraw to a fresh address to avoid it.
4. **Gas-tip linkage.** Token payments carry a MON tip so the stealth address can pay gas. Leftover tip dust, or sweeping several stealth addresses to one destination, links those payments together. Native sweeps leave zero dust.
5. **Timing and amount correlation** between a send and a quick withdraw.
6. **Registry linkage by choice.** Registering publishes `account address ↔ meta-address`. It doesn't reveal individual payments, but it tells everyone that this account uses Monadow.
7. **Passkey loss or compromise.** The passkey is the only secret. Synced passkey providers mitigate loss; there is no social recovery.
8. **Hostname binding.** The RP ID is the hostname. Moving the app to another domain derives different keys (funds stay safe, but the old domain is needed to reach them).
9. **Memory hygiene.** JavaScript can't guarantee secret erasure (hex strings, GC copies). Lock removes references and ends Mera sessions; it doesn't promise zeroization of every copy.
10. **Scalability.** Scanning is linear over all announcements. Fine for testnet; production would need checkpoints or a view-key indexing service (which learns the user's payments).
11. **Unaudited.** Contracts and SDK have tests, not an audit. Testnet only.
