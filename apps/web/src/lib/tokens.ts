import { zeroAddress, type Address } from 'viem';
import { deployment } from './chain';

export type AssetId = 'MON' | 'mUSD';

export const ASSETS: Record<AssetId, { id: AssetId; symbol: string; decimals: number; name: string }> = {
  MON: { id: 'MON', symbol: 'MON', decimals: 18, name: 'Monad' },
  mUSD: { id: 'mUSD', symbol: 'mUSD', decimals: 6, name: 'Monadow USD' },
};

export function assetForToken(token: Address) {
  if (token.toLowerCase() === zeroAddress) return ASSETS.MON;
  if (deployment && token.toLowerCase() === deployment.mockUsd.toLowerCase()) return ASSETS.mUSD;
  return { id: 'mUSD' as AssetId, symbol: 'TOKEN', decimals: 18, name: 'Token' };
}

export const ERC20_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'a', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'mint',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
] as const;

export const MONADOW_COUNT_ABI = [
  {
    type: 'function',
    name: 'announcementCount',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
] as const;
