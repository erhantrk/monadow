// Hand-written `as const` ABIs (for viem type inference). Verified against contracts/abi/*.json.

export const monadowAbi = [
  { type: 'function', name: 'SCHEME_ID', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { type: 'function', name: 'announcementCount', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  {
    type: 'function',
    name: 'getAnnouncements',
    stateMutability: 'view',
    inputs: [
      { name: 'start', type: 'uint256' },
      { name: 'limit', type: 'uint256' },
    ],
    outputs: [
      {
        name: '',
        type: 'tuple[]',
        components: [
          { name: 'stealthAddress', type: 'address' },
          { name: 'caller', type: 'address' },
          { name: 'token', type: 'address' },
          { name: '_pad', type: 'uint96' },
          { name: 'amount', type: 'uint256' },
          { name: 'ephemeralPubKey', type: 'bytes' },
          { name: 'viewTag', type: 'bytes1' },
          { name: 'blockNumber', type: 'uint64' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'sendNative',
    stateMutability: 'payable',
    inputs: [
      { name: 'stealth', type: 'address' },
      { name: 'ephemeralPubKey', type: 'bytes' },
      { name: 'viewTag', type: 'bytes1' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'sendToken',
    stateMutability: 'payable',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'stealth', type: 'address' },
      { name: 'ephemeralPubKey', type: 'bytes' },
      { name: 'viewTag', type: 'bytes1' },
    ],
    outputs: [],
  },
  {
    type: 'event',
    name: 'Announcement',
    anonymous: false,
    inputs: [
      { name: 'schemeId', type: 'uint256', indexed: true },
      { name: 'stealthAddress', type: 'address', indexed: true },
      { name: 'caller', type: 'address', indexed: true },
      { name: 'ephemeralPubKey', type: 'bytes', indexed: false },
      { name: 'metadata', type: 'bytes', indexed: false },
    ],
  },
  { type: 'error', name: 'InvalidEphemeralPubKey', inputs: [] },
  { type: 'error', name: 'InvalidStealthAddress', inputs: [] },
  { type: 'error', name: 'NativeTransferFailed', inputs: [] },
  { type: 'error', name: 'Reentrancy', inputs: [] },
  { type: 'error', name: 'TokenTransferFailed', inputs: [] },
  { type: 'error', name: 'ZeroAmount', inputs: [] },
] as const;

export const registryAbi = [
  {
    type: 'function',
    name: 'registerKeys',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'schemeId', type: 'uint256' },
      { name: 'stealthMetaAddress', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'stealthMetaAddressOf',
    stateMutability: 'view',
    inputs: [
      { name: '', type: 'address' },
      { name: '', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bytes' }],
  },
  {
    type: 'event',
    name: 'StealthMetaAddressSet',
    anonymous: false,
    inputs: [
      { name: 'registrant', type: 'address', indexed: true },
      { name: 'schemeId', type: 'uint256', indexed: true },
      { name: 'stealthMetaAddress', type: 'bytes', indexed: false },
    ],
  },
] as const;

export const erc20Abi = [
  { type: 'function', name: 'name', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'string' }] },
  { type: 'function', name: 'symbol', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'string' }] },
  { type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint8' }] },
  { type: 'function', name: 'totalSupply', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'allowance',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'transferFrom',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

export const mockUsdAbi = [
  ...erc20Abi,
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
