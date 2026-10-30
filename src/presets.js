const SIDES = { N: 1, E: 1, S: 1, W: 1 }
const ALL_EIGHT = { NW: 1, N: 1, NE: 1, W: 1, E: 1, SW: 1, S: 1, SE: 1 }
const HEX_SIX = { NW: 1, NE: 1, W: 1, E: 1, SW: 1, SE: 1 }

export const CLASSIC_RULE = { grid: 'square', weights: SIDES, threshold: 4, extra: 'keep' }
export const HEX_RULE = { grid: 'hex', weights: HEX_SIX, threshold: 6, extra: 'keep' }

const CENTRE_PILE = [[0.5, 0.5, 2 ** 16]]

// Pile positions are fractions of the world size.
export const PRESETS = [
  {
    id: 'classic',
    name: 'Classic',
    blurb: '4 neighbours, topple at 4.',
    rule: CLASSIC_RULE,
    size: 513,
    piles: CENTRE_PILE,
  },
  {
    id: 'diagonals',
    name: 'Diagonals too',
    blurb: '8 neighbours, topple at 8.',
    rule: { grid: 'square', weights: ALL_EIGHT, threshold: 8, extra: 'keep' },
    size: 513,
    piles: CENTRE_PILE,
  },
  {
    id: 'hex',
    name: 'Hexagonal',
    blurb: '6 neighbours, topple at 6.',
    rule: HEX_RULE,
    size: 513,
    piles: CENTRE_PILE,
  },
  {
    id: 'weighted',
    name: 'Weighted',
    blurb: '2 grains to each side, 1 to each corner, topple at 12.',
    rule: {
      grid: 'square',
      weights: { NW: 1, N: 2, NE: 1, W: 2, E: 2, SW: 1, S: 2, SE: 1 },
      threshold: 12,
      extra: 'keep',
    },
    size: 513,
    piles: CENTRE_PILE,
  },
  {
    id: 'leftovers',
    name: 'Leftovers',
    blurb: 'Topple at 6 but give away only 4. Two grains stay behind.',
    rule: { ...CLASSIC_RULE, threshold: 6 },
    size: 513,
    piles: CENTRE_PILE,
  },
  {
    id: 'owing',
    name: 'Owing sand',
    blurb: 'Topple at 2 but give away 4. Cells can go negative.',
    rule: { ...CLASSIC_RULE, threshold: 2 },
    size: 257,
    piles: [[0.5, 0.5, 2 ** 14]],
  },
  {
    id: 'lopsided',
    name: 'Lopsided',
    blurb: '2 grains go east, 1 to the other sides. The pile drifts.',
    rule: { grid: 'square', weights: { N: 1, E: 2, S: 1, W: 1 }, threshold: 5, extra: 'keep' },
    size: 257,
    piles: [[0.5, 0.23, 2 ** 14]],
  },
  {
    id: 'two-piles',
    name: 'Two piles',
    blurb: 'Two classic piles grow into each other.',
    rule: CLASSIC_RULE,
    size: 513,
    piles: [[0.5, 0.4, 2 ** 15], [0.5, 0.6, 2 ** 15]],
  },
  {
    id: 'fill',
    name: 'Fill & settle',
    blurb: 'Fill a box, settle, subtract, settle again: the sandpile identity.',
    rule: CLASSIC_RULE,
    size: 161,
    fill: true,
  },
  {
    id: 'avalanches',
    name: 'Avalanches',
    blurb: 'Grains rain onto a full box, one at a time. Watch the avalanches.',
    rule: CLASSIC_RULE,
    size: 129,
    full: true,
    rain: 1,
    speed: 'medium',
  },
]
