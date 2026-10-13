# monadow-sdk

Private stealth payments on **Monad**, with a passkey as the whole account layer.

- **ERC-5564 scheme 1** stealth addresses (secp256k1 with view tags). The math is cross-checked against the ScopeLift reference SDK.
- **ERC-6538**-style registry, so you can pay a plain `0x` address that has registered a meta-address.
- **One passkey prompt → every key.** A WebAuthn PRF output (via [Mera](https://mera.category.xyz)) is expanded with HKDF into an account key, a spend key, a view key and a vault key.
- **Scanning uses `eth_call` only.** Announcements are read from contract storage in pages of 200, so no `eth_getLogs` is needed.
- **Monad-aware transactions.** Gas limits are explicit (Monad charges the gas *limit*). Sweeps follow the reserve-balance rules and leave exactly 0 wei behind.

```sh
npm i monadow-sdk viem
npm i @category-labs/mera   # optional: passkey unlock + prompt-free signing (monadow-sdk/mera)
```

## Quick start

```ts
import { createPublicClient, createWalletClient, http, parseEther } from 'viem';
import { MONAD_TESTNET, MonadowClient, deriveMonadowKeys } from 'monadow-sdk';
import { unlockWithPasskey, meraAccount, meraAccountFactory } from 'monadow-sdk/mera';

// 1. One passkey prompt → all keys (create: true on first visit)
const { keys, credentialId } = await unlockWithPasskey({ rpId: location.hostname, rpName: 'Monadow', create: false });
// (no WebAuthn? keys = deriveMonadowKeys(prfOutput32Bytes))

// 2. Clients. The account key signs through a Mera session, with no further prompts
const { account, end } = meraAccount(keys.accountPrivateKey);
const publicClient = createPublicClient({ chain: MONAD_TESTNET, transport: http() });
const walletClient = createWalletClient({ chain: MONAD_TESTNET, transport: http(), account });
const monadow = new MonadowClient({ publicClient, walletClient });

// 3. Publish your meta-address (optional; lets people pay your 0x address privately)
await monadow.registerMetaAddress(keys.metaAddress);

// 4. Pay someone (meta-address "st:monad:0x…" or a registered 0x address)
await monadow.sendNative('st:monad:0x02…03…', parseEther('1'));
await monadow.sendToken('0xBob…', monadow.addresses.mockUsd, 5_000_000n); // approves if needed and tips 0.02 MON for gas

// 5. Inbox + withdraw
const payments = await monadow.scan(keys);
for (const p of payments.filter((p) => p.balance > 0n)) {
  await monadow.withdraw(p, keys.accountAddress, { accountFactory: meraAccountFactory });
}
end(); // "Lock": zero the session key
```

## API

### Constants
| export | |
|---|---|
| `MONAD_TESTNET` | viem `Chain`, id 10143 |
| `DEPLOYMENTS[chainId]` | `{ monadow, registry, mockUsd, deployBlock }` |
| `SCHEME_ID` | `1n` |
| `MONADOW_PRF_SALT` | `sha256("monadow.prf.root.v1")` |
| `HKDF_INFO` | the HKDF info strings (`monadow/account/v1`, `monadow/stealth/spend/v1`, `monadow/stealth/view/v1`, `monadow/vault/v1`) |
| `GAS_FLOORS`, `DEFAULT_GAS_TIP` (0.02 MON), `MONAD_RESERVE_BALANCE` (10 MON), `RESERVE_DELAY_BLOCKS` (3) | |
| `monadowAbi`, `registryAbi`, `erc20Abi`, `mockUsdAbi` | `as const` ABIs |

### Keys and stealth math (pure, synchronous)
```ts
deriveMonadowKeys(prfOutput: Uint8Array): MonadowKeys
// { accountPrivateKey, spendingPrivateKey, viewingPrivateKey, vaultKey, spendingPublicKey, viewingPublicKey, metaAddress, accountAddress }
encodeMetaAddress(spendPub, viewPub): string               // "st:monad:0x<33B><33B>"
decodeMetaAddress(meta): { spendingPublicKey, viewingPublicKey }  // accepts st:monad:, st:eth:, bare hex
isMetaAddress(s), metaAddressToBytes(meta)
generateStealthAddress(meta, ephemeralPrivateKey?): { stealthAddress, ephemeralPublicKey, viewTag }
checkStealthAddress({ ephemeralPublicKey, viewTag, stealthAddress }, viewingPrivateKey, spendingPublicKey): boolean
computeStealthPrivateKey(ephemeralPublicKey, viewingPrivateKey, spendingPrivateKey): Hex
getPublicKey(pk), privateKeyToAddress(pk)
```
Scheme: `S = r·K_view`, `s_h = keccak256(compressed(S))`, `viewTag = s_h[0]`, `P = K_spend + s_h·G`, `p = k_spend + s_h mod n`.

### `new MonadowClient({ publicClient, walletClient?, chainId?, addresses?, chain? })`
| method | |
|---|---|
| `registerMetaAddress(meta)` → `Hash` | ERC-6538 `registerKeys(1, bytes66)` |
| `resolveMetaAddress(addr)` → `string \| null` | registry lookup |
| `sendNative(recipient, amount)` → `{ hash, stealthAddress }` | recipient is a meta-address or a registered 0x address |
| `sendToken(recipient, token, amount, gasTip?)` → `{ hash, stealthAddress, approveHash? }` | approves (and waits) when the allowance is too low |
| `mintMockUsd(to?, amount = 100e6)` → `Hash` | testnet faucet (also available as the standalone `mintMockUsd({ publicClient, walletClient, to?, amount? })`) |
| `announcementCount()` | |
| `getAnnouncements(start = 0n, limit?)` → `Announcement[]` | with `limit`, returns one page; without it, returns everything, 200 per `eth_call` |
| `scan(keys, { start? })` → `ReceivedPayment[]` | includes `stealthPrivateKey`, the current `balance` of the token and `nativeBalance` |
| `withdraw(payment, to, { accountFactory?, waitForReserveDelay? })` → `Hash` | token: sends the full token balance. MON: sends the full balance, leaving 0 wei |
| `withdrawAll(payment, to, opts)` → `{ tokenHash?, nativeHash? }` | token withdraw, then a sweep of the leftover MON gas tip |
| `sweepNative(stealthPk, to, opts)`, `transferToken(stealthPk, token, to, opts)` | lower-level helpers |
| `waitForReserveWindow(address, spend)` | see below |

`accountFactory: (pk) => Account | { account, end } | Promise<…>`. The default is viem `privateKeyToAccount`. `meraAccountFactory` signs through a Mera session and ends it after the transaction.

### `monadow-sdk/mera` (needs `@category-labs/mera`, ESM)
- `unlockWithPasskey({ rpId, rpName, create?, userName?, credentialId?, transports?, timeout? })` → `{ credentialId, keys, transports? }`.
  - Passes `MONADOW_PRF_SALT` straight to Mera's `createPasskeyWithPrfOutput` / `getPasskeyPrfOutput`.
  - Onboarding takes **1 prompt**. It takes 2 only on authenticators that don't evaluate PRF at creation, where Mera falls back to an assertion automatically.
  - Each later unlock takes 1 prompt.
- `meraAccount(privateKey)` → `{ account: LocalAccount, end() }`. It uses `createSecp256k1SigningSession` and `toViemAccount`.
- `meraAccountFactory`: the `accountFactory` described above.

## Monad specifics

- **Gas is charged on the limit.** Every transaction gets an explicit limit of `max(estimate × 1.3, floor)`. The floors are in `GAS_FLOORS`: sendNative 350k, sendToken 450k, approve 70k, mint 100k, registerKeys 160k, token transfer 100k.
- **Reserve balance** ([docs](https://docs.monad.xyz/developer-essentials/reserve-balance)). The reserve is 10 MON and k = 3 blocks.
  - **Value spending below the reserve.** A sender whose balance would end below 10 MON can only move value in an *emptying* transaction. That means it sent **no other transaction in the previous 3 blocks**. Otherwise the transaction is included and then **reverts** with "reserve balance violation", and the whole gas limit is still charged.
  - **How the SDK handles it.** `sendNative` and `sendToken` (which carries a MON tip) call `waitForReserveWindow` first. It waits until the sender's pending nonce equals its nonce at `latest − 3`, which usually takes about 1–2 s, for example right after an `approve`.
  - **Lagged balances.** Consensus checks gas against the balance from 3 blocks earlier. A just-funded address therefore can't send yet, so `withdraw` waits until `payment.blockNumber + 4`.
  - **Native sweep.** This is a legacy transaction with `value = balance − gasLimit·gasPrice`. Monad charges exactly `gasLimit·gasPrice` with no refund, so the stealth address ends at **0 wei**. That is allowed because a stealth EOA is undelegated and quiet, so the emptying exception applies.
  - **Token withdraw.** Gas is paid from the MON tip. `withdrawAll` then waits for a new quiet window and sweeps what's left of the tip.
  - **Delegated accounts.** EIP-7702-delegated EOAs can never empty below 10 MON. Stealth EOAs are never delegated.

## Development
```sh
npm run build   # tsup → dist (ESM + CJS + d.ts)
npm test        # vitest: crypto, ScopeLift cross-check, mocked client
npm run e2e     # live Monad testnet run (uses DEPLOYER_PRIVATE_KEY from repo .env)
```

MIT
