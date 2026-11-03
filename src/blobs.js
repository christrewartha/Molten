// Wax field pass. Every blob is drawn as one instanced quad into a float
// render target with additive blending:
//
//   alpha = Σ f_i            (the "field")
//   rgb   = Σ f_i · colour_i (colour weighted by field)
//
// f_i = (1 − d²/K²)², where d is the distance from the blob centre divided
// by the blob radius R(θ) and K is BLOB.reach. An isolated blob has
// f = FIELD_THRESHOLD exactly on its outline. Where two blobs come close,
// their fields add up and pass the threshold between them, so they merge
// like lava-lamp wax. The lamp pass (lamp.js) cuts the field at the
// threshold and shades it.
import * as THREE from 'three'
import { BLOB } from './config.js'

const K = BLOB.reach
export const FIELD_THRESHOLD = (1 - 1 / (K * K)) ** 2

const vertexShader = /* glsl */ `
  attribute vec4 aOffset; // x, y, rotation, size
  attribute vec4 aColor;  // rgb, base radius
  attribute vec4 aAmp;    // amplitudes for k = 2..5
  attribute vec4 aPhase;  // phases for k = 2..5
  varying vec2 vLocal;
  varying vec4 vColor;
  varying vec4 vAmp;
  varying vec4 vPhase;
  void main() {
    vLocal = position.xy;
    vColor = aColor;
    vAmp = aAmp;
    vPhase = aPhase;
    float c = cos(aOffset.z);
    float s = sin(aOffset.z);
    vec2 p = mat2(c, s, -s, c) * position.xy * aOffset.w + aOffset.xy;
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 0.0, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  uniform float uReach;
  varying vec2 vLocal;
  varying vec4 vColor;
  varying vec4 vAmp;
  varying vec4 vPhase;
  void main() {
    float th = atan(vLocal.y, vLocal.x);
    float r = vColor.a + dot(vAmp, cos(vec4(2.0, 3.0, 4.0, 5.0) * th + vPhase));
    float d = length(vLocal) / r;
    float q = max(0.0, 1.0 - d * d / (uReach * uReach));
    float f = q * q;
    gl_FragColor = vec4(vColor.rgb * f, f);
  }
`

function hexToRgb(hex) {
  return [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255]
}

export function createBlobField(maxBlobs) {
  const scene = new THREE.Scene()
  const quad = new THREE.PlaneGeometry(2 * K, 2 * K)
  const geo = new THREE.InstancedBufferGeometry()
  geo.index = quad.index
  geo.setAttribute('position', quad.getAttribute('position'))
  const attr = (name, size) => {
    const a = new THREE.InstancedBufferAttribute(new Float32Array(maxBlobs * size), size)
    a.setUsage(THREE.DynamicDrawUsage)
    geo.setAttribute(name, a)
    return a
  }
  const offset = attr('aOffset', 4)
  const color = attr('aColor', 4)
  const amp = attr('aAmp', 4)
  const phase = attr('aPhase', 4)
  geo.instanceCount = 0

  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: { uReach: { value: K } },
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
    blendSrcAlpha: THREE.OneFactor,
    blendDstAlpha: THREE.OneFactor,
    depthTest: false,
    depthWrite: false,
    transparent: true,
  })
  const mesh = new THREE.Mesh(geo, material)
  mesh.frustumCulled = false
  scene.add(mesh)

  const target = new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
  })

  return {
    target,

    // Write every shape into the instance buffers. Shapes must have
    // x, y, rot, size, palette and an up-to-date blob (see shapes.js).
    sync(shapes) {
      const n = Math.min(shapes.length, maxBlobs)
      for (let i = 0; i < n; i++) {
        const s = shapes[i]
        const b = s.blob
        offset.setXYZW(i, s.x, s.y, s.rot, s.size)
        if (!s.rgb) s.rgb = hexToRgb(s.palette.color)
        color.setXYZW(i, s.rgb[0], s.rgb[1], s.rgb[2], b.baseR)
        amp.setXYZW(i, b.amps[0], b.amps[1], b.amps[2], b.amps[3])
        phase.setXYZW(i, b.phases[0], b.phases[1], b.phases[2], b.phases[3])
      }
      geo.instanceCount = n
      offset.needsUpdate = color.needsUpdate = amp.needsUpdate = phase.needsUpdate = true
    },

    setSize(width, height) {
      target.setSize(Math.max(1, width), Math.max(1, height))
    },

    render(renderer, camera) {
      renderer.setRenderTarget(target)
      renderer.setClearColor(0x000000, 0)
      renderer.clear()
      renderer.render(scene, camera)
      renderer.setRenderTarget(null)
    },
  }
}
