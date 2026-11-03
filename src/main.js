import './style.css'
import * as THREE from 'three'
import { WORLD, PLAYER, MILESTONE_INTERVAL, PUSH, DIFFICULTY } from './config.js'
import { createBlob, updateBlob, blobOutline } from './shapes.js'
import { ellipseHitsPolygon } from './collision.js'
import { Director, speedAt } from './director.js'
import { createBlobField, FIELD_THRESHOLD } from './blobs.js'
import { createLamp } from './lamp.js'
import { createPlayerBlob } from './player.js'
import { Music } from './audio.js'
import { PushWave } from './pushwave.js'

// ---- DOM ----

const stage = document.getElementById('stage')
const timeEl = document.getElementById('time')
const titleEl = document.getElementById('title-screen')
const overEl = document.getElementById('over-screen')
const finalTimeEl = document.getElementById('final-time')
const againBtn = document.getElementById('again')
const chargesEl = document.getElementById('charges')
const chargeEls = [...chargesEl.children]

// ---- renderer / scene ----

let renderer
try {
  renderer = new THREE.WebGLRenderer({ antialias: true })
} catch (err) {
  // Shown on screen by the error handler in index.html.
  throw new Error(`molten needs WebGL 2, and this browser could not start it. (${err.message})`)
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
stage.prepend(renderer.domElement)

const scene = new THREE.Scene()
const camera = new THREE.OrthographicCamera(-WORLD.halfW, WORLD.halfW, WORLD.halfH, -WORLD.halfH, -10, 10)

const blobField = createBlobField(DIFFICULTY.maxShapes)
const lamp = createLamp(blobField.target.texture)
lamp.material.uniforms.uWaveRadius.value = PUSH.radius
scene.add(lamp)

// Fit a 9:16 box inside the window. The space around it is the "desk".
// The wax field renders at half resolution; it is smooth, so that is enough.
function resize() {
  const aspect = WORLD.width / WORLD.height
  let w = window.innerWidth
  let h = window.innerHeight
  if (w / h > aspect) w = h * aspect
  else h = w / aspect
  stage.style.width = `${w}px`
  stage.style.height = `${h}px`
  stage.style.fontSize = `${h / 40}px`
  renderer.setSize(w, h)
  const buf = renderer.getDrawingBufferSize(new THREE.Vector2())
  const fw = Math.ceil(buf.x / 2)
  const fh = Math.ceil(buf.y / 2)
  blobField.setSize(fw, fh)
  lamp.material.uniforms.uTexel.value.set(1 / fw, 1 / fh)
}
window.addEventListener('resize', resize)
resize()

// ---- player ----

const player = {
  x: 0,
  y: PLAYER.startY,
  vx: 0,
  vy: 0,
  // Actual movement this frame. It is 0 against a wall even if vx/vy is not.
  mvx: 0,
  mvy: 0,
  // Wax stretch (see PLAYER.deform) and its rate of change.
  dx: 0,
  dy: 0,
  dvx: 0,
  dvy: 0,
  mesh: createPlayerBlob(PLAYER.color),
}
scene.add(player.mesh)

// ---- shapes ----

const shapes = []

function spawnShape(s) {
  // pvx/pvy: extra drift from a push. It fades back to zero, so the shape
  // returns to its own constant velocity. age drives the wax wobble.
  const shape = { ...s, pvx: 0, pvy: 0, age: 0, blob: createBlob(s.type) }
  updateBlob(shape.blob, 0)
  shapes.push(shape)
}

function removeShape(i) {
  shapes.splice(i, 1)
}

function clearShapes() {
  shapes.length = 0
}

const director = new Director(spawnShape)
const pushWave = new PushWave(PUSH.waveDuration)

// ---- input ----

const keys = new Set()
const LEFT = ['KeyA', 'ArrowLeft']
const RIGHT = ['KeyD', 'ArrowRight']
const UP = ['KeyW', 'ArrowUp']
const DOWN = ['KeyS', 'ArrowDown']
// Keys that would scroll the page (itch.io runs the game in an iframe).
const NO_SCROLL = new Set(['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'])
const held = (codes) => codes.some((c) => keys.has(c))

window.addEventListener('keydown', (e) => {
  if (NO_SCROLL.has(e.code)) e.preventDefault()
  keys.add(e.code)
  if (e.code === 'KeyM') {
    music.setMuted(!music.muted)
    return
  }
  if (state === 'playing' && e.code === 'Space') {
    if (!e.repeat) tryPush()
    return
  }
  if (state === 'title') startGame()
  else if (state === 'over' && (e.code === 'Space' || e.code === 'Enter')) tryRestart()
})
window.addEventListener('keyup', (e) => keys.delete(e.code))
window.addEventListener('blur', () => {
  keys.clear()
  dragPointer = null
})

// Touch / mouse: drag anywhere to move (relative), double tap anywhere to push.
// One pointer at a time drives the drag. Drag distance waits in dragPending
// (world units) and updatePlayer() eases the player through it.
let dragPointer = null // { id, x, y, startX, startY, downAt, moved }
let dragPendingX = 0
let dragPendingY = 0
let lastTapEnd = -Infinity // performance.now() in ms, end of the last short, still tap

// Show touch hints on touch screens, or as soon as someone touches.
if (matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch')

window.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'touch') document.body.classList.add('touch')
  if (e.target === againBtn) return
  if (state === 'title') startGame() // and the same touch can drag at once
  if (dragPointer) return
  const now = performance.now()
  dragPointer = { id: e.pointerId, x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, downAt: now }
  if (state === 'playing' && now - lastTapEnd < PLAYER.doubleTap.maxGap * 1000) {
    lastTapEnd = -Infinity
    tryPush()
  }
})

