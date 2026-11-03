// Tunable values. Keep in sync with GAME_DESIGN.md.

// Play area in world units. Origin is the centre of the screen, +y is up.
export const WORLD = {
  width: 9,
  height: 16,
  get halfW() { return this.width / 2 },
  get halfH() { return this.height / 2 },
}

export const PLAYER = {
  radiusX: 0.3,
  radiusY: 0.42,
  hitScale: 0.7,      // hit area is 70% of the visible oval
  speed: 6,           // units per second at full input
  response: 12,       // how quickly velocity follows input (higher = snappier)
  startY: -5.5,
  color: 0xfff1e0,    // pale hot wax
  // The wax lags behind when the player speeds up or slows down. A spring
  // pulls the stretch toward -acceleration × gain, so a steady speed gives
  // the normal blob, with a little jelly overshoot.
  deform: {
    gain: 0.008,      // stretch per unit/s² of acceleration
    max: 0.35,        // largest stretch (fraction of the radius)
    stiffness: 120,   // spring strength (higher = faster wobble)
    damping: 8,       // higher = less overshoot
  },
  // Touch / mouse drag: the player moves by the drag distance (relative), not
  // to the finger, so the finger never covers the player.
  drag: {
    sensitivity: 1.2, // world units moved per world unit dragged
    response: 30,     // how quickly the player catches up with the drag (higher = tighter)
  },
  // Double tap anywhere to push. The first tap must be short and still.
  doubleTap: {
    maxGap: 0.3,      // seconds from the end of the first tap to the second touch
    maxTapTime: 0.25, // seconds a tap may last
    maxTapMove: 12,   // CSS pixels a tap may move
  },
  heat: {
    radius: 0.95,     // size of the heat haze in the liquid (world units)
    wake: 0.35,       // the haze stretches behind by this × speed
  },
  // The player adds a weak wax field, so nearby blobs reach toward it and
  // bridge into it. Visual only: the hit area does not change.
  merge: {
    strength: 0.35,   // peak field as a fraction of the threshold; below 1, so the player alone never shows as wax
    reach: 2.2,       // field reach as a multiple of the player radius (higher = blobs reach from further away)
  },
  // At game over the player is drawn into the blob that hit it.
  absorb: {
    duration: 1.4,    // seconds to shrink away inside the blob
    pull: 3,          // how quickly the player is drawn to the blob centre
    stretch: 0.3,     // how much the player stretches toward the blob
    swell: 0.08,      // the blob grows by this fraction as it takes the player in
    screenDelay: 0.4, // seconds after that before the game-over screen fades in
  },
}

// Wax blobs (see shapes.js and blobs.js).
export const BLOB = {
  wobble: 0.025,       // swell amplitude that every harmonic gets
  wobbleScale: 0.35,   // extra swell, as a fraction of the type's base amplitude
  drift: [0.15, 0.45], // lobe drift speed range (radians per second)
  swell: [0.5, 1.1],   // lobe swell speed range (radians per second)
  meanRadius: 0.9,     // average radius as a fraction of the size value
  reach: 1.45,         // field reach as a multiple of the blob radius; sets how close blobs must be to merge
}

// Wax colours. Merged or overlapping blobs blend their colours.
export const PALETTES = {
  // Deep, warm and rich: the start of a run.
  rich: [
    { color: 0x9a3fe0 }, // violet
    { color: 0xc4203f }, // garnet
    { color: 0xffa21f }, // amber
    { color: 0xd23f95 }, // magenta plum
    { color: 0xe8611c }, // burnt orange
  ],
  // Brighter jewel tones for later in a run.
  jewel: [
    { color: 0xc77dff }, // orchid
    { color: 0xff5c8a }, // rose
    { color: 0xffcf4a }, // gold
    { color: 0xff8a5c }, // coral
    { color: 0x8a6bff }, // amethyst
  ],
}

// Time (seconds) over which the jewel palette fades in.
export const PALETTE_SHIFT = { start: 45, end: 120 }

export const DIFFICULTY = {
  baseSpeed: 2.0,          // shape speed at t = 0, units per second
  speedGrowth: 0.3,        // extra fraction of base speed per minute
  maxSpeedMul: 2.5,
  baseGap: 1.3,            // seconds between patterns at t = 0
  gapShrink: 1.5,          // gap = baseGap / (1 + gapShrink * minutes)
  minGap: 0.35,
  maxShapes: 120,
}

// Pattern unlock times (seconds), pick weights, and optional cooldown
// (seconds before the same pattern can be picked again). Optional early
// boost: the weight starts at early.weight and eases down to weight at
// early.until seconds.
export const PATTERNS = {
  single: { unlock: 0, weight: 3 },
  stream: { unlock: 0, weight: 2 },
  giant:  { unlock: 0, weight: 1.2, cooldown: 10, early: { weight: 3, until: 60 } },
  fan:    { unlock: 20, weight: 2 },
  side:   { unlock: 35, weight: 1.5 },
  wall:   { unlock: 50, weight: 1.2, cooldown: 4 },
  ring:   { unlock: 75, weight: 1 },
  spiral: { unlock: 100, weight: 1 },
}

// The first pattern of every run. A giant is a calm, good-looking opener.
export const OPENING_PATTERN = 'giant'

export const MILESTONE_INTERVAL = 30 // seconds between milestone chimes

// Push: the player sends out a wave that pushes nearby shapes away.
export const PUSH = {
  maxCharges: 3,
  recharge: [5, 10, 18], // seconds to get the next charge back when holding 0, 1, 2
  radius: 3.5,           // shapes whose edge is within this distance are pushed
  strength: 7,           // extra outward speed next to the player (units/s)
  decay: 2.5,            // extra speed fades by e^(-decay * t); max drift = strength / decay
  minInterval: 0.4,      // seconds between pushes
  waveDuration: 0.9,     // seconds for the ripple to reach the push radius and fade
}
