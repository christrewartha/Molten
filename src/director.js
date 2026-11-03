// Decides which patterns to send and when.
//
// Every shape gets a start position (off screen), start time, velocity,
// spin, type, size and colour. After that it never changes course, so all
// patterns are built only from those start values.
import { WORLD, DIFFICULTY, PATTERNS, PALETTES, PALETTE_SHIFT, OPENING_PATTERN } from './config.js'
import { SHAPE_TYPES, getShapeDef } from './shapes.js'

const rand = (a, b) => a + Math.random() * (b - a)
const randInt = (a, b) => Math.floor(rand(a, b + 1))
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]

function smoothstep(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

export function speedAt(t) {
  const mul = Math.min(DIFFICULTY.maxSpeedMul, 1 + DIFFICULTY.speedGrowth * (t / 60))
  return DIFFICULTY.baseSpeed * mul
}

export function gapAt(t) {
  return Math.max(DIFFICULTY.minGap, DIFFICULTY.baseGap / (1 + DIFFICULTY.gapShrink * (t / 60)))
}

function pickColor(t) {
  const jewelChance = smoothstep(PALETTE_SHIFT.start, PALETTE_SHIFT.end, t)
  return pick(Math.random() < jewelChance ? PALETTES.jewel : PALETTES.rich)
}

// Mostly small, sometimes big. Higher skew = rarer big ones.
function sizeRoll(min, max, skew = 2.2) {
  return min + (max - min) * Math.pow(Math.random(), skew)
}

function randomSpin() {
  return rand(0.2, 1.0) * (Math.random() < 0.5 ? -1 : 1)
}

// Base size -> final circumradius in world units.
function look(t, baseSize, type = pick(SHAPE_TYPES)) {
  return { type, size: baseSize * getShapeDef(type).visualScale, palette: pickColor(t) }
}

function spec(l, x, y, vx, vy, delay = 0) {
  return { delay, type: l.type, size: l.size, palette: l.palette, x, y, vx, vy, rot: rand(0, Math.PI * 2), spin: randomSpin() }
}

const top = (size) => WORLD.halfH + size + 0.2

// Each pattern returns a list of spawn specs with delays (seconds).
const BUILDERS = {
  single(t) {
    const l = look(t, sizeRoll(0.6, 1.9))
    const x0 = rand(-3.8, 3.8)
    const y0 = top(l.size)
    const tx = rand(-3.5, 3.5)
    const [dx, dy] = norm(tx - x0, -WORLD.halfH - y0)
    const v = speedAt(t) * rand(0.85, 1.15)
    return [spec(l, x0, y0, dx * v, dy * v)]
  },

  stream(t) {
    const l = look(t, sizeRoll(0.55, 1.2))
    const x0 = rand(-3.8, 3.8)
    const y0 = top(l.size)
    const tx = rand(-3.5, 3.5)
    const [dx, dy] = norm(tx - x0, -WORLD.halfH - y0)
    const v = speedAt(t)
    const count = randInt(3, 5)
    const out = []
    for (let i = 0; i < count; i++) out.push(spec(l, x0, y0, dx * v, dy * v, i * 0.55))
    return out
  },

  fan(t, player) {
    const l = look(t, sizeRoll(0.5, 1.0))
    const ox = rand(-3, 3)
    const oy = WORLD.halfH + 1.2
    const aim = Math.atan2(player.y - oy, player.x + rand(-1.5, 1.5) - ox)
    const count = randInt(3, 6)
    const spread = 0.9
    const v = speedAt(t) * 0.9
    const out = []
    for (let i = 0; i < count; i++) {
      const a = aim - spread / 2 + (spread * i) / (count - 1)
      out.push(spec(l, ox, oy, Math.cos(a) * v, Math.sin(a) * v))
    }
    return out
  },

  side(t) {
    const l = look(t, sizeRoll(0.6, 1.4))
    const side = Math.random() < 0.5 ? -1 : 1
    const x0 = side * (WORLD.halfW + l.size + 0.2)
    const y0 = rand(1, 7)
    const a = rand(0.35, 0.8)
    const v = speedAt(t) * 0.9
    const count = randInt(2, 4)
    const out = []
    for (let i = 0; i < count; i++) out.push(spec(l, x0, y0, -side * Math.cos(a) * v, -Math.sin(a) * v, i * 0.7))
    return out
  },

  // One very large, slow shape. It always leaves a clear lane on one side.
  // While an earlier giant is still on screen, the new one keeps its lane
  // on the same side, so two giants never close both sides.
  giant(t, player, dir) {
    const l = look(t, rand(2.0, 3.4))
    const side = t < dir.giantClearAt ? dir.giantSide : Math.random() < 0.5 ? -1 : 1
    const lane = rand(1.8, 3.0)
    const x0 = side * (-WORLD.halfW + lane + l.size)
    const v = speedAt(t) * rand(0.45, 0.6)
    dir.giantSide = side
    dir.giantClearAt = Math.max(dir.giantClearAt, t + (WORLD.height + 2 * l.size + 0.4) / v)
    const s = spec(l, x0, top(l.size), rand(-0.15, 0.15), -v)
    s.spin = rand(0.05, 0.2) * (Math.random() < 0.5 ? -1 : 1)
    return [s]
  },

  wall(t) {
    const l = look(t, 0.65)
    const slotW = 1.25
    const slots = Math.floor(WORLD.width / slotW)
    const gap = randInt(0, slots - 2) // two adjacent slots are left open
    const startX = -((slots - 1) * slotW) / 2
    const v = speedAt(t) * 0.75
    const out = []
    for (let i = 0; i < slots; i++) {
      if (i === gap || i === gap + 1) continue
      out.push(spec(l, startX + i * slotW, top(l.size), 0, -v))
    }
    return out
  },

  ring(t) {
    const l = look(t, 0.6)
    const cx = rand(-2.5, 2.5)
    const cy = WORLD.halfH + 2.5
    const count = 14
    const phase = rand(0, Math.PI * 2)
    const v = speedAt(t) * 0.9
    const out = []
    for (let i = 0; i < count; i++) {
      const a = phase + (i / count) * Math.PI * 2
      const dx = Math.cos(a)
      const dy = Math.sin(a)
      if (dy > -0.45) continue // would never reach the screen
      out.push(spec(l, cx + dx * 0.8, cy + dy * 0.8, dx * v, dy * v))
    }
    return out
  },

  spiral(t) {
    const l = look(t, 0.55)
    const ex = rand(-2, 2)
    const ey = WORLD.halfH + 1.0
    const count = randInt(16, 22)
    const phase = rand(0, Math.PI * 2)
    const v = speedAt(t) * 0.9
    const out = []
    for (let i = 0; i < count; i++) {
      const a = -Math.PI / 2 + 0.9 * Math.sin(phase + i * 0.45)
      out.push(spec(l, ex, ey, Math.cos(a) * v, Math.sin(a) * v, i * 0.18))
    }
    return out
  },
}

function weightAt(p, t) {
  if (!p.early) return p.weight
  const k = Math.min(1, t / p.early.until)
  return p.early.weight + (p.weight - p.early.weight) * k
}

function norm(x, y) {
  const len = Math.hypot(x, y) || 1
  return [x / len, y / len]
}

export class Director {
  constructor(spawn) {
    this.spawn = spawn
    this.reset()
  }

  reset() {
    this.queue = []
    this.nextPattern = 1.0 // short quiet moment at the start
    this.lastUsed = {}
    this.opening = OPENING_PATTERN
    this.giantSide = 1
    this.giantClearAt = -Infinity // time the last giant leaves the screen
  }

  update(t, player, shapeCount) {
    if (t >= this.nextPattern) {
      const name = this.opening ?? this.choosePattern(t)
      this.opening = null
      this.lastUsed[name] = t
      const specs = BUILDERS[name](t, player, this)
      let longest = 0
      for (const s of specs) {
        this.queue.push({ at: t + s.delay, spec: s })
        longest = Math.max(longest, s.delay)
      }
      this.nextPattern = t + gapAt(t) + longest * 0.3
    }

    let count = shapeCount
    for (let i = this.queue.length - 1; i >= 0; i--) {
      if (this.queue[i].at <= t) {
        if (count < DIFFICULTY.maxShapes) {
          this.spawn(this.queue[i].spec)
          count++
        }
        this.queue.splice(i, 1)
      }
    }
  }

  choosePattern(t) {
    // Cooldowns stop two walls (or two giants) from overlapping and
    // closing each other's gaps.
    const available = Object.entries(PATTERNS).filter(
      ([name, p]) => t >= p.unlock && !(p.cooldown && t - (this.lastUsed[name] ?? -Infinity) < p.cooldown),
    )
    const weights = available.map(([, p]) => weightAt(p, t))
    const total = weights.reduce((sum, w) => sum + w, 0)
    let r = Math.random() * total
    for (let i = 0; i < available.length; i++) {
      r -= weights[i]
      if (r <= 0) return available[i][0]
    }
    return available[0][0]
  }
}