// Fallback in case a browser does not send pointer events for touch.
window.addEventListener('touchstart', () => state === 'title' && startGame(), { passive: true })
window.addEventListener('click', () => state === 'title' && startGame())

window.addEventListener('pointermove', (e) => {
  if (!dragPointer || e.pointerId !== dragPointer.id) return
  if (state === 'playing') {
    const scale = (WORLD.height / stage.clientHeight) * PLAYER.drag.sensitivity
    dragPendingX += (e.clientX - dragPointer.x) * scale
    dragPendingY -= (e.clientY - dragPointer.y) * scale // screen y is down
  }
  dragPointer.x = e.clientX
  dragPointer.y = e.clientY
})

function endDrag(e) {
  if (!dragPointer || e.pointerId !== dragPointer.id) return
  const now = performance.now()
  const dt = PLAYER.doubleTap
  const moved = Math.hypot(e.clientX - dragPointer.startX, e.clientY - dragPointer.startY)
  const isTap = now - dragPointer.downAt < dt.maxTapTime * 1000 && moved < dt.maxTapMove
  lastTapEnd = isTap ? now : -Infinity
  dragPointer = null
  // iOS only lets audio start from the end of a touch, so try again here.
  if (state !== 'title') music.start()
}
window.addEventListener('pointerup', endDrag)
window.addEventListener('pointercancel', endDrag)
window.addEventListener('contextmenu', (e) => e.preventDefault())

againBtn.addEventListener('click', tryRestart)

// ---- game state ----

// Dev-only URL flags: ?god (no collisions), ?start=90 (begin at 90 s).
const params = new URLSearchParams(location.search)
const DEV_GOD = import.meta.env.DEV && params.has('god')
const DEV_START = import.meta.env.DEV ? Number(params.get('start')) || 0 : 0

