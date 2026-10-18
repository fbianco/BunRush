// ---------------------------------------------------------------------------
// Bun Rush - global constants
// Every "magic number" of the game lives here so it can be tuned in one place.
// ---------------------------------------------------------------------------

// Logical resolution. The canvas is scaled to the window, but all game code
// works in these fixed units (pixels of a 960x720 virtual screen).
export const VIEW_W = 960;
export const VIEW_H = 720;

// The level is a grid of 28 x 21 tiles of 32 px, drawn below a 40 px HUD bar.
export const TILE = 32;
export const COLS = 28;
export const ROWS = 21;
export const LEVEL_X = 32;   // screen offset of the level grid
export const LEVEL_Y = 40;

export const FLOOR_THICK = 8;          // girder thickness in px
export const PLATE_Y = 654;            // level-space y of the plates' surface
export const INGREDIENT_W = 4 * TILE;  // every ingredient spans 4 tiles

// Height (px) of each ingredient type - used for drawing and plate stacking.
export const INGREDIENT_H = {
  bunTop: 20,
  lettuce: 9,
  cheese: 7,
  tomato: 9,
  patty: 13,
  bunBottom: 12,
};

// Gameplay tuning
export const PLAYER_SPEED = 120;       // px / s on floors
export const CLIMB_SPEED = 96;         // px / s on ladders
export const LADDER_GRAB = 18;         // how far (px) from a ladder you can grab it
export const LADDER_ASSIST = 56;       // "hands up" walks you to a ladder this close
// Body control moves the chef "ladder to ladder" so camera lag does not matter:
export const LADDER_PAUSE = 0.6;       // s a still-held gesture waits at a ladder before going on
export const PEPPER_CANCELS_WALK = 0.4; // s: a walk started this recently is undone by pepper
export const ENEMY_BASE_SPEED = 64;
export const ENEMY_SPEED_PER_LEVEL = 7;
export const START_LIVES = 3;
export const START_PEPPER = 5;
export const PEPPER_DURATION = 0.65;   // s a pepper cloud stays dangerous
export const STUN_TIME = 3.2;          // s an enemy stays dizzy
export const GRAVITY = 1600;           // px / s^2 for falling ingredients
export const MAX_FALL_SPEED = 720;

// Level-space helpers --------------------------------------------------------
// y of the walking surface of floor row r (feet of characters stand here)
export const surfaceY = (r) => (r + 1) * TILE;
// y at which an ingredient rests on floor row r (slightly sunk into the girder)
export const restY = (r) => surfaceY(r) + 2;
// x of the centre of column c
export const colCenter = (c) => c * TILE + TILE / 2;

// Webcam gesture tuning. Distances are expressed in "shoulder widths" so they
// work whether you stand 1.5 m or 3 m away from the camera.
export const GESTURE = {
  smoothing: 0.6,          // weight of the newest sample in the moving average
  calibrationSeconds: 1.5, // how long to stand still while calibrating
  armOut: 1.0,             // wrist this far sideways from its shoulder = arm stretched...
  armOutExit: 0.75,        // ...and the (smaller) distance that ends it (hysteresis)
  armLevel: 0.8,           // stretched arm: wrist at most this far above / below the shoulder
  armHold: 0.1,            // s an arm must stay stretched (ignores arms swinging past)
  pepperReach: 0.25,       // both wrists this far past the body centre, same side = pepper
  pepperCooldown: 0.6,     // s between two pepper throws
  crouchEnter: 0.42,       // shoulders this much lower than normal = "down"
  crouchExit: 0.28,
  baselineFollow: 0.02,    // slow re-centring of the standing height
  scaleFollow: 0.01,       // slow adaptation when you walk closer / farther
  minVisibility: 0.5,
  handsUpToStart: 1.0,     // s with both hands up to start a game
};

export const FONT = '"Press Start 2P", "Courier New", monospace';
export const GAME_TITLE = 'BUN RUSH';
export const STUDIO = "Bianco's Labs";
