# Monadow — build spec (single source of truth for all agents)

Monadow = private stealth payments on Monad, where the passkey is the entire account layer (Mera SDK).
Lineage: a port/redesign of Shade (github.com/stellarshade-labs/Shade, Stellar). Stellar pool/relayer/indexer are DROPPED:
on EVM, payments go DIRECTLY to a one-time stealth EOA (ERC-5564 scheme 1, secp256k1).

HARD DEADLINE: submission 2026-10-14 03:59 UTC. Code must be done by ~02:00 UTC. Ship simple + working over clever.

## Repo layout (npm workspaces, root /Users/erhanturker/hack/monadow)
```
contracts/        Foundry project (forge). src/, test/, script/
packages/sdk/     npm package "monadow-sdk" (TS, ESM+CJS via tsup, viem + @noble/curves + @noble/hashes)
apps/web/         Vite + React 18 + TS + Tailwind 4 web app, deployed to GitHub Pages (https://erhantrk.github.io/monadow/, vite base "/monadow/")
SPEC.md, README.md, LICENSE (MIT)
```
`.env` (gitignored) holds DEPLOYER_PRIVATE_KEY, DEPLOYER_ADDRESS, MONAD_RPC_URL. NEVER commit or print the key.

## Network
Monad testnet: chainId 10143, RPC https://testnet-rpc.monad.xyz, explorer https://testnet.monadvision.com, faucet https://faucet.monad.xyz, native MON (18 dp).
Monad charges gas on the GAS LIMIT, so set explicit, tight gas limits. 400ms blocks.

## Contracts (Solidity ^0.8.24, no external deps except forge-std; implement ERC-20 minimal yourself or vendor solady/OZ via forge install if quick)

### `MonadowRegistry.sol` — ERC-6538 subset
```solidity
event StealthMetaAddressSet(address indexed registrant, uint256 indexed schemeId, bytes stealthMetaAddress);
mapping(address => mapping(uint256 => bytes)) public stealthMetaAddressOf;
function registerKeys(uint256 schemeId, bytes calldata stealthMetaAddress) external; // msg.sender
```
schemeId = 1. stealthMetaAddress = 66 bytes: spendPubKey(33, compressed) || viewPubKey(33, compressed).

### `Monadow.sol` — announcer + sender (ERC-5564 compatible event) with on-chain storage for RPC-friendly scanning
```solidity
struct Ann { address stealthAddress; address caller; address token; uint96 _pad; uint256 amount; bytes ephemeralPubKey; bytes1 viewTag; uint64 blockNumber; }
// ERC-5564 event, exact signature:
event Announcement(uint256 indexed schemeId, address indexed stealthAddress, address indexed caller, bytes ephemeralPubKey, bytes metadata);
function sendNative(address stealth, bytes calldata ephemeralPubKey, bytes1 viewTag) external payable;           // forwards msg.value to stealth
function sendToken(address token, uint256 amount, address stealth, bytes calldata ephemeralPubKey, bytes1 viewTag) external payable; // transferFrom(msg.sender→stealth, amount) + forwards msg.value (MON gas tip) to stealth
function announcementCount() external view returns (uint256);
function getAnnouncements(uint256 start, uint256 limit) external view returns (Ann[] memory); // clamps to count
```
- token == address(0) for native in the stored Ann. ephemeralPubKey must be 33 bytes (revert otherwise).
- metadata per ERC-5564: native: `viewTag(1) || 0xeeeeeeee(4) || 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE(20) || amount(32)`; token: `viewTag(1) || 0xa9059cbb(4) || token(20) || amount(32)`.
- Use low-level call for native forwarding, revert on failure; reentrancy guard (simple bool lock). Checks-effects-interactions.
- `MockUSD.sol`: ERC-20 "Monadow USD"/"mUSD", 6 decimals, `mint(address,uint256)` public (testnet faucet), plus EIP-2612 permit NOT required.
- Foundry tests for all functions + metadata encoding. Deploy script `script/Deploy.s.sol` writes addresses to `contracts/deployments/10143.json` as `{"Monadow":"0x..","MonadowRegistry":"0x..","MockUSD":"0x..","deployBlock":N}`.

## Crypto (SDK) — ERC-5564 scheme 1, secp256k1
Notation: G generator, n order. Keys are 32-byte scalars; pubkeys 33-byte compressed.
- Meta-address string: `st:monad:0x<spendPub33hex><viewPub33hex>` (also accept `st:eth:`).
- **Generate** (sender): random ephemeral r; R = r·G; S = r·K_view; s_h = keccak256(compressed(S)); viewTag = s_h[0]; P = K_spend + (s_h mod n)·G; stealthAddress = last 20 bytes of keccak256(uncompressed(P) without 0x04 prefix).
- **Check** (recipient, view key k_view): S = k_view·R; s_h = keccak256(compressed(S)); if s_h[0] != viewTag → skip; else compute P as above, compare address.
- **Recover** spending key: p = (k_spend + s_h) mod n.

