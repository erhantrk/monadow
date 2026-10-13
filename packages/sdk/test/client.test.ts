import { describe, expect, it } from 'vitest';
import type { Address } from 'viem';
import { MonadowClient, ZERO_ADDRESS, bumpGas, deriveMonadowKeys, generateStealthAddress, privateKeyToAddress } from '../src/index.js';

const me = deriveMonadowKeys(new Uint8Array(32).fill(11));
const other = deriveMonadowKeys(new Uint8Array(32).fill(12));

function fakeClient(total: number, mineAt: Set<number>) {
  const anns = Array.from({ length: total }, (_, i) => {
    const g = generateStealthAddress(mineAt.has(i) ? me.metaAddress : other.metaAddress);
    return {
      stealthAddress: g.stealthAddress,
      caller: ZERO_ADDRESS,
      token: ZERO_ADDRESS,
      _pad: 0n,
      amount: BigInt(i + 1),
      ephemeralPubKey: g.ephemeralPublicKey,
      viewTag: g.viewTag,
      blockNumber: 100n + BigInt(i),
    };
  });
  const calls: [bigint, bigint][] = [];
  const pc = {
    chain: { id: 10143 },
    readContract: async ({ functionName, args }: { functionName: string; args?: readonly bigint[] }) => {
      if (functionName === 'announcementCount') return BigInt(total);
      if (functionName === 'getAnnouncements') {
        const [s, l] = args!;
        calls.push([s, l]);
        return anns.slice(Number(s), Math.min(total, Number(s + l)));
      }
      throw new Error(functionName);
    },
    getBalance: async ({ address }: { address: Address }) => 7n,
  };
  return { pc, calls };
}

describe('MonadowClient (mocked RPC)', () => {
  it('paginates getAnnouncements by 200 and scan finds only mine', async () => {
    const { pc, calls } = fakeClient(450, new Set([3, 250, 449]));
    const c = new MonadowClient({ publicClient: pc as any });
    const all = await c.getAnnouncements();
    expect(all.length).toBe(450);
    expect(calls).toEqual([
      [0n, 200n],
      [200n, 200n],
      [400n, 50n],
    ]);
    expect(all[449].index).toBe(449n);
    const found = await c.scan(me);
    expect(found.map((f) => f.index)).toEqual([3n, 250n, 449n]);
    for (const f of found) {
      expect(privateKeyToAddress(f.stealthPrivateKey)).toBe(f.stealthAddress);
      expect(f.balance).toBe(7n);
    }
    const page = await c.getAnnouncements(10n, 5n);
    expect(page.map((a) => a.index)).toEqual([10n, 11n, 12n, 13n, 14n]);
  });
  it('bumpGas = max(estimate*1.3, floor)', () => {
    expect(bumpGas(100_000n, 0n)).toBe(130_001n);
    expect(bumpGas(100_000n, 350_000n)).toBe(350_000n);
  });
});
