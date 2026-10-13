# Monadow — Metropolis hackathon form draft

Form status (2026-10-14, ~6h before deadline 03:59 UTC / 06:59 GMT+3):
The Project page only shows a "Create your project" card with 2 fields (Project name, One-line description).
All other fields (Submission tab) only appear AFTER clicking "CREATE PROJECT". Team already exists (solo: Erhan).

## Create-project card (typed into the form, not submitted)
- Project name (max 120): Monadow
- One-line description (max 200):
  Private stealth payments on Monad: one passkey derives your wallet, stealth spend and view keys, so you can get paid at one-time addresses with no seed phrase or extension.

## Copy for the Submission tab (paste after the project is created)

### Tagline (short)
Get paid on Monad without doxxing your wallet. One passkey, many keys.

### Description
Monadow is a private payments app on Monad where your passkey is the entire account layer. One WebAuthn passkey ceremony (via the Mera SDK by Category Labs, using the PRF extension) yields a secret that is split with HKDF into separate namespaces: a public Monad account key, a stealth spending key, a stealth viewing key, and a vault key.

Senders pay a fresh one-time stealth address (ERC-5564 scheme 1, secp256k1) derived from the recipient's meta-address, published in an ERC-6538-style registry. The Monadow contract forwards MON or ERC-20 to that address and stores the announcement on-chain. The recipient scans announcements with their view key and withdraws with the derived stealth key, with no wallet prompt per withdrawal thanks to a Mera signing session.

Monadow is stateless: clear your storage or switch devices and the same passkey rebuilds everything from the chain. There is no seed phrase, no browser extension, and nothing essential in local storage.

### Problem
Every on-chain payment publicly links sender, receiver and amount history. Share your address once to get paid and anyone can see your balance, your income and who pays you. Freelancers, payroll recipients, donors' beneficiaries and merchants need to get paid without exposing their whole wallet, and existing privacy tools usually require seed phrases, extensions or complex setup.

### Intended users
Anyone receiving payments on Monad who wants receiver privacy without managing seed phrases or installing extensions: freelancers, creators accepting tips/donations, small merchants, and teams paying contributors.

### How it uses Monad
- Deployed on Monad testnet (chainId 10143).
- 400ms blocks and cheap gas make a fresh one-time address per payment practical and make inbox scanning feel instant.
- Announcements are stored in contract storage and read via paginated eth_call, so scanning works on any RPC without relying on eth_getLogs.
- Transactions use explicit, tight gas limits (Monad charges on gas limit); withdrawals respect Monad reserve-balance rules.

### How it uses Mera
- Passkey creation and PRF output (createPasskeyWithPrfOutput / getPasskeyPrfOutput) are the only login: one prompt, keys derived.
- One passkey, many keys: the PRF root is expanded with HKDF into the account key, stealth spend key, stealth view key and vault key, each in its own namespace.
- Account and stealth transactions are signed through Mera secp256k1 signing sessions exposed as viem accounts, so withdrawals are prompt-free while the session is unlocked; "Lock" drops keys from memory.

### Tech stack
Solidity ^0.8.24 + Foundry (MonadowRegistry, Monadow, MockUSD test token); TypeScript SDK published to npm as "monadow-sdk" (viem, @noble/curves, @noble/hashes, tsup); web app with Vite, React 18, TypeScript, Tailwind 4; Mera SDK (@category-labs/mera) for passkeys/PRF and signing sessions; hosted on GitHub Pages.

### Links
- Live app: https://erhantrk.github.io/monadow/
- Repo: https://github.com/erhantrk/monadow (make public before submitting)
- npm: https://www.npmjs.com/package/monadow-sdk

