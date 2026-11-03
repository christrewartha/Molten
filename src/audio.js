// Generative trip-hop, built from Web Audio nodes only. No samples.
//
// 80 BPM, D minor, two bars per chord. Drums are swung and lo-fi. Layers
// come in as the run goes on. Sound effects use the same instruments and
// the current chord, so they sit inside the music.

const BPM = 80
const STEP = 60 / BPM / 4 // one 16th note
const SWING = 0.28 * STEP // delay on odd 16ths
const LOOKAHEAD = 0.12

const midiToHz = (m) => 440 * Math.pow(2, (m - 69) / 12)
const rand = (a, b) => a + Math.random() * (b - a)
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]

// D minor progression: Dm9 – Bbmaj7 – Gm9 – Am7
const CHORDS = [
  { bass: 38, notes: [53, 57, 60, 64] },
  { bass: 46, notes: [53, 57, 62, 65] },
  { bass: 43, notes: [58, 62, 65, 69] },
  { bass: 45, notes: [52, 55, 60, 64] },
]
const PENTATONIC = [62, 65, 67, 69, 72, 74, 77, 79, 81] // D minor pentatonic, high

const KICK_PATTERNS = [
  [0, 10],
  [0, 7, 10],
  [0, 3, 10],
  [0, 10, 11],
]

export class Music {
  constructor() {
    this.ctx = null
    this.muted = false
    this.layers = { drums: false, hats: false, melody: false }
  }

