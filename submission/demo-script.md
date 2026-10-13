# Monadow: 3-minute technical demo script

Everything is shot live on **Monad testnet** at https://erhantrk.github.io/monadow/.

## Setup before recording

- **Profile A (Recipient, "Bob")**: Chrome or Safari with iCloud Keychain, 1Password or Google Password Manager. Fresh profile with no Monadow passkey yet.
- **Profile B (Sender, "Alice")**: a second browser profile or a phone, with a Monadow passkey already created, funded with MON from https://faucet.monad.xyz and with 100 mUSD minted. (Pre-fund it so the demo doesn't wait on the faucet.)
- Pre-fund Bob's address too if the faucet is slow: create Bob's passkey once in a throwaway take, note the address, fund it, then delete the passkey **only if** you want to show creation live. Simpler: show creation live and fund from Alice with a plain transfer during the "faucet" shot.
- Open a MonadVision tab (https://testnet.monadvision.com) for showing txs.
- Screen recorder at 1080p, browser zoom 110%, notifications off.

---

## Shot 1 (0:00–0:15): Hook

**Screen:** Landing page, Profile A.

**Say:** "This is Monadow: private payments on Monad. You get paid at a fresh one-time address every time, and your whole account, the wallet and the privacy keys, comes from a single passkey. No seed phrase, no extension."

## Shot 2 (0:15–0:40): One-prompt onboarding

**Click:** **Create new passkey** → approve the single system passkey prompt (Touch ID / Face ID).

**Screen:** Home appears with the account address, MON/mUSD balances, meta-address and QR. Point at the header pill "Signing session active · prompt-free".

**Say:** "One prompt. Mera created the passkey and returned its PRF output in the same ceremony. The SDK runs HKDF over that secret into four separate keys: my public Monad account, a stealth spend key, a stealth view key and a vault key. The account key goes straight into a Mera signing session, so from now on nothing asks me to sign again."

**Optional click:** the **How** button to flash the key-tree diagram for 2 seconds.

## Shot 3 (0:40–1:00): Faucet and mint

**Click:** copy the account address → **Get test MON** (faucet) → paste and request, or cut to an already-funded balance. Back in Monadow, click **Mint 100 mUSD**.

**Screen:** mint tx confirms in about a second; mUSD balance shows 100. Click the tx link to show it on MonadVision.

**Say:** "Gas comes from the faucet, and mUSD is our test stablecoin. Notice there was no signing popup for the mint: it went through the Mera session, with an explicit gas limit, because Monad charges for the gas limit, not gas used."

## Shot 4 (1:00–1:15): Publish meta-address

**Click:** **Publish meta-address on-chain**.

**Screen:** status turns to **Published**; tx link.

**Say:** "This publishes my meta-address, my two public stealth keys, to an ERC-6538 registry. Now anyone can pay my ordinary 0x address and the money still lands somewhere only I can find."

## Shot 5 (1:15–1:45): Send from a second profile

**Switch to Profile B (Alice).** **Click:** **Continue with passkey** (one prompt) → **Send** tab → paste Bob's `0x` address into **Recipient** (or the `st:monad:` meta-address) → **Asset** mUSD, **Amount** 25 → **Send privately**.

**Screen:** tx confirms; show the explorer page. Point at the recipient of the transfer: a brand-new address, not Bob's.

**Say:** "Alice pays Bob's public address. The SDK looks up his meta-address, does an ECDH with his view key and derives a one-time stealth address. The Monadow contract moves the mUSD there, forwards a little MON for gas, and stores an ERC-5564 announcement. On-chain, nobody can tell this address belongs to Bob."

## Shot 6 (1:45–2:05): Inbox scan

**Switch to Profile A (Bob).** **Click:** **Inbox** (it scans on open; click **Scan again** if Alice's tx landed after you opened it).

**Screen:** "Announcements scanned / Addressed to you / Claimable" counters; the 25 mUSD payment appears with its stealth address and block number. Click **Add private note**, type "Invoice #12 from Alice", save.

**Say:** "Bob's view key checks every announcement. A one-byte view tag throws away almost all of them, and the rest are confirmed with one point addition. The announcements live in contract storage, so this is plain eth_call paging and works on any public RPC. And this note is encrypted with a fourth key from the same passkey, the vault key; only ciphertext is stored."

## Shot 7 (2:05–2:25): Prompt-free withdraw

**Click:** **Withdraw** on the payment → destination **My account** (or **Custom address** to avoid linking) → **Withdraw 25.00 mUSD**.

**Screen:** "Waiting for Monad's 3-block reserve window…", then confirmation with no passkey prompt; the leftover MON tip is swept in a second tx. mUSD balance on Home goes up by 25.

**Say:** "Withdraw. The SDK recovers the stealth private key, opens a short-lived Mera session just for that key, signs, and ends it. No prompt, and the gas came from the tip Alice sent."

## Shot 8 (2:25–2:50): Stateless test

**Click:** **Lock** (back to Landing). Then open DevTools → Application → **Clear site data** (or open a fresh browser profile signed into the same passkey provider). Reload. **Click:** **Continue with passkey** → choose the Monadow passkey → approve.

**Screen:** same account address, same meta-address, **Published** status read back from the registry, same balances; Inbox scan shows the same payment (now withdrawn).

**Say:** "Now I wipe everything. Lock ends the sessions and drops the keys; clearing site data removes the last trace, a public credential-ID hint. One passkey prompt, and it's all back: same address, same meta-address, same payments. Nothing needed for the account was stored. The passkey plus the chain is the whole account."

(Don't claim the note comes back after clearing site data: note ciphertext lives in that browser's localStorage and is deleted with it.)

## Shot 9 (2:50–3:00): Close

**Screen:** README on GitHub with the contract table, or the Landing page.

**Say:** "Monadow: receiver privacy on Monad with Mera as the entire account layer. Contracts are verified on testnet, the SDK is on npm as monadow-sdk, and everything is open source under MIT."

---

## Fallbacks

- If the faucet is slow, fund Bob from Alice's account and say "funded from a second account".
- If the authenticator needs a second prompt at creation (no PRF at create time), say "this provider needs one extra confirmation the first time".
- If a withdraw waits a couple of seconds: that is the SDK waiting 3 blocks for Monad's reserve-balance rule ("Monad checks balances three blocks back, so we wait about 1.6 seconds").
