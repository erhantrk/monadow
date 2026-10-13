import { defineChain, type Address } from 'viem';

export const MONAD_TESTNET = defineChain({
  id: 10143,
  name: 'Monad Testnet',
  nativeCurrency: { name: 'Monad', symbol: 'MON', decimals: 18 },
  rpcUrls: { default: { http: ['https://testnet-rpc.monad.xyz'] } },
  blockExplorers: { default: { name: 'MonadVision', url: 'https://testnet.monadvision.com' } },
  contracts: {
    multicall3: { address: '0xcA11bde05977b3631167028862bE2a173976CA11', blockCreated: 251449 },
  },
  testnet: true,
});

export const ZERO_ADDRESS: Address = '0x0000000000000000000000000000000000000000';

/** Explorer links. */
export const explorerTxUrl = (hash: string, chain = MONAD_TESTNET) => `${chain.blockExplorers!.default.url}/tx/${hash}`;
export const explorerAddressUrl = (address: string, chain = MONAD_TESTNET) =>
  `${chain.blockExplorers!.default.url}/address/${address}`;
