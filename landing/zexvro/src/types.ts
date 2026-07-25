export interface ServiceItem {
  id: string;
  name: string;
  shortDesc: string;
  fullDesc: string;
  /** Lucide fallback id (legacy); prefer logo paths */
  iconName: string;
  techDetails: string[];
  hologramColor: string;
  /** CDN path helpers — same-origin /services/* */
  logo32: string;
  logo64: string;
  logo: string;
}

export interface Web2Web3Step {
  text: 'Web2' | 'Web3' | 'ZEXVRO';
  index: number;
}
