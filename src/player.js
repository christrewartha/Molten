// The player: a blob of pale, hot wax. It is shaded like the hazard wax,
// with a soft rim light and glow so it stands out from them. The edge
// wobbles a little.
//
// uDeform (world units, direction × amount) bends the outline. It points
// where the wax lags behind: the blob stretches toward it with a tail and
// becomes narrower at the sides. main.js drives it with a spring from the
// acceleration, so a steady speed gives the normal blob.
//
// The mesh is not scaled. vLocal is the offset from the centre in world units.
import * as THREE from 'three'

const EXTENT = 1.0 // quad half-size in world units (room for stretch and glow)

const vertexShader = /* glsl */ `
  varying vec2 vLocal;
  void main() {
    vLocal = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform vec2 uRadii;
  uniform vec2 uDeform;
  uniform float uTime;
  uniform float uFade;
  varying vec2 vLocal;
  void main() {
    float len = length(vLocal);
    vec2 dir = vLocal / max(len, 1e-5);
    float th = atan(dir.y, dir.x);

    // Oval radius in this direction, then wobble, then the lag stretch.
    float r = uRadii.x * uRadii.y / length(vec2(uRadii.y * dir.x, uRadii.x * dir.y));
    r *= 1.0 + 0.035 * sin(3.0 * th + uTime * 1.3) + 0.03 * sin(2.0 * th - uTime * 0.9);
    float m = length(uDeform);
    float c1 = m > 1e-4 ? dot(dir, uDeform / m) : 0.0;
    r *= 1.0 + m * (0.5 * (2.0 * c1 * c1 - 1.0) + 0.45 * c1);
    float d = len / r;

    float aa = fwidth(d) + 1e-4;
    float body = 1.0 - smoothstep(1.0 - aa, 1.0 + aa, d);

    // Domed wax: bright core, lit from the bulb below, soft highlight.
    float thick = sqrt(max(0.0, 1.0 - d * d));
    vec3 n = normalize(vec3(dir * d, max(thick, 0.2)));
    vec3 c = uColor * (0.72 + 0.32 * thick);
    c *= 0.85 + 0.3 * max(dot(n, normalize(vec3(0.0, -0.7, 0.7))), 0.0);
    vec3 hv = normalize(normalize(vec3(-0.4, 0.6, 0.7)) + vec3(0.0, 0.0, 1.0));
    c += vec3(1.0) * pow(max(dot(n, hv), 0.0), 24.0) * 0.45;
    c += vec3(1.0, 0.95, 0.9) * smoothstep(0.75, 1.0, d) * 0.22; // rim light

    float glow = exp(-pow(max(d - 1.0, 0.0) / 0.45, 2.0)) * (1.0 - body);
    float a = body + glow * 0.35;
    gl_FragColor = vec4(mix(uColor, c, body), clamp(a, 0.0, 1.0) * uFade);
  }
`

export function createPlayerBlob(color) {
  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uRadii: { value: new THREE.Vector2(1, 1) },
      uDeform: { value: new THREE.Vector2(0, 0) },
      uTime: { value: 0 },
      uFade: { value: 1 },
    },
    depthTest: false,
    depthWrite: false,
    transparent: true,
  })
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2 * EXTENT, 2 * EXTENT), material)
  mesh.renderOrder = 10
  return mesh
}