  // Must be called from a user gesture (browser autoplay rules). If audio
  // cannot start on this device, the game carries on without sound.
  start() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {})
      return
    }
    if (this.failed) return
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (!AudioCtx) {
      this.failed = true
      return
    }
    try {
      this.init(new AudioCtx())
    } catch (err) {
      console.warn('Audio disabled:', err)
      clearInterval(this.timer)
      this.ctx?.close?.()
      this.ctx = null
      this.failed = true
    }
  }

  init(ctx) {
    this.ctx = ctx

    this.master = ctx.createGain()
    this.master.gain.value = this.muted ? 0 : 0.8
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -18
    comp.ratio.value = 3
    this.master.connect(comp).connect(ctx.destination)

    // Music goes through a low-pass so we can muffle it on game over.
    this.musicFilter = ctx.createBiquadFilter()
    this.musicFilter.type = 'lowpass'
    this.musicFilter.frequency.value = 18000
    this.musicFilter.connect(this.master)

    this.reverb = ctx.createConvolver()
    this.reverb.buffer = makeImpulse(ctx, 3.2, 2.5)
    const reverbOut = ctx.createGain()
    reverbOut.gain.value = 0.55
    this.reverb.connect(reverbOut).connect(this.musicFilter)

    this.delay = ctx.createDelay(2)
    this.delay.delayTime.value = STEP * 3 // dotted 8th
    const fb = ctx.createGain()
    fb.gain.value = 0.38
    const delayTone = ctx.createBiquadFilter()
    delayTone.type = 'lowpass'
    delayTone.frequency.value = 2200
    this.delay.connect(delayTone).connect(fb).connect(this.delay)
    delayTone.connect(this.musicFilter)
    delayTone.connect(this.reverb)

    // Drum bus: darker, a bit lo-fi.
    this.drumBus = ctx.createBiquadFilter()
    this.drumBus.type = 'lowpass'
    this.drumBus.frequency.value = 4500
    this.drumBus.connect(this.musicFilter)

    // Keys bus with slow tremolo.
    this.keysBus = ctx.createGain()
    this.keysBus.gain.value = 0.85
    const trem = ctx.createOscillator()
    trem.frequency.value = 3.2
    const tremDepth = ctx.createGain()
    tremDepth.gain.value = 0.15
    trem.connect(tremDepth).connect(this.keysBus.gain)
    trem.start()
    this.keysBus.connect(this.musicFilter)
    const keysSend = ctx.createGain()
    keysSend.gain.value = 0.35
    this.keysBus.connect(keysSend).connect(this.reverb)

    // Effects skip the muffle filter so they stay clear on game over.
    this.sfxBus = ctx.createGain()
    this.sfxBus.gain.value = 0.9
    this.sfxBus.connect(this.master)
    const sfxSend = ctx.createGain()
    sfxSend.gain.value = 0.5
    this.sfxBus.connect(sfxSend).connect(this.reverb)

    this.noise = makeNoise(ctx, 2)
    this.startCrackle()

    this.step = 0
    this.bar = 0
    this.nextTime = ctx.currentTime + 0.1
    this.origin = this.nextTime
    this.kickPattern = KICK_PATTERNS[0]
    this.timer = setInterval(() => this.schedule(), 25)
  }

  setMuted(muted) {
    this.muted = muted
    if (this.master) this.master.gain.setTargetAtTime(muted ? 0 : 0.8, this.ctx.currentTime, 0.1)
  }

  // intensity: survival time in seconds, used to add layers.
  setIntensity(t) {
    this.layers.drums = true
    this.layers.hats = t > 20
    this.layers.melody = t > 60
  }

  muffle(on) {
    if (!this.ctx) return
    const f = this.musicFilter.frequency
    const now = this.ctx.currentTime
    f.cancelScheduledValues(now)
    f.setValueAtTime(f.value, now)
    f.exponentialRampToValueAtTime(on ? 500 : 18000, now + (on ? 1.5 : 1.0))
    if (on) this.layers = { drums: false, hats: false, melody: false }
  }

  // Beats since the music started, as heard (allows for output latency).
  // Null before the music starts.
  get beat() {
    if (!this.ctx) return null
    const heard = this.ctx.currentTime - (this.ctx.outputLatency || this.ctx.baseLatency || 0)
    return (heard - this.origin) / (STEP * 4)
  }

  get chord() {
    return CHORDS[Math.floor(this.bar / 2) % CHORDS.length]
  }

  // ---- scheduler ----

  schedule() {
    const ctx = this.ctx
    while (this.nextTime < ctx.currentTime + LOOKAHEAD) {
      const t = this.nextTime + (this.step % 2 === 1 ? SWING : 0)
      this.playStep(this.step, t)
      this.nextTime += STEP
      this.step++
      if (this.step === 16) {
        this.step = 0
        this.bar++
        if (Math.random() < 0.35) this.kickPattern = pick(KICK_PATTERNS)
      }
    }
  }

  playStep(step, t) {
    const chord = this.chord
    const chordStart = this.bar % 2 === 0 && step === 0

    // Pad and keys always play; they are the bed of the track.
    if (chordStart) {
      this.pad(chord.notes, t, STEP * 32)
      this.keys(chord.notes, t, 0.11)
    }
    if (step === 10 && Math.random() < 0.4) this.keys(chord.notes.slice(1), t, 0.06)

    if (this.layers.drums) {
      if (this.kickPattern.includes(step)) this.kick(t, step === 0 ? 1 : 0.75)
      if (step === 4 || step === 12) this.snare(t, 0.5)
      if (step === 15 && Math.random() < 0.25) this.snare(t, 0.12)
      if (step === 0) this.bass(chord.bass, t, STEP * 9)
      if (step === 10 && Math.random() < 0.6) this.bass(chord.bass + pick([0, 7, 12]), t, STEP * 4)
    }

    if (this.layers.hats) {
      if (step % 2 === 0) this.hat(t, step % 4 === 0 ? 0.11 : 0.06)
      else if (Math.random() < 0.2) this.hat(t, 0.035)
    }

    if (this.layers.melody && step % 2 === 0 && Math.random() < 0.14) {
      this.bell(pick(PENTATONIC), t, 0.05, this.delay)
    }
  }

  // ---- instruments ----

  kick(t, vel) {
    const ctx = this.ctx
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.frequency.setValueAtTime(110, t)
    o.frequency.exponentialRampToValueAtTime(44, t + 0.14)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.9 * vel, t + 0.005)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55)
    o.connect(g).connect(this.drumBus)
    o.start(t)
    o.stop(t + 0.6)
  }

  snare(t, vel) {
    const ctx = this.ctx
    const src = this.noiseSource()
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 1700
    bp.Q.value = 0.7
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(vel, t + 0.003)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28)
    src.connect(bp).connect(g)
    g.connect(this.drumBus)
    const send = ctx.createGain()
    send.gain.value = 0.6
    g.connect(send).connect(this.reverb)
    src.start(t, rand(0, 1.5))
    src.stop(t + 0.3)

    const o = ctx.createOscillator()
    const og = ctx.createGain()
    o.frequency.setValueAtTime(190, t)
    o.frequency.exponentialRampToValueAtTime(140, t + 0.08)
    og.gain.setValueAtTime(0.0001, t)
    og.gain.exponentialRampToValueAtTime(vel * 0.5, t + 0.003)
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.12)
    o.connect(og).connect(this.drumBus)
    o.start(t)
    o.stop(t + 0.15)
  }

  hat(t, vel) {
    const ctx = this.ctx
    const src = this.noiseSource()
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 7000
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(vel, t + 0.002)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05)
    src.connect(hp).connect(g).connect(this.musicFilter)
    src.start(t, rand(0, 1.5))
    src.stop(t + 0.06)
  }

  bass(midi, t, dur) {
    const ctx = this.ctx
    const f = midiToHz(midi)
    const o = ctx.createOscillator()
    o.type = 'triangle'
    o.frequency.value = f
    const sub = ctx.createOscillator()
    sub.frequency.value = f / 2
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 380
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.3, t + 0.03)
    g.gain.setTargetAtTime(0.0001, t + dur * 0.7, dur * 0.15)
    o.connect(lp)
    sub.connect(lp)
    lp.connect(g).connect(this.musicFilter)
    o.start(t)
    sub.start(t)
    o.stop(t + dur + 0.5)
    sub.stop(t + dur + 0.5)
  }

  // Rhodes-ish electric piano: sine carrier with a decaying FM modulator.
  epiano(midi, t, vel, dest = this.keysBus, dur = 2.5) {
    const ctx = this.ctx
    const f = midiToHz(midi)
    const car = ctx.createOscillator()
    car.frequency.value = f
    car.detune.value = rand(-6, 6)
    const mod = ctx.createOscillator()
    mod.frequency.value = f
    const modGain = ctx.createGain()
    modGain.gain.setValueAtTime(f * 1.4, t)
    modGain.gain.exponentialRampToValueAtTime(f * 0.08, t + 0.6)
    mod.connect(modGain).connect(car.frequency)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(vel, t + 0.008)
    g.gain.exponentialRampToValueAtTime(vel * 0.35, t + 0.5)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    car.connect(g).connect(dest)
    car.start(t)
    mod.start(t)
    car.stop(t + dur + 0.05)
    mod.stop(t + dur + 0.05)
  }

  keys(notes, t, vel) {
    notes.forEach((n, i) => this.epiano(n, t + i * 0.012, vel * rand(0.8, 1)))
  }

  pad(notes, t, dur) {
    const ctx = this.ctx
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 900
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(0.035, t + 1.5)
    g.gain.setValueAtTime(0.035, t + dur - 1.0)
    g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.5)
    lp.connect(g).connect(this.musicFilter)
    const send = ctx.createGain()
    send.gain.value = 0.5
    g.connect(send).connect(this.reverb)
    for (const n of notes) {
      for (const d of [-7, 7]) {
        const o = ctx.createOscillator()
        o.type = 'sawtooth'
        o.frequency.value = midiToHz(n - 12)
        o.detune.value = d
        o.connect(lp)
        o.start(t)
        o.stop(t + dur + 0.6)
      }
    }
  }

  // Soft bell / vibraphone tone.
  bell(midi, t, vel, send = null, dest = this.musicFilter) {
    const ctx = this.ctx
    const f = midiToHz(midi)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(vel, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2)
    g.connect(dest)
    if (send) g.connect(send)
    for (const [ratio, amp] of [[1, 1], [2.0, 0.25], [3.01, 0.08]]) {
      const o = ctx.createOscillator()
      o.frequency.value = f * ratio
      const og = ctx.createGain()
      og.gain.value = amp
      o.connect(og).connect(g)
      o.start(t)
      o.stop(t + 2.3)
    }
  }

  startCrackle() {
    const ctx = this.ctx
    const len = ctx.sampleRate * 4
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < len; i++) {
      let v = (Math.random() * 2 - 1) * 0.004 // hiss
      if (Math.random() < 0.0004) v += (Math.random() * 2 - 1) * rand(0.2, 0.7) // pop
      data[i] = v
    }
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.loop = true
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 800
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 6000
    const g = ctx.createGain()
    g.gain.value = 0.18
    src.connect(hp).connect(lp).connect(g).connect(this.musicFilter)
    src.start()
  }

  noiseSource() {
    const src = this.ctx.createBufferSource()
    src.buffer = this.noise
    return src
  }

  // ---- sound effects ----

  sfxStart() {
    if (!this.ctx) return
    const t = this.ctx.currentTime + 0.02
    this.chord.notes.forEach((n, i) => this.epiano(n + 12, t + i * 0.09, 0.09, this.sfxBus, 2))
  }

  sfxMilestone() {
    if (!this.ctx) return
    const t = this.ctx.currentTime + 0.02
    const top = this.chord.notes[this.chord.notes.length - 1] + 12
    this.bell(top, t, 0.09, this.delay, this.sfxBus)
    this.bell(top + 7, t + STEP * 2, 0.06, this.delay, this.sfxBus)
  }

  // Soft downward "whoosh" plus a low chord tone.
  sfxPush() {
    if (!this.ctx) return
    const ctx = this.ctx
    const t = ctx.currentTime + 0.01
    const src = this.noiseSource()
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.Q.value = 2
    lp.frequency.setValueAtTime(2400, t)
    lp.frequency.exponentialRampToValueAtTime(180, t + 0.7)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.04)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.8)
    src.connect(lp).connect(g).connect(this.sfxBus)
    src.start(t, rand(0, 1))
    src.stop(t + 0.85)
    const root = this.chord.bass + 12
    this.epiano(root, t, 0.1, this.sfxBus, 2)
    this.epiano(root + 7, t + 0.03, 0.07, this.sfxBus, 2)
  }

  // A charge is back: one quiet bell, higher for each charge held.
  sfxCharge(count) {
    if (!this.ctx) return
    const notes = this.chord.notes
    const n = notes[Math.min(count, notes.length - 1)] + 12
    this.bell(n, this.ctx.currentTime + 0.02, 0.045, this.delay, this.sfxBus)
  }

  sfxGameOver() {
    if (!this.ctx) return
    const t = this.ctx.currentTime + 0.02
    const root = this.chord.bass + 24
    ;[root + 7, root + 3, root].forEach((n, i) => this.epiano(n, t + i * 0.28, 0.12, this.sfxBus, 3.5))
    this.bass(this.chord.bass, t, 2.5)
  }
}

function makeNoise(ctx, seconds) {
  const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  return buf
}

function makeImpulse(ctx, seconds, decay) {
  const len = Math.floor(ctx.sampleRate * seconds)
  const buf = ctx.createBuffer(2, len, ctx.sampleRate)
  for (let c = 0; c < 2; c++) {
    const data = buf.getChannelData(c)
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay)
  }
  return buf
}
