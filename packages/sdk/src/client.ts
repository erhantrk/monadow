import {
  encodeFunctionData,
  getAddress,
  parseEther,
  type Account,
  type Address,
  type Chain,
  type Hash,
  type Hex,
  type PublicClient,
  type Transport,
  type WalletClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { erc20Abi, mockUsdAbi, monadowAbi, registryAbi } from './abi.js';
import { MONAD_TESTNET, ZERO_ADDRESS } from './chain.js';
import {
  SCHEME_ID,
  checkStealthAddress,
  computeStealthPrivateKey,
  decodeMetaAddress,
  encodeMetaAddress,
  generateStealthAddress,
  metaAddressToBytes,
  privateKeyToAddress,
  type MonadowKeys,
} from './crypto.js';
import { DEPLOYMENTS, type MonadowDeployment } from './deployments.js';

export type Announcement = {
  index: bigint;
  stealthAddress: Address;
  caller: Address;
  /** zero address = native MON */
  token: Address;
  amount: bigint;
  ephemeralPublicKey: Hex;
  viewTag: Hex;
  blockNumber: bigint;
};

export type ReceivedPayment = Announcement & {
  stealthPrivateKey: Hex;
  /** current balance of `token` (MON if token is zero) held by the stealth address */
  balance: bigint;
  /** current MON balance of the stealth address */
  nativeBalance: bigint;
};

/** An account (or a Mera-style `{ account, end }` handle) used to sign stealth-address txs. */
export type StealthSigner = Account | { account: Account; end?: () => void };
export type AccountFactory = (privateKey: Hex) => StealthSigner | Promise<StealthSigner>;

export type WithdrawOptions = {
  /** Custom signer for the stealth key, e.g. Mera `meraAccount` (default: viem `privateKeyToAccount`). */
  accountFactory?: AccountFactory;
  /**
   * Wait until the funding tx is at least `RESERVE_DELAY_BLOCKS` old before sending (Monad's consensus
   * only sees balances from k=3 blocks ago). Default true.
   */
  waitForReserveDelay?: boolean;
};

export type MonadowClientOptions = {
  publicClient: PublicClient<Transport, Chain | undefined>;
  walletClient?: WalletClient<Transport, Chain | undefined, Account | undefined>;
  chainId?: number;
  addresses?: Partial<MonadowDeployment>;
  /** Chain object used when signing (default: walletClient.chain ?? publicClient.chain ?? MONAD_TESTNET). */
  chain?: Chain;
};

/** Monad reserve-balance "k": consensus checks balances lagged by 3 blocks. */
export const RESERVE_DELAY_BLOCKS = 3n;
/** Monad `user_reserve_balance` (10 MON). Senders ending below it may only spend value via an "emptying" tx. */
export const MONAD_RESERVE_BALANCE = parseEther('10');
/** Page size for `getAnnouncements` eth_calls. */
export const ANNOUNCEMENT_PAGE_SIZE = 200n;
/** Default MON forwarded to the stealth address on `sendToken`, so the recipient can pay gas. */
export const DEFAULT_GAS_TIP = parseEther('0.02');

/**
 * Monad charges gas on the gas LIMIT, so limits are explicit: max(estimate × 1.3, floor).
 * (estimate × 1.2 was observed to be insufficient on Monad testnet: a sendNative estimated at 262k reverted at 300k.)
 */
export const GAS_FLOORS = {
  sendNative: 350_000n,
  sendToken: 450_000n,
  approve: 70_000n,
  mint: 100_000n,
  registerKeys: 160_000n,
  transfer: 100_000n,
} as const;
export const bumpGas = (estimate: bigint, floor = 0n) => {
  const g = (estimate * 13n) / 10n + 1n;
  return g > floor ? g : floor;
};

const isEvmAddress = (s: string) => /^0x[0-9a-fA-F]{40}$/.test(s);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function unwrapSigner(s: StealthSigner): { account: Account; end?: () => void } {
  return 'address' in s ? { account: s } : s;
}

export class MonadowClient {
  readonly publicClient: PublicClient<Transport, Chain | undefined>;
  readonly walletClient?: WalletClient<Transport, Chain | undefined, Account | undefined>;
  readonly chainId: number;
  readonly chain: Chain;
  readonly addresses: MonadowDeployment;

  constructor(opts: MonadowClientOptions) {
    this.publicClient = opts.publicClient;
    this.walletClient = opts.walletClient;
    this.chainId = opts.chainId ?? opts.publicClient.chain?.id ?? MONAD_TESTNET.id;
    this.chain = opts.chain ?? opts.walletClient?.chain ?? opts.publicClient.chain ?? MONAD_TESTNET;
    const base = DEPLOYMENTS[this.chainId];
    const merged = { ...(base ?? {}), ...(opts.addresses ?? {}) } as Partial<MonadowDeployment>;
    if (!merged.monadow || !merged.registry || !merged.mockUsd) {
      throw new Error(`MonadowClient: no deployment for chain ${this.chainId}; pass opts.addresses`);
    }
    this.addresses = { deployBlock: 0n, ...merged } as MonadowDeployment;
  }

  // ------------------------------------------------------------ internals

  private requireWallet(): { wallet: WalletClient<Transport, Chain | undefined, Account | undefined>; account: Account } {
    const wallet = this.walletClient;
    if (!wallet) throw new Error('MonadowClient: walletClient required for this operation');
    const account = wallet.account;
    if (!account) throw new Error('MonadowClient: walletClient has no account');
    return { wallet, account };
  }

  /** writeContract with an explicit gas limit (estimate × 1.2). */
  private async write(params: { address: Address; abi: readonly unknown[]; functionName: string; args: readonly unknown[]; value?: bigint }): Promise<Hash> {
    const { wallet, account } = this.requireWallet();
    const floor = (GAS_FLOORS as Record<string, bigint>)[params.functionName] ?? 0n;
    const gas = bumpGas(await this.publicClient.estimateContractGas({ ...(params as any), account }), floor);
    if (params.value && params.value > 0n) await this.waitForReserveWindow(account.address, params.value + gas * (await this.publicClient.getGasPrice()));
    return wallet.writeContract({ ...(params as any), account, chain: this.chain, gas });
  }

  /** Accepts a meta-address or a 0x address registered in the ERC-6538 registry. */
  async resolveRecipient(recipient: string): Promise<string> {
    if (isEvmAddress(recipient)) {
      const meta = await this.resolveMetaAddress(getAddress(recipient));
      if (!meta) throw new Error(`${recipient} has no Monadow meta-address registered`);
      return meta;
    }
    decodeMetaAddress(recipient); // validates
    return recipient;
  }

  // ------------------------------------------------------------ registry

  async registerMetaAddress(metaAddress: string): Promise<Hash> {
    return this.write({
      address: this.addresses.registry,
      abi: registryAbi,
      functionName: 'registerKeys',
      args: [SCHEME_ID, metaAddressToBytes(metaAddress)],
    });
  }

  async resolveMetaAddress(address: Address): Promise<string | null> {
    const raw = (await this.publicClient.readContract({
      address: this.addresses.registry,
      abi: registryAbi,
      functionName: 'stealthMetaAddressOf',
      args: [address, SCHEME_ID],
    })) as Hex;
    if (!raw || raw === '0x' || raw.length !== 2 + 132) return null;
    try {
      return encodeMetaAddress(`0x${raw.slice(2, 68)}`, `0x${raw.slice(68)}`);
    } catch {
      return null;
    }
  }

  // ------------------------------------------------------------ send

  async sendNative(recipient: string, amount: bigint): Promise<{ hash: Hash; stealthAddress: Address }> {
    if (amount <= 0n) throw new Error('sendNative: amount must be > 0');
    const meta = await this.resolveRecipient(recipient);
    const { stealthAddress, ephemeralPublicKey, viewTag } = generateStealthAddress(meta);
    const hash = await this.write({
      address: this.addresses.monadow,
      abi: monadowAbi,
      functionName: 'sendNative',
      args: [stealthAddress, ephemeralPublicKey, viewTag],
      value: amount,
    });
    return { hash, stealthAddress };
  }

  async sendToken(
    recipient: string,
    token: Address,
    amount: bigint,
    gasTip: bigint = DEFAULT_GAS_TIP,
  ): Promise<{ hash: Hash; stealthAddress: Address; approveHash?: Hash }> {
    if (amount <= 0n) throw new Error('sendToken: amount must be > 0');
    const { account } = this.requireWallet();
    const meta = await this.resolveRecipient(recipient);
    const allowance = (await this.publicClient.readContract({
      address: token,
      abi: erc20Abi,
      functionName: 'allowance',
      args: [account.address, this.addresses.monadow],
    })) as bigint;
    let approveHash: Hash | undefined;
    if (allowance < amount) {
      approveHash = await this.write({
        address: token,
        abi: erc20Abi,
        functionName: 'approve',
        args: [this.addresses.monadow, amount],
      });
      const r = await this.publicClient.waitForTransactionReceipt({ hash: approveHash });
      if (r.status !== 'success') throw new Error(`sendToken: approve reverted (${approveHash})`);
    }
    const { stealthAddress, ephemeralPublicKey, viewTag } = generateStealthAddress(meta);
    const hash = await this.write({
      address: this.addresses.monadow,
      abi: monadowAbi,
      functionName: 'sendToken',
      args: [token, amount, stealthAddress, ephemeralPublicKey, viewTag],
      value: gasTip,
    });
    return { hash, stealthAddress, approveHash };
  }

  /** Testnet faucet: mint MockUSD (6 dp) to `to` (default: wallet account). Default 100 mUSD. */
  async mintMockUsd(to?: Address, amount: bigint = 100_000_000n): Promise<Hash> {
    const { account } = this.requireWallet();
    return this.write({
      address: this.addresses.mockUsd,
      abi: mockUsdAbi,
      functionName: 'mint',
      args: [to ?? account.address, amount],
    });
  }

  // ------------------------------------------------------------ scan

  async announcementCount(): Promise<bigint> {
    return (await this.publicClient.readContract({
      address: this.addresses.monadow,
      abi: monadowAbi,
      functionName: 'announcementCount',
    })) as bigint;
  }

  /**
   * Reads announcements from contract storage via eth_call (no eth_getLogs).
   * With `limit`: one page of at most `limit`. Without: everything from `start`, paginated by 200.
   */
  async getAnnouncements(start: bigint = 0n, limit?: bigint): Promise<Announcement[]> {
    const out: Announcement[] = [];
    const end = limit !== undefined ? start + limit : await this.announcementCount();
    let cursor = start;
    while (cursor < end) {
      const pageLimit = end - cursor < ANNOUNCEMENT_PAGE_SIZE ? end - cursor : ANNOUNCEMENT_PAGE_SIZE;
      const page = (await this.publicClient.readContract({
        address: this.addresses.monadow,
        abi: monadowAbi,
        functionName: 'getAnnouncements',
        args: [cursor, pageLimit],
      })) as readonly {
        stealthAddress: Address;
        caller: Address;
        token: Address;
        amount: bigint;
        ephemeralPubKey: Hex;
        viewTag: Hex;
        blockNumber: bigint;
      }[];
      page.forEach((a, i) =>
        out.push({
          index: cursor + BigInt(i),
          stealthAddress: a.stealthAddress,
          caller: a.caller,
          token: a.token,
          amount: a.amount,
          ephemeralPublicKey: a.ephemeralPubKey,
          viewTag: a.viewTag,
          blockNumber: BigInt(a.blockNumber),
        }),
      );
      if (page.length < Number(pageLimit)) break; // clamped by count
      cursor += pageLimit;
    }
    return out;
  }

  /** Finds every announcement addressed to `keys`, with the recovered stealth key and live balances. */
  async scan(
    keys: Pick<MonadowKeys, 'viewingPrivateKey' | 'spendingPublicKey' | 'spendingPrivateKey'>,
    opts: { start?: bigint } = {},
  ): Promise<ReceivedPayment[]> {
    const anns = await this.getAnnouncements(opts.start ?? 0n);
    const mine = anns.filter((a) => checkStealthAddress(a, keys.viewingPrivateKey, keys.spendingPublicKey));
    return Promise.all(
      mine.map(async (a) => {
        const stealthPrivateKey = computeStealthPrivateKey(a.ephemeralPublicKey, keys.viewingPrivateKey, keys.spendingPrivateKey);
        const nativeBalance = await this.publicClient.getBalance({ address: a.stealthAddress });
        const balance =
          a.token === ZERO_ADDRESS
            ? nativeBalance
            : ((await this.publicClient.readContract({
                address: a.token,
                abi: erc20Abi,
                functionName: 'balanceOf',
                args: [a.stealthAddress],
              })) as bigint);
        return { ...a, stealthPrivateKey, balance, nativeBalance };
      }),
    );
  }

  // ------------------------------------------------------------ withdraw

  private async waitForBlock(target: bigint, timeoutMs = 20_000): Promise<void> {
    const t0 = Date.now();
    while ((await this.publicClient.getBlockNumber({ cacheTime: 0 })) < target) {
      if (Date.now() - t0 > timeoutMs) throw new Error(`timed out waiting for block ${target}`);
      await sleep(400);
    }
  }

  /**
   * Monad reserve balance: a sender whose balance would end below 10 MON may only move value in an
   * "emptying" tx, i.e. when it sent NO other tx in the previous k=3 blocks (otherwise the tx is included
   * but REVERTS with "reserve balance violation"). Waits until all of `address`'s txs are ≥ k blocks old.
   * No-op when the sender stays above the reserve.
   */
  async waitForReserveWindow(address: Address, spend: bigint, timeoutMs = 20_000): Promise<void> {
    const balance = await this.publicClient.getBalance({ address });
    if (balance - spend >= MONAD_RESERVE_BALANCE) return;
    const t0 = Date.now();
    for (;;) {
      const latest = await this.publicClient.getBlockNumber({ cacheTime: 0 });
      const [pending, settled] = await Promise.all([
        this.publicClient.getTransactionCount({ address, blockTag: 'pending' }),
        this.publicClient.getTransactionCount({ address, blockNumber: latest - RESERVE_DELAY_BLOCKS }).catch(() => -1),
      ]);
      if (settled === pending) return;
      if (settled === -1) {
        // historical state unavailable: fall back to waiting k+1 blocks
        await this.waitForBlock(latest + RESERVE_DELAY_BLOCKS + 1n, timeoutMs);
        return;
      }
      if (Date.now() - t0 > timeoutMs) throw new Error('timed out waiting for Monad reserve-balance window');
      await sleep(400);
    }
  }

  private async signAndSend(privateKey: Hex, factory: AccountFactory | undefined, build: (from: Address) => Promise<Record<string, unknown>>): Promise<Hash> {
    const signer = unwrapSigner(await (factory ? factory(privateKey) : privateKeyToAccount(privateKey)));
    try {
      const account = signer.account;
      if (!account.signTransaction) throw new Error('accountFactory must return a local account (signTransaction)');
      const nonce = await this.publicClient.getTransactionCount({ address: account.address, blockTag: 'pending' });
      const tx = { ...(await build(account.address)), nonce, chainId: this.chain.id };
      const serialized = await account.signTransaction(tx as any);
      return await this.publicClient.sendRawTransaction({ serializedTransaction: serialized });
    } finally {
      signer.end?.();
    }
  }

  /**
   * Sweep a received payment to `to`, signing with the stealth key.
   *  - token: transfers the full token balance (gas paid from the MON tip sent along with it);
   *    MON tip leftovers stay at the stealth address (use `sweepNative` ≥3 blocks later, or `withdrawAll`).
   *  - native: legacy tx with value = balance − gasLimit·gasPrice, so the balance ends at exactly 0
   *    (Monad charges gasLimit·gasPrice, no refund). Valid under Monad's reserve-balance "emptying exception"
   *    because a fresh stealth EOA is undelegated and sends nothing else within 3 blocks.
   */
  async withdraw(payment: ReceivedPayment, to: Address, opts: WithdrawOptions = {}): Promise<Hash> {
    if (opts.waitForReserveDelay !== false) await this.waitForBlock(payment.blockNumber + RESERVE_DELAY_BLOCKS + 1n);
    if (payment.token === ZERO_ADDRESS) return this.sweepNative(payment.stealthPrivateKey, to, { ...opts, waitForReserveDelay: false });
    return this.transferToken(payment.stealthPrivateKey, payment.token, to, opts);
  }

  /** Transfer the full token balance held by a stealth key to `to`. */
  async transferToken(stealthPrivateKey: Hex, token: Address, to: Address, opts: WithdrawOptions = {}): Promise<Hash> {
    return this.signAndSend(stealthPrivateKey, opts.accountFactory, async (from) => {
      const [balance, native, gasPrice0] = await Promise.all([
        this.publicClient.readContract({ address: token, abi: erc20Abi, functionName: 'balanceOf', args: [from] }) as Promise<bigint>,
        this.publicClient.getBalance({ address: from }),
        this.publicClient.getGasPrice(),
      ]);
      if (balance === 0n) throw new Error('withdraw: token balance is 0');
      const data = encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [to, balance] });
      const gas = bumpGas(await this.publicClient.estimateGas({ account: from, to: token, data }), GAS_FLOORS.transfer);
      const gasPrice = (gasPrice0 * 11n) / 10n;
      if (native < gas * gasPrice) {
        throw new Error(`withdraw: stealth address needs ${gas * gasPrice} wei MON for gas, has ${native}`);
      }
      return { type: 'legacy', to: token, data, gas, gasPrice, value: 0n };
    });
  }

  /**
   * Send the ENTIRE MON balance of a key to `to` (balance ends at 0).
   * Monad reserve balance: requires that this EOA sent no tx in the previous 3 blocks and was funded ≥3 blocks ago.
   */
  async sweepNative(stealthPrivateKey: Hex, to: Address, opts: WithdrawOptions = {}): Promise<Hash> {
    if (opts.waitForReserveDelay !== false) {
      await this.waitForReserveWindow(privateKeyToAddress(stealthPrivateKey), MONAD_RESERVE_BALANCE * 1000n);
    }
    return this.signAndSend(stealthPrivateKey, opts.accountFactory, async (from) => {
      const [balance, gasPrice0] = await Promise.all([this.publicClient.getBalance({ address: from }), this.publicClient.getGasPrice()]);
      const gasPrice = (gasPrice0 * 11n) / 10n;
      const code = await this.publicClient.getCode({ address: to });
      const gas = !code || code === '0x' ? 21_000n : bumpGas(await this.publicClient.estimateGas({ account: from, to, value: 1n }));
      const fee = gas * gasPrice;
      if (balance <= fee) throw new Error(`withdraw: MON balance ${balance} does not cover gas ${fee}`);
      return { type: 'legacy', to, value: balance - fee, gas, gasPrice };
    });
  }

  /**
   * Withdraw a payment AND sweep any leftover MON (e.g. the gas tip on token payments).
   * For token payments waits >3 blocks between the two txs (Monad's emptying exception needs a quiet sender).
   */
  async withdrawAll(payment: ReceivedPayment, to: Address, opts: WithdrawOptions = {}): Promise<{ tokenHash?: Hash; nativeHash?: Hash }> {
    if (payment.token === ZERO_ADDRESS) return { nativeHash: await this.withdraw(payment, to, opts) };
    const tokenHash = await this.withdraw(payment, to, opts);
    const r = await this.publicClient.waitForTransactionReceipt({ hash: tokenHash });
    if (r.status !== 'success') throw new Error(`withdrawAll: token transfer reverted (${tokenHash})`);
    let nativeHash: Hash | undefined;
    try {
      nativeHash = await this.sweepNative(payment.stealthPrivateKey, to, { ...opts, waitForReserveDelay: true });
    } catch {
      // dust smaller than the sweep gas: leave it
    }
    return { tokenHash, nativeHash };
  }
}

/** Convenience faucet: mint MockUSD. */
export async function mintMockUsd(opts: {
  publicClient: PublicClient<Transport, Chain | undefined>;
  walletClient: WalletClient<Transport, Chain | undefined, Account | undefined>;
  to?: Address;
  amount?: bigint;
  chainId?: number;
  addresses?: Partial<MonadowDeployment>;
}): Promise<Hash> {
  const c = new MonadowClient(opts);
  return c.mintMockUsd(opts.to, opts.amount);
}
