import {
  createPublicClient,
  createWalletClient,
  http,
  zeroAddress,
  type LocalAccount,
  type PublicClient,
  type WalletClient,
} from 'viem';
import { DEPLOYMENTS, MONAD_TESTNET, MonadowClient } from 'monadow-sdk';

export const chain = MONAD_TESTNET;
export const RPC_URL = 'https://testnet-rpc.monad.xyz';

export const transport = http(RPC_URL, { batch: { wait: 16 }, retryCount: 2 });

export const publicClient = createPublicClient({ chain, transport }) as PublicClient;

const dep = DEPLOYMENTS[chain.id];
/** Null when contracts aren't deployed yet (zero / missing addresses). */
export const deployment =
  dep && dep.monadow && dep.monadow !== zeroAddress ? dep : null;

export function makeWalletClient(account: LocalAccount): WalletClient {
  return createWalletClient({ account, chain, transport });
}

export function makeMonadowClient(walletClient?: WalletClient): MonadowClient {
  return new MonadowClient({ publicClient, walletClient, chainId: chain.id });
}

