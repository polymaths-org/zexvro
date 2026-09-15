import { ChainType, LanguageType } from '../types';

export type ChainFamily = 'evm' | 'soroban' | 'svm' | 'move' | 'cosmwasm' | 'cairo' | 'other';

export interface ChainMeta {
  id: ChainType;
  /** Display name, e.g. "Base" */
  name: string;
  /** Short label used in badges, e.g. "base" / "eip155:1" */
  shortLabel: string;
  family: ChainFamily;
  familyLabel: string;
  /** Local logo served from /chains/<id>.png */
  logo: string;
  /** Brand accent (dots, strips, bars) */
  accent: string;
  /** Base URL for account/address pages; undefined = no explorer link */
  explorerAccount?: string;
  /** Chain + network identifier, never a bare "mainnet" */
  caip: string;
  addressPlaceholder: string;
  defaultLanguage: LanguageType;
  mainnet: string;
  testnet: string;
}

const evm = (
  id: ChainType,
  name: string,
  accent: string,
  explorerAccount: string | undefined,
  caip: string,
  mainnet: string,
  testnet: string
): ChainMeta => ({
  id,
  name,
  shortLabel: id,
  family: 'evm',
  familyLabel: 'EVM',
  logo: `/chains/${id}.png`,
  accent,
  explorerAccount,
  caip,
  addressPlaceholder: 'e.g. 0x8f3aC71B4e9D02c6A5b83F1d47E0c9B2a6D5E4F1',
  defaultLanguage: 'Solidity',
  mainnet,
  testnet,
});

