import { useCallback, useEffect, useRef, useState } from 'react';
import type { Address } from 'viem';
import { deployment, publicClient } from './chain';
import { ERC20_ABI } from './tokens';

export type Balances = { mon: bigint | null; musd: bigint | null; updatedAt: number; error: boolean };

/** Polls MON + mUSD balances. Monad blocks are ~400ms, so a short interval feels live. */
export function useBalances(address: Address | null | undefined, intervalMs = 3000) {
  const [state, setState] = useState<Balances>({ mon: null, musd: null, updatedAt: 0, error: false });
  const alive = useRef(true);

  const refresh = useCallback(async () => {
    if (!address) return;
    try {
      const [mon, musd] = await Promise.all([
        publicClient.getBalance({ address }),
        deployment
          ? (publicClient.readContract({
              address: deployment.mockUsd,
              abi: ERC20_ABI,
              functionName: 'balanceOf',
              args: [address],
            }) as Promise<bigint>)
          : Promise.resolve(null),
      ]);
      if (alive.current) setState({ mon, musd, updatedAt: Date.now(), error: false });
    } catch {
      if (alive.current) setState((s) => ({ ...s, error: true }));
    }
  }, [address]);

  useEffect(() => {
    alive.current = true;
    void refresh();
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, intervalMs);
    return () => {
      alive.current = false;
      clearInterval(t);
    };
  }, [refresh, intervalMs]);

  return { ...state, refresh };
}
