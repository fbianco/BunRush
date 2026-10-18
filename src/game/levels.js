// ---------------------------------------------------------------------------
// Level data. Levels are described declaratively, not as ASCII art:
//   floors  : { row, from, to }        horizontal girders (tile columns)
//   ladders : [col, topRow, bottomRow]  a ladder may pass through floors
//   burgers : { col, items: [[kind, row], ...] }  4-tile wide stacks, top first
//   spawns  : [row, col] places where enemies can appear
// tests/levels.test.mjs checks every level is consistent and finishable.
// ---------------------------------------------------------------------------

const full = (row) => ({ row, from: 0, to: 27 });

export const LEVELS = [
  {
    name: 'OPENING SHIFT',
    floors: [full(2), full(5), full(8), full(11), full(14), full(17)],
    ladders: [
      [0, 2, 8], [0, 11, 17],
      [7, 2, 5], [7, 8, 17],
      [14, 2, 11], [14, 14, 17],
      [20, 5, 14],
      [27, 2, 5], [27, 11, 17],
    ],
    burgers: [
      { col: 2, items: [['bunTop', 2], ['lettuce', 5], ['patty', 11], ['bunBottom', 14]] },
      { col: 9, items: [['bunTop', 2], ['cheese', 8], ['patty', 11], ['bunBottom', 17]] },
      { col: 15, items: [['bunTop', 5], ['tomato', 8], ['patty', 14], ['bunBottom', 17]] },
      { col: 22, items: [['bunTop', 2], ['lettuce', 5], ['patty', 8], ['bunBottom', 14]] },
    ],
    spawns: [[2, 0], [2, 27], [8, 0], [8, 27], [14, 27], [14, 0]],
    playerStart: [17, 13],
    enemies: ['onion', 'chili', 'meatball'],
  },
  {
    name: 'LUNCH RUSH',
    floors: [
      full(2),
      { row: 5, from: 0, to: 12 }, { row: 5, from: 15, to: 27 },
      full(8),
      { row: 11, from: 0, to: 19 }, { row: 11, from: 21, to: 27 },
      full(14), full(17),
    ],
    ladders: [
      [0, 2, 5], [0, 8, 14],
      [7, 2, 11], [7, 14, 17],
      [13, 8, 17], [14, 2, 8],
      [20, 5, 17],
      [27, 2, 8], [27, 11, 17],
    ],
    burgers: [
      { col: 2, items: [['bunTop', 2], ['lettuce', 5], ['patty', 8], ['bunBottom', 14]] },
      { col: 9, items: [['bunTop', 2], ['cheese', 5], ['tomato', 11], ['bunBottom', 17]] },
      { col: 15, items: [['bunTop', 5], ['patty', 8], ['lettuce', 11], ['bunBottom', 14]] },
      { col: 22, items: [['bunTop', 2], ['cheese', 8], ['patty', 11], ['bunBottom', 17]] },
    ],
    spawns: [[2, 0], [2, 27], [8, 0], [8, 27], [14, 0], [14, 27]],
    playerStart: [17, 14],
    enemies: ['chili', 'onion', 'meatball'],
  },
  {
    name: 'DINNER SERVICE',
    floors: [
      full(2),
      { row: 5, from: 0, to: 12 }, { row: 5, from: 15, to: 27 },
      full(8), full(11),
      { row: 14, from: 6, to: 27 },
      full(17),
    ],
    ladders: [
      [0, 2, 17],
      [6, 2, 5], [6, 8, 14],
      [13, 2, 8], [13, 11, 17],
      [21, 2, 11], [21, 14, 17],
      [27, 5, 14],
    ],
    burgers: [
      { col: 1, items: [['bunTop', 2], ['lettuce', 5], ['patty', 11], ['bunBottom', 17]] },
      { col: 8, items: [['bunTop', 2], ['tomato', 8], ['cheese', 11], ['bunBottom', 14]] },
      { col: 16, items: [['bunTop', 5], ['patty', 8], ['lettuce', 14], ['bunBottom', 17]] },
      { col: 23, items: [['bunTop', 2], ['cheese', 5], ['patty', 11], ['bunBottom', 14]] },
    ],
    spawns: [[2, 0], [2, 27], [8, 0], [8, 27], [11, 0], [11, 27]],
    playerStart: [17, 15],
    enemies: ['meatball', 'onion', 'chili', 'onion'],
  },
];