export const CHAINS: ChainMeta[] = [
  // -- EVM L1 --
  { ...evm('ethereum', 'Ethereum', '#627EEA', 'https://etherscan.io/address', 'eip155:1', 'Mainnet', 'Sepolia'), shortLabel: 'eip155:1' },
  evm('bnb', 'BNB Chain', '#F0B90B', 'https://bscscan.com/address', 'eip155:56', 'Mainnet', 'Chapel'),
  evm('avalanche', 'Avalanche', '#E84142', 'https://snowscan.xyz/address', 'eip155:43114', 'C-Chain', 'Fuji'),
  evm('polygon', 'Polygon', '#7B3FE4', 'https://polygonscan.com/address', 'eip155:137', 'Mainnet', 'Amoy'),
  evm('tron', 'Tron', '#FF0013', 'https://tronscan.org/address', 'tron:mainnet', 'Mainnet', 'Nile'),
  evm('sonic', 'Sonic', '#38BDF8', 'https://sonicscan.org/address', 'eip155:146', 'Mainnet', 'Blaze'),
  evm('gnosis', 'Gnosis', '#12AA7A', 'https://gnosisscan.io/address', 'eip155:100', 'Mainnet', 'Chiado'),
  evm('filecoin', 'Filecoin', '#0090FF', 'https://filfox.info/en/address', 'eip155:314', 'Mainnet', 'Calibration'),
  evm('berachain', 'Berachain', '#E8A33D', 'https://berascan.com/address', 'eip155:80094', 'Mainnet', 'bEpola'),
  evm('celo', 'Celo', '#35D07F', 'https://celoscan.io/address', 'eip155:42220', 'Mainnet', 'Alfajores'),
  evm('sei', 'Sei', '#E42A3B', 'https://seitrace.com/address', 'eip155:1329', 'Mainnet', 'Atlantic'),
  // -- EVM L2 --
  evm('base', 'Base', '#0052FF', 'https://basescan.org/address', 'eip155:8453', 'Mainnet', 'Sepolia'),
  evm('arbitrum', 'Arbitrum', '#28A0F0', 'https://arbiscan.io/address', 'eip155:42161', 'One', 'Sepolia'),
  evm('optimism', 'Optimism', '#FF0420', 'https://optimistic.etherscan.io/address', 'eip155:10', 'Mainnet', 'Sepolia'),
  evm('zksync', 'ZKsync', '#8C8DFC', 'https://explorer.zksync.io/address', 'eip155:324', 'Era', 'Sepolia'),
  evm('linea', 'Linea', '#61DFFF', 'https://lineascan.build/address', 'eip155:59144', 'Mainnet', 'Sepolia'),
  evm('scroll', 'Scroll', '#E5C07B', 'https://scrollscan.com/address', 'eip155:534352', 'Mainnet', 'Sepolia'),
  evm('blast', 'Blast', '#FCFC03', 'https://blastscan.io/address', 'eip155:81457', 'Mainnet', 'Sepolia'),
  evm('mantle', 'Mantle', '#65B3AE', 'https://explorer.mantle.xyz/address', 'eip155:5000', 'Mainnet', 'Sepolia'),
  evm('monad', 'Monad', '#836EF9', undefined, 'eip155:143', 'Mainnet', 'Testnet'),
  // -- Non-EVM --
  {
    id: 'stellar',
    name: 'Stellar',
    shortLabel: 'stellar',
    family: 'soroban',
    familyLabel: 'Soroban',
    logo: '/chains/stellar.png',
    accent: '#3B82F6',
    explorerAccount: undefined, // stellar.expert needs network routing — handled in ChainBadge
    caip: 'stellar:pubnet',
    addressPlaceholder: 'e.g. CA3D5L8MNP4K19QZ7W22XYR09V1K83L6PQQ901X1Z',
    defaultLanguage: 'Rust (Soroban)',
    mainnet: 'Pubnet',
    testnet: 'Testnet',
  },
  {
    id: 'solana',
    name: 'Solana',
    shortLabel: 'solana',
    family: 'svm',
    familyLabel: 'SVM · Anchor',
    logo: '/chains/solana.png',
    accent: '#9945FF',
    explorerAccount: 'https://solscan.io/account',
    caip: 'solana:mainnet',
    addressPlaceholder: 'e.g. 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    defaultLanguage: 'Rust (Anchor)',
    mainnet: 'Mainnet',
    testnet: 'Devnet',
  },
  {
    id: 'sui',
    name: 'Sui',
    shortLabel: 'sui',
    family: 'move',
    familyLabel: 'Move',
    logo: '/chains/sui.png',
    accent: '#4DA2FF',
    explorerAccount: 'https://suiscan.xyz/mainnet/object',
    caip: 'sui:mainnet',
    addressPlaceholder: 'e.g. 0x2::coin::Coin<0x3::sui::SUI>',
    defaultLanguage: 'Move',
    mainnet: 'Mainnet',
    testnet: 'Testnet',
  },
  {
    id: 'aptos',
    name: 'Aptos',
    shortLabel: 'aptos',
    family: 'move',
    familyLabel: 'Move',
    logo: '/chains/aptos.png',
    accent: '#2DD4BF',
    explorerAccount: 'https://explorer.aptoslabs.com/account',
    caip: 'aptos:mainnet',
    addressPlaceholder: 'e.g. 0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>',
    defaultLanguage: 'Move',
    mainnet: 'Mainnet',
    testnet: 'Testnet',
  },
  {
    id: 'near',
    name: 'NEAR',
    shortLabel: 'near',
    family: 'other',
    familyLabel: 'NEAR',
    logo: '/chains/near.png',
    accent: '#00EC97',
    explorerAccount: 'https://nearblocks.io/address',
    caip: 'near:mainnet',
    addressPlaceholder: 'e.g. treasury.sputnik-dao.near',
    defaultLanguage: 'Rust (Near)',
    mainnet: 'Mainnet',
    testnet: 'Testnet',
  },
  {
    id: 'cosmos',
    name: 'Cosmos Hub',
    shortLabel: 'cosmos',
    family: 'cosmwasm',
    familyLabel: 'CosmWasm',
    logo: '/chains/cosmos.png',
    accent: '#7C8DB0',
    explorerAccount: 'https://www.mintscan.io/cosmos/address',
    caip: 'cosmos:cosmoshub-4',
    addressPlaceholder: 'e.g. cosmos1fl48vsnmsdzcv85q5cw8qhc8z8ddv8gw6a9x7tj',
    defaultLanguage: 'Rust (CosmWasm)',
    mainnet: 'Mainnet',
    testnet: 'Testnet',
  },
  {
    id: 'injective',
    name: 'Injective',
    shortLabel: 'injective',
    family: 'cosmwasm',
    familyLabel: 'CosmWasm',
    logo: '/chains/injective.png',
    accent: '#34F5C5',
    explorerAccount: 'https://www.mintscan.io/injective/address',
    caip: 'injective:injective-1',
    addressPlaceholder: 'e.g. inj1fl48vsnmsdzcv85q5cw8qhc8z8ddv8gp7a0h2lm',
    defaultLanguage: 'Rust (CosmWasm)',
    mainnet: 'Mainnet',
    testnet: 'Testnet',
  },
  {
    id: 'polkadot',
    name: 'Polkadot',
    shortLabel: 'polkadot',
    family: 'other',
    familyLabel: 'ink!',
    logo: '/chains/polkadot.png',
    accent: '#E6007A',
    explorerAccount: 'https://polkadot.subscan.io/account',
    caip: 'polkadot:91b171bb158e2d3848fa23a9f1c25182',
    addressPlaceholder: 'e.g. 15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp',
    defaultLanguage: 'ink! (Polkadot)',
    mainnet: 'Mainnet',
    testnet: 'Westend',
  },
  {
    id: 'cardano',
    name: 'Cardano',
    shortLabel: 'cardano',
    family: 'other',
    familyLabel: 'Aiken',
    logo: '/chains/cardano.png',
    accent: '#4C8DFF',
    explorerAccount: 'https://cardanoscan.io/address',
    caip: 'cardano:mainnet',
    addressPlaceholder: 'e.g. addr1qx2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer3n0d3vllmyqwsx5…',
    defaultLanguage: 'Aiken (Cardano)',
    mainnet: 'Mainnet',
    testnet: 'Preprod',
  },
  {
    id: 'algorand',
    name: 'Algorand',
    shortLabel: 'algorand',
    family: 'other',
    familyLabel: 'PyTeal',
    logo: '/chains/algorand.png',
    accent: '#FFFFFF',
    explorerAccount: 'https://allo.info/application',
    caip: 'algorand:mainnet',
    addressPlaceholder: 'e.g. 609278421 (app id)',
    defaultLanguage: 'PyTeal (Algorand)',
    mainnet: 'Mainnet',
    testnet: 'Testnet',
  },
  {
    id: 'tezos',
    name: 'Tezos',
    shortLabel: 'tezos',
    family: 'other',
    familyLabel: 'SmartPy',
    logo: '/chains/tezos.png',
    accent: '#2C7DF7',
    explorerAccount: 'https://tzkt.io',
    caip: 'tezos:mainnet',
    addressPlaceholder: 'e.g. KT1ThEdxfUcWUwqsdergy3QMb2U5GHo6BU',
    defaultLanguage: 'SmartPy (Tezos)',
    mainnet: 'Mainnet',
    testnet: 'Ghostnet',
  },
  {
    id: 'ton',
    name: 'TON',
    shortLabel: 'ton',
    family: 'other',
    familyLabel: 'FunC',
    logo: '/chains/ton.png',
    accent: '#0098EA',
    explorerAccount: 'https://tonscan.org/address',
    caip: 'ton:mainnet',
    addressPlaceholder: 'e.g. EQD__________________________________________0vo',
    defaultLanguage: 'FunC (TON)',
    mainnet: 'Mainnet',
    testnet: 'Testnet',
  },
  {
    id: 'starknet',
    name: 'Starknet',
    shortLabel: 'starknet',
    family: 'cairo',
    familyLabel: 'Cairo',
    logo: '/chains/starknet.png',
    accent: '#FF6B4A',
    explorerAccount: 'https://starkscan.co/contract',
    caip: 'starknet:mainnet',
    addressPlaceholder: 'e.g. 0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7',
    defaultLanguage: 'Cairo (Starknet)',
    mainnet: 'Mainnet',
    testnet: 'Sepolia',
  },
];

const byId = new Map<ChainType, ChainMeta>(CHAINS.map((c) => [c.id, c]));

export function getChain(id: string): ChainMeta | undefined {
  return byId.get(id as ChainType);
}

export function chainLabel(id: string): string {
  return byId.get(id as ChainType)?.name ?? id;
}
