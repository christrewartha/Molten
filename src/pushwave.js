// State of the visible push wave. The lamp shader (lamp.js) draws it as a
// ripple that grows from the player and fades.
export class PushWave {
  constructor(duration) {
    this.duration = duration
    this.x = 0
    this.y = 0
    this.age = duration
  }

  fire(x, y) {
    this.x = x
    this.y = y
    this.age = 0
  }

  update(dt) {
    this.age = Math.min(this.duration, this.age + dt)
  }

  // 0 at the start, 1 when idle.
  get progress() {
    return this.age / this.duration
  }
}
