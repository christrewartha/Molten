// Axis-aligned ellipse vs rotated polygon.
//
// Scale space so the ellipse becomes a unit circle. The polygon stays a
// polygon under that scale, so a circle-vs-polygon test is exact.

export function ellipseHitsPolygon(ex, ey, rx, ry, outline, px, py, size, rotation) {
  const c = Math.cos(rotation)
  const s = Math.sin(rotation)
  const n = outline.length
  const xs = new Array(n)
  const ys = new Array(n)
  for (let i = 0; i < n; i++) {
    const lx = outline[i][0] * size
    const ly = outline[i][1] * size
    xs[i] = (px + lx * c - ly * s - ex) / rx
    ys[i] = (py + lx * s + ly * c - ey) / ry
  }

  // Circle centre (origin) inside the polygon?
  let inside = false
  for (let i = 0, j = n - 1; i < n; j = i++) {
    if ((ys[i] > 0) !== (ys[j] > 0) && 0 < ((xs[j] - xs[i]) * -ys[i]) / (ys[j] - ys[i]) + xs[i]) {
      inside = !inside
    }
  }
  if (inside) return true

  // Any edge closer than radius 1?
  for (let i = 0, j = n - 1; i < n; j = i++) {
    if (segmentDistSq(xs[j], ys[j], xs[i], ys[i]) < 1) return true
  }
  return false
}

// Squared distance from origin to segment a-b.
function segmentDistSq(ax, ay, bx, by) {
  const dx = bx - ax
  const dy = by - ay
  const lenSq = dx * dx + dy * dy
  let t = lenSq > 0 ? -(ax * dx + ay * dy) / lenSq : 0
  t = Math.max(0, Math.min(1, t))
  const cx = ax + dx * t
  const cy = ay + dy * t
  return cx * cx + cy * cy
}
