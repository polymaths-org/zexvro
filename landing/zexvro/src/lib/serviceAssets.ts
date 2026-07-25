/** Service logo URLs — same-origin under /services (CF Pages edge cache). */
export type ServiceLogoSize = 32 | 64 | 256;

export function serviceLogoUrl(id: string, size: ServiceLogoSize = 64): string {
  if (id === 'morph') {
    if (size === 32) return '/services/morph-32.png';
    if (size === 64) return '/services/morph-64.png';
    return '/services/morph.svg';
  }
  if (size === 32) return `/services/${id}-32.png`;
  if (size === 64) return `/services/${id}-64.png`;
  return `/services/${id}.png`;
}

export function serviceLogoSrcSet(id: string): string {
  if (id === 'morph') {
    return '/services/morph-32.png 32w, /services/morph-64.png 64w, /services/morph.png 256w';
  }
  return `/services/${id}-32.png 32w, /services/${id}-64.png 64w, /services/${id}.png 256w`;
}