const music = new Music()
let state = 'title' // title | playing | over
let runTime = 0 // seconds survived this run
let overTime = 0 // seconds since game over
let timeScale = 1
let scroll = 0
let nextMilestone = MILESTONE_INTERVAL
let charges = PUSH.maxCharges
let chargeProgress = 0 // seconds toward the next charge
let sincePush = Infinity
let killer = null // the shape that ended the run; it absorbs the player
const OVER_SCREEN_DELAY = PLAYER.absorb.duration + PLAYER.absorb.screenDelay
// The background scrolls at about the speed of an average shape.
const SCROLL_FACTOR = 0.85

function startGame() {
  music.start()
  music.muffle(false)
  music.sfxStart()
  titleEl.classList.add('hidden')
  resetRun()
}

function tryRestart() {
  if (overTime < OVER_SCREEN_DELAY + 0.1) return // stop an accidental instant restart
  overEl.classList.add('hidden')
  music.muffle(false)
  music.sfxStart()
  resetRun()
}

function resetRun() {
  clearShapes()
  director.reset()
  player.x = 0
  player.y = PLAYER.startY
  player.vx = player.vy = player.mvx = player.mvy = 0
  dragPendingX = dragPendingY = 0
  lastTapEnd = -Infinity
  player.dx = player.dy = player.dvx = player.dvy = 0
  player.mesh.material.uniforms.uFade.value = 1
  killer = null
  runTime = DEV_START
  timeScale = 1
  nextMilestone = (Math.floor(runTime / MILESTONE_INTERVAL) + 1) * MILESTONE_INTERVAL
  charges = PUSH.maxCharges
  chargeProgress = 0
  sincePush = Infinity
  timeEl.classList.remove('hidden')
  chargesEl.classList.remove('hidden')
  state = 'playing'
}

function gameOver(hit) {
  state = 'over'
  killer = hit
  killer.size0 = killer.size
  overTime = 0
  music.muffle(true)
  music.sfxGameOver()
  finalTimeEl.textContent = formatTime(runTime)
  timeEl.classList.add('hidden')
  chargesEl.classList.add('hidden')
  setTimeout(() => state === 'over' && overEl.classList.remove('hidden'), OVER_SCREEN_DELAY * 1000)
}

function formatTime(t) {
  return `${Math.floor(t)}`
}

// 0..1 pulse on each beat of the music, stronger on the first beat of a bar.
// Falls back to one pulse per second if the music has not started.
function beatPulse() {
  const b = music.beat
  if (b == null || b < 0) return Math.exp(-(runTime % 1) * 7)
  const downbeat = Math.floor(b) % 4 === 0
  return Math.exp(-(b - Math.floor(b)) * 7) * (downbeat ? 1 : 0.5)
}

// ---- push ----

function tryPush() {
  if (charges === 0 || sincePush < PUSH.minInterval) return
  charges--
  chargeProgress = 0
  sincePush = 0
  pushWave.fire(player.x, player.y)
  music.sfxPush()
  for (const s of shapes) {
    const dx = s.x - player.x
    const dy = s.y - player.y
    const dist = Math.hypot(dx, dy) || 0.001
    const gap = Math.max(0, dist - s.size) // distance to the shape's edge
    if (gap > PUSH.radius) continue
    const falloff = 1 - gap / PUSH.radius
    const heavy = Math.min(1, 1 / Math.sqrt(s.size)) // big shapes move less
    const v = PUSH.strength * falloff * heavy
    s.pvx += (dx / dist) * v
    s.pvy += (dy / dist) * v
  }
}

// The next charge takes longer the more charges the player already has.
function updateCharges(dt) {
  sincePush += dt
  if (charges >= PUSH.maxCharges) return
  chargeProgress += dt
  if (chargeProgress >= PUSH.recharge[charges]) {
    chargeProgress = 0
    charges++
    music.sfxCharge(charges)
  }
}

function renderCharges() {
  chargeEls.forEach((el, i) => {
    let fill = 0
    if (i < charges) fill = 1
    else if (i === charges) fill = chargeProgress / PUSH.recharge[charges]
    el.style.setProperty('--fill', `${(fill * 100).toFixed(1)}%`)
    el.classList.toggle('ready', i < charges)
  })
}

