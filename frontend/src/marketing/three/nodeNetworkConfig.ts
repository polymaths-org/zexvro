export type NetworkNode = {
  id: string;
  position: [number, number, number];
  size: number;
};

export const networkNodes: NetworkNode[] = [
  { id: 'core', position: [0, 0, 0], size: 0.18 },
  { id: 'nw', position: [-1.3, 0.92, -0.35], size: 0.15 },
  { id: 'ne', position: [1.34, 0.86, 0.2], size: 0.15 },
  { id: 'sw', position: [-1.22, -0.92, 0.24], size: 0.15 },
  { id: 'se', position: [1.26, -0.88, -0.3], size: 0.15 },
  { id: 'w', position: [-1.75, -0.05, 0.16], size: 0.11 },
  { id: 'e', position: [1.78, 0.02, -0.14], size: 0.11 },
  { id: 'inner-nw', position: [-0.58, 0.48, 0.28], size: 0.12 },
  { id: 'inner-ne', position: [0.58, 0.48, -0.2], size: 0.12 },
  { id: 'inner-sw', position: [-0.58, -0.48, -0.12], size: 0.12 },
  { id: 'inner-se', position: [0.58, -0.48, 0.22], size: 0.12 },
];

export const networkEdges: Array<[string, string]> = [
  ['core', 'inner-nw'],
  ['core', 'inner-ne'],
  ['core', 'inner-sw'],
  ['core', 'inner-se'],
  ['inner-nw', 'nw'],
  ['inner-ne', 'ne'],
  ['inner-sw', 'sw'],
  ['inner-se', 'se'],
  ['inner-nw', 'w'],
  ['inner-sw', 'w'],
  ['inner-ne', 'e'],
  ['inner-se', 'e'],
  ['nw', 'ne'],
  ['sw', 'se'],
];

export function shouldUseStaticNetwork(reducedMotion: boolean) {
  if (reducedMotion) return true;
  if (typeof window === 'undefined') return true;
  const lowCoreCount = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4;
  const mobile = window.matchMedia('(max-width: 760px)').matches;
  return Boolean(lowCoreCount || mobile);
}
