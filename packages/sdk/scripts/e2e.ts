/**
 * End-to-end on Monad testnet:
 *   random PRF → keys → fund+register recipient → send MON + mUSD to its 0x address (registry lookup)
 *   → scan → withdraw both to the recipient's account address (one via Mera signing session).
 * Uses DEPLOYER_PRIVATE_KEY from ../../.env as the sender (never printed).
 *   npx tsx scripts/e2e.ts
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createPublicClient, createWalletClient, formatEther, formatUnits, http, parseEther, type Hash, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { MONAD_TESTNET, MonadowClient, ZERO_ADDRESS, deriveMonadowKeys, erc20Abi, explorerTxUrl, type AccountFactory } from '../src/index.js';

const envPath = fileURLToPath(new URL('../../../.env', import.meta.url));
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]),
);
const pk = env.DEPLOYER_PRIVATE_KEY as Hex;
if (!pk) throw new Error('DEPLOYER_PRIVATE_KEY missing');
const rpc = env.MONAD_RPC_URL || 'https://testnet-rpc.monad.xyz';

const transport = http(rpc);
const publicClient = createPublicClient({ chain: MONAD_TESTNET, transport });
const sender = privateKeyToAccount(pk.startsWith('0x') ? pk : (`0x${pk}` as Hex));
const senderWallet = createWalletClient({ chain: MONAD_TESTNET, transport, account: sender });
const senderClient = new MonadowClient({ publicClient, walletClient: senderWallet });

const log = (...a: unknown[]) => console.log(...a);
const txs: Record<string, Hash> = {};
async function confirm(label: string, hash: Hash) {
  txs[label] = hash;
  const r = await publicClient.waitForTransactionReceipt({ hash });
  log(`  ${label.padEnd(16)} ${r.status} gasUsed=${r.gasUsed} block=${r.blockNumber} ${explorerTxUrl(hash)}`);
  if (r.status !== 'success') throw new Error(`${label} reverted`);
  return r;
}
async function waitBlocks(fromBlock: bigint, n = 4n) {
  while ((await publicClient.getBlockNumber({ cacheTime: 0 })) < fromBlock + n) await new Promise((r) => setTimeout(r, 400));
}

let meraFactory: AccountFactory | undefined;
try {
  meraFactory = (await import('../src/mera.js')).meraAccountFactory;
} catch (e) {
  log('Mera unavailable in this runtime, falling back to viem accounts:', (e as Error).message);
}

log(`stealth signer for native withdraw: ${meraFactory ? 'Mera signing session' : 'viem privateKeyToAccount'}`);
log(`sender ${sender.address} balance ${formatEther(await publicClient.getBalance({ address: sender.address }))} MON`);

// 1. recipient keys from random "PRF output"
const keys = deriveMonadowKeys(crypto.getRandomValues(new Uint8Array(32)));
log(`recipient account ${keys.accountAddress}\n  meta ${keys.metaAddress}`);

// 2. fund recipient account (for registry gas) and register its meta-address
const fundHash = await senderWallet.sendTransaction({ to: keys.accountAddress, value: parseEther('0.03'), gas: 21_000n });
const fundR = await confirm('fundRecipient', fundHash);
await waitBlocks(fundR.blockNumber); // Monad reserve balance: consensus sees balances lagged by 3 blocks
const recipientWallet = createWalletClient({ chain: MONAD_TESTNET, transport, account: privateKeyToAccount(keys.accountPrivateKey) });
const recipientClient = new MonadowClient({ publicClient, walletClient: recipientWallet });
await confirm('registerKeys', await recipientClient.registerMetaAddress(keys.metaAddress));
const resolved = await senderClient.resolveMetaAddress(keys.accountAddress);
if (resolved !== keys.metaAddress) throw new Error(`registry mismatch: ${resolved}`);
log('  registry resolve OK');

const countBefore = await senderClient.announcementCount();

// 3. send MON + mUSD to the recipient's 0x address (resolved via registry)
const nat = await senderClient.sendNative(keys.accountAddress, parseEther('0.01'));
await confirm('sendNative', nat.hash);
await confirm('mintMockUsd', await senderClient.mintMockUsd(sender.address, 5_000_000n));
const tok = await senderClient.sendToken(keys.accountAddress, senderClient.addresses.mockUsd, 5_000_000n);
if (tok.approveHash) txs.approve = tok.approveHash;
await confirm('sendToken', tok.hash);

// 4. scan
const payments = await recipientClient.scan(keys, { start: countBefore });
log(`  scan found ${payments.length} payment(s) from index ${countBefore}`);
for (const p of payments) {
  log(`   #${p.index} ${p.token === ZERO_ADDRESS ? 'MON' : 'mUSD'} amount=${p.amount} stealth=${p.stealthAddress} balance=${p.balance} native=${p.nativeBalance}`);
}
const pn = payments.find((p) => p.token === ZERO_ADDRESS && p.stealthAddress === nat.stealthAddress);
const pt = payments.find((p) => p.token !== ZERO_ADDRESS && p.stealthAddress === tok.stealthAddress);
if (!pn || !pt) throw new Error('scan did not find both payments');

// 5. withdraw
const accBefore = await publicClient.getBalance({ address: keys.accountAddress });
await confirm('withdrawNative', await recipientClient.withdraw(pn, keys.accountAddress, { accountFactory: meraFactory }));
const all = await recipientClient.withdrawAll(pt, keys.accountAddress);
await confirm('withdrawToken', all.tokenHash!);
if (all.nativeHash) await confirm('sweepGasTip', all.nativeHash);

// 6. verify
const [nLeft, tLeft, tNative, accAfter, accUsd] = await Promise.all([
  publicClient.getBalance({ address: pn.stealthAddress }),
  publicClient.readContract({ address: pt.token, abi: erc20Abi, functionName: 'balanceOf', args: [pt.stealthAddress] }),
  publicClient.getBalance({ address: pt.stealthAddress }),
  publicClient.getBalance({ address: keys.accountAddress }),
  publicClient.readContract({ address: pt.token, abi: erc20Abi, functionName: 'balanceOf', args: [keys.accountAddress] }),
]);
log(`native stealth left: ${nLeft} wei | token stealth left: ${tLeft} mUSD-units, ${tNative} wei MON`);
log(`recipient account: +${formatEther(accAfter - accBefore)} MON, ${formatUnits(accUsd, 6)} mUSD`);
if (nLeft !== 0n || tLeft !== 0n || accUsd !== 5_000_000n) throw new Error('E2E FAILED: balances not swept');
log('\nE2E OK');
log(JSON.stringify(txs, null, 2));
