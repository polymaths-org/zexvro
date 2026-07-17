import { describe, expect, it } from 'vitest';
import {
  buildGatewayConfig,
  isStellarGAddress,
  normalizePrice,
  normalizeRoute,
  sanitizeProviderDraft,
  validateProviderDraft,
  type DepinProviderDraft,
} from './depinConfig';

const valid: DepinProviderDraft = {
  route: '/v1/weather',
  method: 'GET',
  upstreamUrl: 'https://httpbin.org/get',
  description: 'Weather probe',
  price: '0.001',
  recipient: 'GCD4SBBOLPUM7UYWLPRKOP6IYKOZ6FX5YQOJHVVE7RKC2QGZYNUHKRCZ',
  network: 'stellar:testnet',
  timeoutMs: 5000,
};

describe('depinConfig', () => {
  it('normalizes route and price', () => {
    expect(normalizeRoute('v1/weather/')).toBe('/v1/weather');
    expect(normalizePrice('0.001')).toBe('$0.001');
    expect(isStellarGAddress(valid.recipient)).toBe(true);
    expect(isStellarGAddress('CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA')).toBe(false);
  });

  it('validates provider drafts', () => {
    expect(validateProviderDraft(valid)).toEqual([]);
    expect(validateProviderDraft({ ...valid, route: '/health' })[0]).toMatch(/reserved/i);
    expect(validateProviderDraft({ ...valid, recipient: 'not-a-key' })[0]).toMatch(/G-address/i);
  });

  it('builds gateway JSON with sanitized providers', () => {
    const config = buildGatewayConfig([valid]);
    expect(config.providers[0]?.price).toBe('$0.001');
    expect(config.providers[0]?.route).toBe('/v1/weather');
    expect(config.port).toBe(4102);
    expect(sanitizeProviderDraft(valid).network).toBe('stellar:testnet');
  });
});