// ---- update ----

function updatePlayer(dt) {
  let ix = 0
  let iy = 0
  if (held(LEFT)) ix -= 1
  if (held(RIGHT)) ix += 1
  if (held(UP)) iy += 1
  if (held(DOWN)) iy -= 1
  const len = Math.hypot(ix, iy)
  if (len > 0) {
    ix /= len
    iy /= len
  }
  // Ease velocity toward the input for a soft, floaty feel.
  const k = 1 - Math.exp(-PLAYER.response * dt)
  player.vx += (ix * PLAYER.speed - player.vx) * k
  player.vy += (iy * PLAYER.speed - player.vy) * k
  const px = player.x
  const py = player.y
  player.x += player.vx * dt
  player.y += player.vy * dt
  // Drag moves the player directly. Easing it through the pending distance
  // smooths out finger jitter. Drag past an edge is lost, not saved up.
  const kd = 1 - Math.exp(-PLAYER.drag.response * dt)
  player.x += dragPendingX * kd
  player.y += dragPendingY * kd
  dragPendingX -= dragPendingX * kd
  dragPendingY -= dragPendingY * kd
  player.x = Math.max(-WORLD.halfW + PLAYER.radiusX, Math.min(WORLD.halfW - PLAYER.radiusX, player.x))
  player.y = Math.max(-WORLD.halfH + PLAYER.radiusY, Math.min(WORLD.halfH - PLAYER.radiusY, player.y))

  // The wax lags behind changes in movement. Using the actual movement means
  // the blob also splats a little when it stops against a wall.
  const mvx = (player.x - px) / dt
  const mvy = (player.y - py) / dt
  const def = PLAYER.deform
  const tx = -(mvx - player.mvx) / dt * def.gain
  const ty = -(mvy - player.mvy) / dt * def.gain
  player.mvx = mvx
  player.mvy = mvy
  player.dvx += ((tx - player.dx) * def.stiffness - player.dvx * def.damping) * dt
  player.dvy += ((ty - player.dy) * def.stiffness - player.dvy * def.damping) * dt
  player.dx += player.dvx * dt
  player.dy += player.dvy * dt
  const m = Math.hypot(player.dx, player.dy)
  if (m > def.max) {
    player.dx *= def.max / m
    player.dy *= def.max / m
  }
}

function updateShapes(dt) {
  for (let i = shapes.length - 1; i >= 0; i--) {
    const s = shapes[i]
    s.x += (s.vx + s.pvx) * dt
    s.y += (s.vy + s.pvy) * dt
    const fade = Math.exp(-PUSH.decay * dt)
    s.pvx *= fade
    s.pvy *= fade
    s.rot += s.spin * dt
    s.age += dt
    updateBlob(s.blob, s.age)
    const mx = WORLD.halfW + Math.max(4, s.size + 1)
    const my = WORLD.halfH + Math.max(5, s.size + 1)
    if (Math.abs(s.x) > mx || Math.abs(s.y) > my) removeShape(i)
  }
}

function checkCollisions() {
  const rx = PLAYER.radiusX * PLAYER.hitScale
  const ry = PLAYER.radiusY * PLAYER.hitScale
  for (const s of shapes) {
    const dx = s.x - player.x
    const dy = s.y - player.y
    const reach = s.size + ry
    if (dx * dx + dy * dy > reach * reach) continue
    if (ellipseHitsPolygon(player.x, player.y, rx, ry, blobOutline(s.blob), s.x, s.y, s.size, s.rot)) return s
  }
  return null
}

