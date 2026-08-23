export interface ServiceItem {
  id: string;
  name: string;
  /** Unique display headline shown big on the card */
  headline: string;
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
  /** Optional external link (e.g. ZEXVRO Labs) */
  href?: string;
  /** What the service does — one concise line */
  what: string;
  /** Who the service is for */
  forWho: string;
  /** Strong reason to use it */
  why: string;
}

export interface Web2Web3Step {
  text: 'Web2' | 'Web3' | 'ZEXVRO';
  index: number;
}
