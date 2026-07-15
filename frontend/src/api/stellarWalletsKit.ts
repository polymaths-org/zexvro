/**
 * Stellar Wallets Kit wrapper — used for the "Others" wallet picker.
 * Primary buttons (Freighter / Albedo / xBull) stay direct.
 *
 * We intentionally omit FreighterModule so Vite does not pull kit's freighter-api@5
 * against the app's freighter-api@6 (named-export interop break).
 */
import {
  StellarWalletsKit,
  WalletNetwork,
  AlbedoModule,
  xBullModule,
  RabetModule,
  LobstrModule,
  HanaModule,
  HotWalletModule,
  KleverModule,
  type ISupportedWallet,
} from '@creit.tech/stellar-wallets-kit';
import type { WalletConnection, WalletProvider } from './walletConnect';

let kitSingleton: StellarWalletsKit | null = null;

function networkEnum(network: 'TESTNET' | 'PUBLIC'): WalletNetwork {
  return network === 'PUBLIC' ? WalletNetwork.PUBLIC : WalletNetwork.TESTNET;
}

function buildModules() {
  return [
    new AlbedoModule(),
    new xBullModule(),
    new RabetModule(),
    new LobstrModule(),
    new HanaModule(),
    new HotWalletModule(),
    new KleverModule(),
  ];
}

export function getStellarWalletsKit(network: 'TESTNET' | 'PUBLIC' = 'TESTNET'): StellarWalletsKit {
  if (!kitSingleton) {
    kitSingleton = new StellarWalletsKit({
      network: networkEnum(network),
      selectedWalletId: 'albedo',
      modules: buildModules(),
    });
  }
  return kitSingleton;
}

function mapKitIdToProvider(id: string): WalletProvider {
  const lower = (id || '').toLowerCase();
  if (lower.includes('freighter')) return 'freighter';
  if (lower.includes('albedo')) return 'albedo';
  if (lower.includes('xbull')) return 'xbull';
  return 'kit';
}

/**
 * Open the Stellar Wallets Kit modal and return a connection once the user picks a wallet.
 */
export function connectWithWalletsKit(
  network: 'TESTNET' | 'PUBLIC' = 'TESTNET',
): Promise<WalletConnection> {
  const kit = getStellarWalletsKit(network);

  return new Promise((resolve, reject) => {
    let settled = false;

    kit
      .openModal({
        modalTitle: 'Connect another Stellar wallet',
        notAvailableText: 'This wallet is not available in your browser. Install it, then try again.',
        onWalletSelected: async (option: ISupportedWallet) => {
          try {
            kit.setWallet(option.id);
            const { address } = await kit.getAddress();
            if (!address) {
              throw new Error('Wallet did not return an address.');
            }
            settled = true;
            resolve({
              publicKey: address,
              provider: mapKitIdToProvider(option.id),
              network,
              kitWalletId: option.id,
              kitWalletName: option.name,
            });
          } catch (err: any) {
            settled = true;
            reject(new Error(err?.message || 'Failed to connect selected wallet'));
          }
        },
        onClosed: (err?: Error) => {
          if (settled) return;
          settled = true;
          if (err) {
            reject(err);
          } else {
            reject(new Error('Wallet selection cancelled'));
          }
        },
      })
      .catch((err: any) => {
        if (settled) return;
        settled = true;
        reject(new Error(err?.message || 'Could not open wallet picker'));
      });
  });
}