### Pre-existing work / lineage (disclosure)
Monadow is a port and redesign of Shade (https://github.com/stellarshade-labs/Shade), a pre-existing private payments project on Stellar. The Stellar-specific pool, relayer and indexer were dropped because on EVM payments can go directly to a one-time stealth EOA. Contracts, SDK, Mera integration and web app for Monad were built during the hackathon.

### AI tools disclosure
AI coding tools (Claude Code) were used during development.

### Team
Solo: Erhan Türker (GitHub: erhantrk).

### Track / bounties (user selects manually)
- Track: Consumer Products & Payments
- Bounties: Monad Foundation: Best Mera-Powered UX; Mera: One Passkey, Many Keys

### Contracts (Monad testnet, chainId 10143, verified on Sourcify)
- Monadow (announcer + sender): 0x4386667A6A31E2324AdBfA4CD80E1f1c6A626783
- MonadowRegistry (ERC-6538): 0x567FA1e916BE75A824CA7924377DfdE0c07150e5
- MockUSD (demo token): 0xCC183F736cAfED29B054C094A238D20eA8dE3c19
- Example stealth payment tx (sendToken: 10 mUSD + MON gas tip to a one-time address): 0x652740c890685e57fb8d7dd9daa2de29f8c3b616b2ff48cd5e056c3224a6a57a
- Explorer: https://testnet.monadvision.com
  - https://testnet.monadvision.com/address/0x4386667A6A31E2324AdBfA4CD80E1f1c6A626783
  - https://testnet.monadvision.com/tx/0x652740c890685e57fb8d7dd9daa2de29f8c3b616b2ff48cd5e056c3224a6a57a

### Left empty (user to provide)
- Demo video URL
- Logo / images
- Pitch deck / pitch fields

## Submission tab fields (actual form, discovered after project creation)

### Description (max 8,000) — use the "Description" section above plus Problem / Monad / Mera / stack / contracts / lineage / AI sections, combined (see "Description (as typed)" below)

### Go-to-market and user acquisition strategy (max 8,000)
Who first: people who already get paid on-chain and feel the privacy cost today: freelancers and contractors paid in stablecoins, creators taking tips and donations, DAO and team contributors on payroll, and small merchants. On Monad these are the earliest users of payment apps, and they are reachable through the Monad community, ecosystem Discords and builder programs.

Wedge: zero setup. A recipient opens a link, makes one passkey prompt, and gets a meta-address to share. No seed phrase, no extension, no new wallet to fund before receiving. That makes it easy to try from a single shared link ("pay me privately at monadow").

Distribution:
1. Developer channel first: the open-source monadow-sdk on npm lets wallets, payroll tools, invoicing apps and checkout widgets on Monad add "receive privately" in a few lines. Each integration brings its own users, so the SDK is the main growth lever.
2. Shareable pay links and QR codes for meta-addresses, so every payment request markets the product to the sender.
3. Ecosystem partnerships with Monad wallets, payroll and creator-tipping apps, and the Mera passkey stack (passkey-native UX is a shared story).
4. Community content: short explainers on why public payment history is a problem and how stealth addresses fix it.

Path to mainnet: audit the two small contracts, deploy on Monad mainnet, then add stablecoin support by default. Possible revenue later: a small optional fee on the send contract, or paid SDK features for businesses (batch payroll, invoicing, compliance-friendly disclosure via view keys), while keeping the core protocol open.

### GitHub repository
https://github.com/erhantrk/monadow  (must be public or shared with metropolis@hackathon.monad.xyz before submit)

### Live product
https://erhantrk.github.io/monadow/

### Judge access instructions (optional, max 8,000)
1. Open https://erhantrk.github.io/monadow/ in Chrome or Safari with a passkey provider that supports the WebAuthn PRF extension (iCloud Keychain, Google Password Manager, or 1Password).
2. Click "Continue with passkey" and create a passkey. One prompt derives all keys.
3. Get testnet MON at https://faucet.monad.xyz for the shown account address (or ask us), then press "Mint 100 mUSD" and "Register on-chain".
4. Send MON or mUSD to another meta-address (or your own) on the Send screen. Open Inbox to scan and withdraw prompt-free.
5. Statelessness test: clear site data or open another device with the same synced passkey; one prompt rebuilds everything from chain.
Contracts (Monad testnet 10143, verified on Sourcify): Monadow 0x4386667A6A31E2324AdBfA4CD80E1f1c6A626783, MonadowRegistry 0x567FA1e916BE75A824CA7924377DfdE0c07150e5, MockUSD 0xCC183F736cAfED29B054C094A238D20eA8dE3c19. Example stealth payment tx: https://testnet.monadvision.com/tx/0x652740c890685e57fb8d7dd9daa2de29f8c3b616b2ff48cd5e056c3224a6a57a
SDK: https://www.npmjs.com/package/monadow-sdk

### Left empty: Project logo (upload), Technical demo video, Pitch video, Product advertisement, X profile link, Primary track, Bounties.

### Description (as typed)
Monadow is a private payments app on Monad where your passkey is the entire account layer.

PROBLEM
Every on-chain payment publicly links sender, receiver and amount history. Share your address once to get paid, and anyone can see your balance, your income and who pays you. Freelancers, payroll recipients, creators and merchants need to get paid without doxxing their whole wallet, and existing privacy tools usually require seed phrases, extensions or complex setup.

HOW IT WORKS
- One passkey, many keys: a single WebAuthn ceremony through the Mera SDK by Category Labs (PRF extension) yields a secret that HKDF splits into separate namespaces: a public Monad account key, a stealth spending key, a stealth viewing key and a vault key.
- Receive: your meta-address (spend + view public keys) is published in an ERC-6538-style registry. Share it, or just your 0x address.
- Send: the sender derives a fresh one-time stealth address (ERC-5564 scheme 1, secp256k1). The Monadow contract forwards MON or ERC-20 to it and stores the announcement on-chain.
- Scan and withdraw: the recipient scans announcements with the view key and withdraws with the derived stealth key, prompt-free inside a Mera signing session. "Lock" drops all keys from memory.
- Stateless: clear storage or switch devices and the same passkey rebuilds everything from the chain. No seed phrase, no extension, nothing essential in local storage.

WHY MONAD
400ms blocks and cheap gas make a fresh one-time address per payment practical and make inbox scanning feel instant. Announcements live in contract storage and are read with paginated eth_call, so scanning works on any RPC without eth_getLogs. All transactions use explicit, tight gas limits, and withdrawals respect Monad's reserve-balance rules.

BUILT WITH
Solidity + Foundry (MonadowRegistry, Monadow, MockUSD demo token); TypeScript SDK published on npm as monadow-sdk (viem, @noble/curves, @noble/hashes); Vite + React 18 + Tailwind 4 web app; Mera SDK (@category-labs/mera) for passkeys, PRF and secp256k1 signing sessions.

DEPLOYED (Monad testnet, chainId 10143, verified on Sourcify)
- Monadow (announcer + sender): 0x4386667A6A31E2324AdBfA4CD80E1f1c6A626783
- MonadowRegistry (ERC-6538): 0x567FA1e916BE75A824CA7924377DfdE0c07150e5
- MockUSD (demo token): 0xCC183F736cAfED29B054C094A238D20eA8dE3c19
- Example stealth payment (10 mUSD + MON gas tip to a one-time address): https://testnet.monadvision.com/tx/0x652740c890685e57fb8d7dd9daa2de29f8c3b616b2ff48cd5e056c3224a6a57a

LINKS
App: https://erhantrk.github.io/monadow/
SDK: https://www.npmjs.com/package/monadow-sdk

DISCLOSURES
Monadow is a port and redesign of Shade (https://github.com/stellarshade-labs/Shade), a pre-existing private payments project on Stellar. The Stellar-specific pool, relayer and indexer were dropped because on EVM payments can go directly to a one-time stealth address. The Monad contracts, SDK, Mera integration and web app were built for this hackathon. AI coding tools (Claude Code) were used during development. Team: solo, Erhan Türker (GitHub: erhantrk).
