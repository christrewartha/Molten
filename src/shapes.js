// Wax blob types. Each outline is a radial function that changes over time:
//
//   R(θ) = 1 + Σ A_k · cos(kθ + φ_k),   k = 2, 3, 4, 5
//
// A_k slowly swells and shrinks, and φ_k slowly drifts, so the blob wobbles
// like warm wax. R is divided by its largest possible value, so the blob
// never goes outside radius 1 (the circumradius).
//
// The same function is used by the blob shader (blobs.js) and by the
// collision outline, so what you see is what you hit.
import { BLOB } from './config.js'

const rand = (a, b) => a + Math.random() * (b - a)
const sign = () => (Math.random() < 0.5 ? -1 : 1)
const sum = (arr) => arr.reduce((s, v) => s + v, 0)

// Base amplitudes for k = 2, 3, 4, 5. The dominant term gives each type its
// silhouette: 2 lobes = bean, 3 = trefoil, and so on.
const TYPES = {
  round:   [0.03, 0.02, 0, 0],
  bean:    [0.16, 0.04, 0, 0],
  trefoil: [0.03, 0.13, 0.02, 0],
  clover:  [0.02, 0.02, 0.09, 0],
  flower:  [0.02, 0, 0.02, 0.08],
  lump:    [0.08, 0.06, 0.03, 0.02],
}

const wobbleOf = (base) => base.map((a) => BLOB.wobble + BLOB.wobbleScale * a)

// visualScale evens out how big each type looks at the same size value:
// the average radius is BLOB.meanRadius × size for every type.
const DEFS = Object.fromEntries(
  Object.entries(TYPES).map(([type, base]) => {
    const norm = 1 + sum(base) + sum(wobbleOf(base))
    return [type, { base, norm, visualScale: BLOB.meanRadius * norm }]
  }),
)

export const SHAPE_TYPES = Object.keys(DEFS)

export function getShapeDef(type) {
  return DEFS[type]
}

// Per-shape animation state. Call updateBlob() each frame before reading
// amps / phases / baseR.
export function createBlob(type) {
  const { base, norm } = DEFS[type]
  return {
    base,
    norm,
    wob: wobbleOf(base),
    phase0: base.map(() => rand(0, Math.PI * 2)),
    phaseSpeed: base.map(() => rand(BLOB.drift[0], BLOB.drift[1]) * sign()),
    ampSpeed: base.map(() => rand(BLOB.swell[0], BLOB.swell[1])),
    ampPhase: base.map(() => rand(0, Math.PI * 2)),
    baseR: 1 / norm,
    amps: new Float32Array(4),
    phases: new Float32Array(4),
  }
}

export function updateBlob(b, age) {
  for (let i = 0; i < 4; i++) {
    b.amps[i] = (b.base[i] + b.wob[i] * Math.sin(b.ampSpeed[i] * age + b.ampPhase[i])) / b.norm
    b.phases[i] = b.phase0[i] + b.phaseSpeed[i] * age
  }
}

// Current outline as a CCW polygon with circumradius <= 1.
export function blobOutline(b, segments = 32) {
  const pts = new Array(segments)
  for (let j = 0; j < segments; j++) {
    const th = (j / segments) * Math.PI * 2
    let r = b.baseR
    for (let i = 0; i < 4; i++) r += b.amps[i] * Math.cos((i + 2) * th + b.phases[i])
    pts[j] = [Math.cos(th) * r, Math.sin(th) * r]
  }
  return pts
}
