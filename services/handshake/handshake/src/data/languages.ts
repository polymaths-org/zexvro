import { LanguageType } from '../types';

export interface LanguageMeta {
  id: LanguageType;
  /** Short label, e.g. "Rust" */
  short: string;
  /** Single-letter tile fallback */
  letter: string;
  /** Tile accent for letter fallbacks */
  color: string;
  /** Local logo (single-color mark, rendered inverted for dark UI) */
  logo?: string;
  /** Substring key used by list filters, e.g. "rust" matches all Rust variants */
  filterKey: string;
}

export const LANGUAGES: LanguageMeta[] = [
  { id: 'Rust (Soroban)', short: 'Rust', letter: 'R', color: '#CE422B', logo: '/languages/rust.svg', filterKey: 'rust' },
  { id: 'Rust (Anchor)', short: 'Rust', letter: 'R', color: '#CE422B', logo: '/languages/rust.svg', filterKey: 'rust' },
  { id: 'Rust (CosmWasm)', short: 'Rust', letter: 'R', color: '#CE422B', logo: '/languages/rust.svg', filterKey: 'rust' },
  { id: 'Rust (Near)', short: 'Rust', letter: 'R', color: '#CE422B', logo: '/languages/rust.svg', filterKey: 'rust' },
  { id: 'Solidity', short: 'Solidity', letter: 'S', color: '#E6E6E6', logo: '/languages/solidity.svg', filterKey: 'solidity' },
  { id: 'Vyper', short: 'Vyper', letter: 'V', color: '#22C55E', filterKey: 'vyper' },
  { id: 'Cairo (Starknet)', short: 'Cairo', letter: 'C', color: '#FF6B4A', filterKey: 'cairo' },
  { id: 'Move', short: 'Move', letter: 'M', color: '#4DA2FF', filterKey: 'move' },
  { id: 'Aiken (Cardano)', short: 'Aiken', letter: 'A', color: '#4C8DFF', filterKey: 'aiken' },
  { id: 'PyTeal (Algorand)', short: 'PyTeal', letter: 'P', color: '#94A3B8', filterKey: 'pyteal' },
  { id: 'SmartPy (Tezos)', short: 'SmartPy', letter: 'S', color: '#2C7DF7', filterKey: 'smartpy' },
  { id: 'FunC (TON)', short: 'FunC', letter: 'F', color: '#0098EA', filterKey: 'func' },
  { id: 'ink! (Polkadot)', short: 'ink!', letter: 'i', color: '#E6007A', filterKey: 'ink!' },
];

const byId = new Map<string, LanguageMeta>(LANGUAGES.map((l) => [l.id, l]));

export function getLanguage(id: string): LanguageMeta | undefined {
  return byId.get(id);
}