// Game over: the player stretches toward the blob that hit it, is drawn into
// its centre and shrinks away. The blob swells a little as it takes it in.
// Returns the player's size (1 = normal, 0 = gone).
function updateAbsorb(dt) {
  const ab = PLAYER.absorb
  const a = Math.min(1, overTime / ab.duration)
  const ease = a * a * (3 - 2 * a)
  const tx = killer.x - player.x
  const ty = killer.y - player.y
  const k = 1 - Math.exp(-ab.pull * (0.3 + a) * dt)
  player.x += tx * k
  player.y += ty * k
  const dist = Math.hypot(tx, ty)
  const s = dist > 1e-3 ? (ab.stretch * (1 - a)) / dist : 0
  const kd = 1 - Math.exp(-8 * dt)
  player.dx += (tx * s - player.dx) * kd
  player.dy += (ty * s - player.dy) * kd
  killer.size = killer.size0 * (1 + ab.swell * ease)
  player.mesh.material.uniforms.uFade.value = 1 - Math.max(0, (a - 0.3) / 0.7) ** 2
  return 1 - ease
}

function update(dt, elapsed) {
  let playerScale = 1
  if (state === 'playing') {
    runTime += dt
    music.setIntensity(runTime)
    updatePlayer(dt)
    updateCharges(dt)
    director.update(runTime, player, shapes.length)
    updateShapes(dt)
    if (runTime >= nextMilestone) {
      music.sfxMilestone()
      nextMilestone += MILESTONE_INTERVAL
    }
    const hit = DEV_GOD ? null : checkCollisions()
    if (hit) gameOver(hit)
    timeEl.textContent = formatTime(runTime)
    scroll += speedAt(runTime) * SCROLL_FACTOR * dt
  } else if (state === 'over') {
    overTime += dt
    // Everything drifts on, slower, while the blob absorbs the player.
    timeScale += (0.3 - timeScale) * (1 - Math.exp(-2 * dt))
    updateShapes(dt * timeScale)
    playerScale = updateAbsorb(dt)
    scroll += speedAt(runTime) * SCROLL_FACTOR * dt * timeScale
  } else {
    scroll += speedAt(0) * SCROLL_FACTOR * dt
  }

  // Sync meshes.
  const breathe = 1 + 0.025 * Math.sin(elapsed * 1.6)
  const pu = player.mesh.material.uniforms
  player.mesh.position.set(player.x, player.y, 0)
  player.mesh.visible = state !== 'title'
  const prx = Math.max(1e-3, PLAYER.radiusX * breathe * playerScale)
  const pry = Math.max(1e-3, PLAYER.radiusY * breathe * playerScale)
  pu.uRadii.value.set(prx, pry)
  pu.uDeform.value.set(player.dx, player.dy)
  pu.uTime.value = elapsed
  blobField.sync(shapes)
  pushWave.update(dt)
  renderCharges()

  const pulse = beatPulse()
  timeEl.style.transform = `scale(${1 + 0.15 * pulse})`
  timeEl.style.opacity = 0.5 + 0.3 * pulse

  const u = lamp.material.uniforms
  u.uTime.value = elapsed
  u.uScroll.value = scroll
  u.uWave.value.set(pushWave.x, pushWave.y, pushWave.progress)
  const shown = player.mesh.visible ? pu.uFade.value * playerScale : 0
  u.uPlayer.value.set(player.x, player.y, shown)
  u.uPlayerShape.value.set(prx, pry, shown > 0 ? PLAYER.merge.strength * FIELD_THRESHOLD : 0)
  u.uPlayerVel.value.set(player.mvx, player.mvy)
}

// ---- loop ----

const timer = new THREE.Timer()
renderer.setAnimationLoop((timestamp) => {
  timer.update(timestamp)
  const dt = Math.min(timer.getDelta(), 1 / 20)
  update(dt, timer.getElapsed())
  blobField.render(renderer, camera)
  renderer.render(scene, camera)
  window.__diag.frames++ // for ?diag (see index.html)
  window.__diag.state = state
})

window.__diag.loaded = true // for ?diag (see index.html)
