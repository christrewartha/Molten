// The lava lamp: dark liquid lit by a warm bulb at the bottom, with glass
// highlights, slowly drifting specks, and the wax from the field pass
// (blobs.js) cut at the threshold and shaded as soft glowing wax.
//
// The push ripple and the player's heat haze also live here. The ripple bends
// the liquid and the wax around a ring that grows from the player.
//
// The player also adds a weak field of its own (see PLAYER.merge). It is
// below the threshold, so it never shows as wax by itself, but next to a blob
// the fields add up: the blob reaches toward the player and bridges into it.
import * as THREE from 'three'
import { WORLD, PLAYER } from './config.js'
import { FIELD_THRESHOLD } from './blobs.js'

const vertexShader = /* glsl */ `
  varying vec2 vWorld;
  void main() {
    vWorld = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  uniform sampler2D uField;
  uniform vec2 uTexel;       // one field texel in uv
  uniform float uThreshold;
  uniform float uTime;
  uniform float uScroll;
  uniform vec2 uHalf;
  uniform vec3 uWave;        // x, y, progress (0..1, 1 = idle)
  uniform float uWaveRadius;
  uniform vec3 uPlayer;      // x, y, strength (0 = hidden)
  uniform vec2 uPlayerVel;
  uniform vec2 uHeat;        // radius, wake
  uniform vec3 uPlayerShape; // radius x, radius y, merge field strength (0 = none)
  uniform vec3 uPlayerColor;
  uniform float uMergeReach;
  varying vec2 vWorld;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }

  vec3 liquid(vec2 w) {
    vec2 uv = w / uHalf; // -1..1
    float up = uv.y * 0.5 + 0.5;
    vec3 col = mix(vec3(0.24, 0.07, 0.20), vec3(0.08, 0.04, 0.14), smoothstep(0.0, 1.0, up));

    // Warm bulb glow from below.
    vec2 b = (uv - vec2(0.0, -1.2)) * vec2(0.9, 1.5);
    col += vec3(0.50, 0.20, 0.10) * exp(-dot(b, b)) * 0.55;

    // Slow currents in the liquid.
    float y = w.y + uScroll * 0.6;
    float n = noise(vec2(w.x * 0.45, y * 0.3) + vec2(uTime * 0.03, 0.0))
            + 0.5 * noise(vec2(w.x * 0.9 - uTime * 0.05, y * 0.6));
    col *= 0.9 + 0.12 * n;

    // Specks suspended in the liquid. They scroll to show the movement.
    vec2 cellPos = vec2(w.x, w.y + uScroll) / 0.7;
    vec2 cell = floor(cellPos);
    float h = hash(cell);
    if (h > 0.72) {
      vec2 c = vec2(hash(cell + 3.1), hash(cell + 7.7)) * 0.8 + 0.1;
      float d = length(fract(cellPos) - c) * 0.7;
      col += vec3(1.0, 0.85, 0.75) * smoothstep(0.035, 0.0, d) * (0.06 + 0.1 * hash(cell + 1.3));
    }

    // Glass: soft vertical highlights and darker sides.
    col += vec3(1.0, 0.9, 1.0) * 0.045 * exp(-pow((uv.x + 0.8) / 0.05, 2.0));
    col += vec3(1.0, 0.9, 1.0) * 0.02 * exp(-pow((uv.x - 0.86) / 0.03, 2.0));
    col *= 1.0 - 0.3 * pow(abs(uv.x), 3.0);
    return col;
  }

  // Same falloff as a blob (blobs.js), on the player's oval.
  float playerField(vec2 w) {
    if (uPlayerShape.z <= 0.0) return 0.0;
    vec2 d = (w - uPlayer.xy) / uPlayerShape.xy;
    float q = max(0.0, 1.0 - dot(d, d) / (uMergeReach * uMergeReach));
    return uPlayerShape.z * q * q;
  }

  float fieldAt(vec2 uv, vec2 w) {
    return texture2D(uField, uv).a + playerField(w);
  }

  void main() {
    vec2 w = vWorld;

    // Push ripple: bend the lookup position outward around a growing ring.
    float waveLight = 0.0;
    if (uWave.z < 1.0) {
      float p = uWave.z;
      vec2 dv = w - uWave.xy;
      float dist = length(dv);
      float r = uWaveRadius * (1.0 - pow(1.0 - p, 3.0));
      float ring = exp(-pow((dist - r) / 0.4, 2.0)) * (1.0 - p);
      w -= dv / (dist + 1e-4) * ring * 0.22;
      waveLight = ring;
    }

    vec2 uv = w / (2.0 * uHalf) + 0.5;
    vec4 field = texture2D(uField, uv);
    float fp = playerField(w);
    float f = field.a + fp;
    vec3 wax = (field.rgb + uPlayerColor * fp) / max(f, 1e-4);

    // The player is hot wax of a different density. The liquid around it
    // bends a little (like a lens) and shimmers, with a short wake behind.
    // Only the liquid bends, never the hazard wax, so hazards stay where
    // they look.
    vec2 wl = w;
    float heat = 0.0;
    if (uPlayer.z > 0.0) {
      vec2 dv = w - uPlayer.xy;
      float speed = length(uPlayerVel);
      vec2 fwd = speed > 0.01 ? uPlayerVel / speed : vec2(0.0, 1.0);
      float along = dot(dv, fwd);
      float side = dot(dv, vec2(-fwd.y, fwd.x));
      if (along < 0.0) along /= 1.0 + speed * uHeat.y;
      heat = exp(-(along * along + side * side) / (uHeat.x * uHeat.x)) * uPlayer.z;
      vec2 shimmer = vec2(noise(w * 3.0 + vec2(0.0, uTime * 1.5)),
                          noise(w * 3.0 + vec2(5.2, -uTime * 1.3))) - 0.5;
      wl += shimmer * heat * 0.14 - dv * heat * 0.12;
    }

    vec3 col = liquid(wl);
    col += vec3(1.0, 0.55, 0.3) * heat * 0.05;

    // Soft glow of the wax on the liquid around it.
    // Hazard wax only, so the player's field does not glow on its own.
    float halo = smoothstep(0.0, uThreshold, field.a);
    col += wax * halo * halo * 0.2;

    // Wax body. Thickness is how far the field is over the threshold.
    float aa = fwidth(f) * 0.75 + 1e-4;
    float body = smoothstep(uThreshold - aa, uThreshold + aa, f);
    if (body > 0.0) {
      vec2 texelWorld = uTexel * 2.0 * uHalf;
      vec2 ox = vec2(uTexel.x, 0.0);
      vec2 oy = vec2(0.0, uTexel.y);
      vec2 wx = vec2(texelWorld.x, 0.0);
      vec2 wy = vec2(0.0, texelWorld.y);
      float hx = smoothstep(uThreshold, uThreshold + 0.4, fieldAt(uv + ox, w + wx))
               - smoothstep(uThreshold, uThreshold + 0.4, fieldAt(uv - ox, w - wx));
      float hy = smoothstep(uThreshold, uThreshold + 0.4, fieldAt(uv + oy, w + wy))
               - smoothstep(uThreshold, uThreshold + 0.4, fieldAt(uv - oy, w - wy));
      vec3 n = normalize(vec3(-hx / texelWorld.x, -hy / texelWorld.y, 0.0) * 0.08 + vec3(0.0, 0.0, 1.0));

      float thick = smoothstep(uThreshold, uThreshold + 0.7, f);
      vec3 c = wax * (0.6 + 0.5 * thick);              // brighter, glowing core
      float under = max(dot(n, normalize(vec3(0.0, -0.7, 0.7))), 0.0);
      c *= 0.8 + 0.35 * under;                          // lit by the bulb below
      c *= 0.92 + 0.15 * smoothstep(0.3, -1.0, w.y / uHalf.y);
      vec3 hv = normalize(normalize(vec3(-0.4, 0.6, 0.7)) + vec3(0.0, 0.0, 1.0));
      c += vec3(1.0, 0.95, 0.9) * pow(max(dot(n, hv), 0.0), 30.0) * 0.3;
      col = mix(col, c, body);
    }

    col += vec3(1.0, 0.92, 0.9) * waveLight * 0.08;

    float grain = hash(floor(gl_FragCoord.xy) + floor(uTime * 24.0)) - 0.5;
    col += grain * 0.012;

    gl_FragColor = vec4(col, 1.0);
  }
`

export function createLamp(fieldTexture) {
  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uField: { value: fieldTexture },
      uTexel: { value: new THREE.Vector2(1, 1) },
      uThreshold: { value: FIELD_THRESHOLD },
      uTime: { value: 0 },
      uScroll: { value: 0 },
      uHalf: { value: new THREE.Vector2(WORLD.halfW, WORLD.halfH) },
      uWave: { value: new THREE.Vector3(0, 0, 1) },
      uWaveRadius: { value: 1 },
      uPlayer: { value: new THREE.Vector3(0, 0, 0) },
      uPlayerVel: { value: new THREE.Vector2(0, 0) },
      uHeat: { value: new THREE.Vector2(PLAYER.heat.radius, PLAYER.heat.wake) },
      uPlayerShape: { value: new THREE.Vector3(1, 1, 0) },
      uPlayerColor: { value: new THREE.Color(PLAYER.color) },
      uMergeReach: { value: PLAYER.merge.reach },
    },
    depthTest: false,
    depthWrite: false,
  })
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.width, WORLD.height), material)
  mesh.renderOrder = -1
  return mesh
}