### Key derivation from Mera passkey (THE "many keys" story)
One passkey ceremony via `@category-labs/mera` `getPasskeyPrfOutput({ rpId, prfSalt })` with prfSalt = sha256("monadow.prf.root.v1").
From the 32-byte PRF output `root`, derive with HKDF-SHA256 (salt = empty, info strings below), each output reduced to a valid nonzero scalar (if ≥ n or 0, re-run HKDF with info + ":1", etc.):
- `monadow/account/v1`  → account key (the user's public Monad wallet; used via Mera `createSecp256k1SigningSession` + `toViemAccount`)
- `monadow/stealth/spend/v1` → k_spend
- `monadow/stealth/view/v1`  → k_view
- `monadow/vault/v1` → 32-byte AES-GCM key for encrypting local labels/notes (untrusted storage; optional)
Second, independent PRF namespace (separate ceremony, only when user opens "Vault"/notes) is optional stretch.
SDK must expose a pure function `deriveMonadowKeys(prfOutput: Uint8Array)` so it's testable without WebAuthn.

## SDK public API (`monadow-sdk`) — web app codes against exactly this
```ts
export const MONAD_TESTNET: Chain;                      // viem defineChain, id 10143
export const DEPLOYMENTS: { [chainId: number]: { monadow: Address; registry: Address; mockUsd: Address; deployBlock: bigint } };
export const SCHEME_ID = 1n;

// keys
export type MonadowKeys = { accountPrivateKey: Hex; spendingPrivateKey: Hex; viewingPrivateKey: Hex; vaultKey: Uint8Array;
                            spendingPublicKey: Hex; viewingPublicKey: Hex; metaAddress: string; accountAddress: Address };
export function deriveMonadowKeys(prfOutput: Uint8Array): MonadowKeys;
export const MONADOW_PRF_SALT: Uint8Array;               // sha256("monadow.prf.root.v1")
export function encodeMetaAddress(spendPub: Hex, viewPub: Hex): string;
export function decodeMetaAddress(meta: string): { spendingPublicKey: Hex; viewingPublicKey: Hex };

// stealth math
export function generateStealthAddress(metaAddress: string): { stealthAddress: Address; ephemeralPublicKey: Hex; viewTag: Hex /* 1 byte */ };
export function checkStealthAddress(a: { ephemeralPublicKey: Hex; viewTag: Hex; stealthAddress: Address }, viewingPrivateKey: Hex, spendingPublicKey: Hex): boolean;
export function computeStealthPrivateKey(ephemeralPublicKey: Hex, viewingPrivateKey: Hex, spendingPrivateKey: Hex): Hex;

// chain
export type Announcement = { index: bigint; stealthAddress: Address; caller: Address; token: Address /* zero = MON */; amount: bigint; ephemeralPublicKey: Hex; viewTag: Hex; blockNumber: bigint };
export type ReceivedPayment = Announcement & { stealthPrivateKey: Hex; balance: bigint /* current, of token */; nativeBalance: bigint };
export class MonadowClient {
  constructor(opts: { publicClient: PublicClient; walletClient?: WalletClient; chainId?: number; addresses?: Partial<...> });
  registerMetaAddress(metaAddress: string): Promise<Hash>;
  resolveMetaAddress(address: Address): Promise<string | null>;        // registry lookup
  sendNative(recipient: string /* meta-address OR 0x address registered in registry */, amount: bigint): Promise<{ hash: Hash; stealthAddress: Address }>;
  sendToken(recipient: string, token: Address, amount: bigint, gasTip?: bigint /* default 0.02 MON */): Promise<{ hash: Hash; stealthAddress: Address }>; // handles approve if needed
  getAnnouncements(start?: bigint, limit?: bigint): Promise<Announcement[]>;     // paginates getAnnouncements via eth_call (NO eth_getLogs dependency)
  scan(keys: Pick<MonadowKeys,'viewingPrivateKey'|'spendingPublicKey'|'spendingPrivateKey'>, opts?: { start?: bigint }): Promise<ReceivedPayment[]>;
  withdraw(payment: ReceivedPayment, to: Address): Promise<Hash>;       // signs from stealth key: token → transfer full balance; native → sweep balance minus (gasLimit*maxFeePerGas) — mind Monad reserve-balance rules (check docs.monad.xyz); leaves gas dust if needed
}
export function mintMockUsd(...)  // convenience for demo faucet
```
`withdraw` must accept a custom account factory option so the web app can sign stealth txs via Mera's `createSecp256k1SigningSession({privateKey})` + `toViemAccount` (fallback: viem `privateKeyToAccount`).

## Web app UX (apps/web)
Visual base: Shade demo UI at /Users/erhanturker/claude/projects/shade-web/demo (React/Vite/Tailwind4/zustand/lucide). Reuse layout/component patterns but REBRAND: name "Monadow", new palette (Monad purple #836EF9 accent on near-black #0E0B16, soft lavender text), new logo (simple SVG). Do NOT copy Stellar/Freighter code.
Screens:
1. Landing → one button "Continue with passkey" (create passkey if none: `createPasskeyWithPrfOutput`, else `getPasskeyPrfOutput`). ONE prompt → keys derived → home. Show error if PRF unsupported (suggest iCloud Keychain / 1Password / Chrome).
2. Home: account address + MON/mUSD balances, "Get test MON" link to faucet, "Mint 100 mUSD" button, your meta-address + QR + copy, "Register on-chain" (registry) status.
3. Send: recipient (meta-address or 0x registered address), asset (MON/mUSD), amount → send → tx link on explorer.
4. Inbox: scan → list of received stealth payments (amount, token, stealth addr, block) → "Withdraw to my account" / to custom address.
5. Session indicator: signing session active (prompt-free), "Lock" button ends session (keys dropped from memory).
Stateless: NOTHING essential in localStorage. Refresh → one passkey prompt → everything rebuilt from passkey + chain. (Credential ID hint may be cached, optional.)
Tx signing: account txs through Mera viem account; all with explicit gas limits.
