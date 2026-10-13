import type { Address } from 'viem';

export type MonadowDeployment = { monadow: Address; registry: Address; mockUsd: Address; deployBlock: bigint };

/** Contract addresses per chain id (from contracts/deployments/<chainId>.json). */
export const DEPLOYMENTS: { [chainId: number]: MonadowDeployment } = {
  10143: {
    monadow: '0x4386667A6A31E2324AdBfA4CD80E1f1c6A626783',
    registry: '0x567FA1e916BE75A824CA7924377DfdE0c07150e5',
    mockUsd: '0xCC183F736cAfED29B054C094A238D20eA8dE3c19',
    deployBlock: 70789800n,
  },
};
