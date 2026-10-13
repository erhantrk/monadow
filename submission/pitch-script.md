# Monadow: pitch script

## 2-minute pitch

**[0:00–0:15] Team**

"Hi, I'm Erhan, and I built Monadow solo for Metropolis. Before this I built Shade, a private payments protocol on Stellar. Monadow takes what I learned there and rebuilds it natively for Monad."

**[0:15–0:45] Problem**

"Today, getting paid on-chain means doxxing yourself. Share your address once, for an invoice, a tip jar or a salary, and everyone can see your balance, your income and everyone who pays you. Stealth addresses solve that: each payment goes to a fresh address only you can unlock. But nobody uses them, because they add even more keys on top of the seed phrase and the extension people already struggle with."

**[0:45–1:15] Solution**

"Monadow makes the passkey the entire account. One Face ID prompt through Mera gives us a secret, and we split it into separate keys: your public Monad wallet, a stealth spend key, a stealth view key and a vault key. Anyone can pay your normal 0x address; the money lands at a one-time address that only you can find. You scan your inbox and withdraw without another prompt. Clear your browser or switch devices, and the same passkey brings everything back, because nothing is stored. It's live on Monad testnet today, and the SDK is on npm."

**[1:15–1:40] Why now, why Monad**

"Two things just became true. Passkeys with the PRF extension now ship in iCloud Keychain, Google Password Manager and 1Password, so a passkey can hold real keys, not just log you in. And Monad makes a fresh address per payment cheap and fast: 400-millisecond blocks mean send, scan and withdraw feel instant, and full EVM compatibility means we use ERC-5564 and ERC-6538 as they are."

**[1:40–2:00] Vision**

"Monadow is the private 'pay me' link for Monad: a tip jar, a freelancer invoice, payroll, a merchant QR code, all private by default and as easy as Face ID. Next steps are an audit, mainnet, sender-side privacy, and the SDK inside other Monad wallets and apps, so every app on Monad can offer private receiving with one passkey. Thank you."

---

## 30-second ad script (optional)

**[0–5s]** *Close-up: someone pastes a wallet address into a chat. A block explorer zooms out to show their whole history.*
VO: "Every time you share your wallet, you share everything in it."

**[5–15s]** *Phone: Monadow landing, Face ID animation, Home appears.*
VO: "Monadow gives you private payments on Monad. One passkey. No seed phrase. No extension."

**[15–25s]** *Split screen: a friend sends 25 mUSD; Bob's inbox lights up; tap Withdraw, done.*
VO: "Every payment lands at a brand-new address only you can unlock. Scan, withdraw, done. No popups."

**[25–30s]** *Logo on near-black, purple accent. URL.*
VO: "Monadow. Get paid, not tracked. erhantrk.github.io/monadow"
