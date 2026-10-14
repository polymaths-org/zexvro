/**
 * Morph's mark, traced from assets/morph-idle.gif and made exactly symmetric (mirror axis x = 594).
 * The source SVG in assets/ is an auto-trace with 11 grey layers; this is the clean version.
 */
export const MARK_VIEWBOX = { x: 104, y: 104, size: 980 }

export const MARK_LEFT =
  'M134 165Q134 113 172.9 147.5L547.5 479.1Q570 499 570 529L570 679Q570 713 544.7 690.3L332.3 499.7Q307 477 307 511L307 743Q307 755 315.6 763.3L416 860L416 1053Q416 1056 413.8 1054L150.5 820.6Q134 806 134 784Z'

export const MARK_RIGHT =
  'M1054 784Q1054 806 1037.5 820.6L774.2 1054Q772 1056 772 1053L772 860L872.4 763.3Q881 755 881 743L881 511Q881 477 855.7 499.7L643.3 690.3Q618 713 618 679L618 529Q618 499 640.5 479.1L1015.1 147.5Q1054 113 1054 165Z'

export const MARK_EYES = [
  { x: 472, y: 798, width: 47, height: 107, rx: 23 },
  { x: 668, y: 798, width: 47, height: 107, rx: 23 }
]

/** Where the eyes sit inside the square viewBox, as fractions of its size. */
export const EYE_CENTER = { x: 0.5, y: (851.5 - MARK_VIEWBOX.y) / MARK_VIEWBOX.size }

/** The eyes' bottom edge as a fraction; glass placed just below this lets Morph "peek over" it. */
export const EYE_BOTTOM = (905 - MARK_VIEWBOX.y) / MARK_VIEWBOX.size
