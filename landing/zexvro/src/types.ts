export interface ServiceItem {
  id: string;
  name: string;
  shortDesc: string;
  fullDesc: string;
  iconName: string; // Lucide icon identifier
  techDetails: string[];
  hologramColor: string; // Gradient color for iridescent reflections
}

export interface Web2Web3Step {
  text: 'Web2' | 'Web3' | 'ZEXVRO';
  index: number;
}
