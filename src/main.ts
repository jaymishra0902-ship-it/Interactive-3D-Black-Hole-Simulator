import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

const container = document.querySelector<HTMLElement>("#canvas-container");
const controlPanel = document.querySelector<HTMLElement>(".ui-panel");
const hideUiButton = document.querySelector<HTMLButtonElement>("#hide-ui");
const showUiButton = document.querySelector<HTMLButtonElement>("#show-ui");
const massSlider = document.querySelector<HTMLInputElement>("#mass-slider");
const massValue = document.querySelector<HTMLOutputElement>("#mass-value");
const spawnMatterButton = document.querySelector<HTMLButtonElement>("#spawn-matter");
const audioToggleButton = document.querySelector<HTMLButtonElement>("#audio-toggle");
const themeButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-theme]"));
const cameraModeButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-camera-mode]"));
const spinSpeedSlider = document.querySelector<HTMLInputElement>("#spin-speed");
const spinValue = document.querySelector<HTMLOutputElement>("#spin-value");
const particleDensitySlider = document.querySelector<HTMLInputElement>("#particle-density");
const densityValue = document.querySelector<HTMLOutputElement>("#density-value");
const earthTimeOutput = document.querySelector<HTMLOutputElement>("#earth-time");
const horizonTimeOutput = document.querySelector<HTMLOutputElement>("#horizon-time");
const dilationRateOutput = document.querySelector<HTMLOutputElement>("#dilation-rate");
const diskThicknessSlider = document.querySelector<HTMLInputElement>("#disk-thickness");
const thicknessValue = document.querySelector<HTMLOutputElement>("#thickness-value");
const coreTemperatureSlider = document.querySelector<HTMLInputElement>("#core-temperature");
const temperatureValue = document.querySelector<HTMLOutputElement>("#temperature-value");
const turbulenceToggle = document.querySelector<HTMLButtonElement>("#turbulence-toggle");
const photoModeButton = document.querySelector<HTMLButtonElement>("#photo-mode");
const hudGridButton = document.querySelector<HTMLButtonElement>("#hud-grid-toggle");
const hudGridOverlay = document.querySelector<HTMLDivElement>("#hud-grid-overlay");
const trajectoryOutput = document.querySelector<HTMLOutputElement>("#trajectory-result");
const galaxyDensitySlider = document.querySelector<HTMLInputElement>("#galaxy-density");
const galaxyDensityValue = document.querySelector<HTMLOutputElement>("#galaxy-density-value");
const planetOrbitSpeedSlider = document.querySelector<HTMLInputElement>("#planet-orbit-speed");
const planetSpeedValue = document.querySelector<HTMLOutputElement>("#planet-speed-value");
const spawnPlanetButton = document.querySelector<HTMLButtonElement>("#spawn-planet");
const orbitLinesButton = document.querySelector<HTMLButtonElement>("#planet-orbit-lines");
const qualityButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-quality]"));

if (
  !container || !controlPanel || !hideUiButton || !showUiButton
  || !massSlider || !massValue || !spawnMatterButton || !audioToggleButton
  || !spinSpeedSlider || !spinValue || !particleDensitySlider || !densityValue
  || !earthTimeOutput || !horizonTimeOutput || !dilationRateOutput
  || !diskThicknessSlider || !thicknessValue || !coreTemperatureSlider || !temperatureValue
  || !turbulenceToggle || !photoModeButton || !hudGridButton || !hudGridOverlay || !trajectoryOutput
  || !galaxyDensitySlider || !galaxyDensityValue || !planetOrbitSpeedSlider || !planetSpeedValue
  || !spawnPlanetButton || !orbitLinesButton
) {
  throw new Error("The black hole scene is missing required page elements.");
}

let isUiHidden = false;

function toggleUIVisibility(hidden = !isUiHidden): void {
  isUiHidden = hidden;
  controlPanel.classList.toggle("is-hidden", isUiHidden);
  controlPanel.setAttribute("aria-hidden", String(isUiHidden));
  showUiButton.style.display = isUiHidden ? "block" : "none";
  showUiButton.setAttribute("aria-hidden", String(!isUiHidden));
}

hideUiButton.addEventListener("click", () => toggleUIVisibility(true));
showUiButton.addEventListener("click", () => toggleUIVisibility(false));

type QualityMode = "auto" | "low" | "high" | "ultra";

const qualityProfiles: Record<QualityMode, { particleScale: number; pixelRatioCap: number; bloomStrength: number; bloomRadius: number; bloomThreshold: number; shadowMapSize: number }> = {
  auto: { particleScale: 1, pixelRatioCap: 1.5, bloomStrength: 1.15, bloomRadius: 0.62, bloomThreshold: 0.14, shadowMapSize: 512 },
  low: { particleScale: 0.28, pixelRatioCap: 0.85, bloomStrength: 0.65, bloomRadius: 0.42, bloomThreshold: 0.2, shadowMapSize: 0 },
  high: { particleScale: 0.82, pixelRatioCap: 1.5, bloomStrength: 1.35, bloomRadius: 0.72, bloomThreshold: 0.12, shadowMapSize: 1024 },
  ultra: { particleScale: 1, pixelRatioCap: 2, bloomStrength: 1.6, bloomRadius: 0.82, bloomThreshold: 0.1, shadowMapSize: 2048 },
};

let qualityMode: QualityMode = "auto";
let adaptiveQualityScale = 1;
let consecutiveLowFpsFrames = 0;
let consecutiveHighFpsFrames = 0;
let fpsAverage = 60;
let fpsWindowFrames = 0;
let fpsWindowSeconds = 0;
let fpsMeasurementCount = 0;
let lastAdaptiveChange = 0;
let horizonRadius = 1;
let diskRadius = 7.2;

function getEffectiveParticleScale(): number {
  const profile = qualityProfiles[qualityMode];
  return profile.particleScale * (qualityMode === "auto" ? adaptiveQualityScale : 1);
}

function getRendererPixelRatio(): number {
  const profile = qualityProfiles[qualityMode];
  const devicePixelRatio = window.devicePixelRatio || 1;
  const scale = qualityMode === "auto" ? adaptiveQualityScale : 1;
  return Math.max(0.5, Math.min(devicePixelRatio, profile.pixelRatioCap) * scale);
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x020208);
scene.fog = new THREE.FogExp2(0x010207, 0.003);
scene.add(new THREE.AmbientLight(0xffffff, 1.5));
const keyLight = new THREE.DirectionalLight(0xffedcc, 2.2);
keyLight.position.set(-12, 18, 14);
keyLight.shadow.camera.left = -48;
keyLight.shadow.camera.right = 48;
keyLight.shadow.camera.top = 48;
keyLight.shadow.camera.bottom = -48;
keyLight.shadow.camera.far = 140;
keyLight.shadow.bias = -0.00025;
scene.add(keyLight);
const fillLight = new THREE.DirectionalLight(0x74baff, 1.1);
fillLight.position.set(16, -8, -12);
scene.add(fillLight);

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  200000,
);
camera.position.set(0, 10, 35);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(getRendererPixelRatio());
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.setClearColor(0x020208);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
container.appendChild(renderer.domElement);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const lensingPass = new ShaderPass({
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uCenter: { value: new THREE.Vector2(0.5, 0.5) },
    uAspect: { value: window.innerWidth / window.innerHeight },
    uEinsteinRadius: { value: 0.055 },
    uRingWidth: { value: 0.004 },
    uStrength: { value: 0.003 },
    uLensColor: { value: new THREE.Color(0xffb84c) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uAspect;
    uniform float uEinsteinRadius;
    uniform float uRingWidth;
    uniform float uStrength;
    uniform vec2 uCenter;
    uniform vec3 uLensColor;
    varying vec2 vUv;

    void main() {
      vec2 aspectScale = vec2(uAspect, 1.0);
      vec2 radial = (vUv - uCenter) * aspectScale;
      float radius = length(radial);
      vec2 direction = radial / max(radius, 0.00001);
      float safeRadius = max(radius, uEinsteinRadius * 0.35);
      float bentRadius = abs(radius - uStrength / safeRadius);
      vec2 warpedUv = uCenter + direction * bentRadius / aspectScale;
      vec3 original = texture2D(tDiffuse, vUv).rgb;
      vec3 lensed = texture2D(tDiffuse, clamp(warpedUv, vec2(0.001), vec2(0.999))).rgb;
      float influence = 1.0 - smoothstep(uEinsteinRadius * 2.2, uEinsteinRadius * 5.2, radius);
      vec3 color = mix(original, lensed, influence * 0.78);

      float angle = atan(radial.y, radial.x);
      float ring = exp(-pow((radius - uEinsteinRadius) / max(uRingWidth, 0.001), 2.0));
      float shimmer = 0.9 + 0.1 * sin(angle * 19.0 - uTime * 1.6);
      color += uLensColor * ring * shimmer * 1.5;
      gl_FragColor = vec4(color, 1.0);
    }
  `,
});
composer.addPass(lensingPass);
const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    1.35,
    0.72,
    0.12,
  );
composer.addPass(bloomPass);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enableRotate = true;
controls.enableZoom = true;
controls.enablePan = true;
controls.screenSpacePanning = true;
controls.rotateSpeed = 0.65;
controls.zoomSpeed = 0.8;
controls.panSpeed = 0.65;
controls.minDistance = 3;
controls.maxDistance = 150000;
controls.touches.ONE = THREE.TOUCH.ROTATE;
controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
for (const button of cameraModeButtons) {
  button.addEventListener("click", () => {
    const cinematic = button.dataset.cameraMode === "cinematic";
    controls.autoRotate = cinematic;
    controls.autoRotateSpeed = cinematic ? 0.42 : 0;
    for (const modeButton of cameraModeButtons) {
      modeButton.setAttribute("aria-pressed", String(modeButton === button));
    }
  });
}

const starCount = 90000;
const starPositions = new Float32Array(starCount * 3);
for (let index = 0; index < starPositions.length; index += 3) {
  const radius = 80 + Math.cbrt(Math.random()) * 4800;
  const theta = Math.random() * Math.PI * 2;
  const vertical = Math.random() * 2 - 1;
  const horizontal = Math.sqrt(1 - vertical * vertical);
  starPositions[index] = radius * horizontal * Math.cos(theta);
  starPositions[index + 1] = radius * vertical;
  starPositions[index + 2] = radius * horizontal * Math.sin(theta);
}

const starGeometry = new THREE.BufferGeometry();
starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
const starfield = new THREE.Points(
  starGeometry,
  new THREE.PointsMaterial({ color: 0xc9d9ff, size: 0.8, sizeAttenuation: false }),
);
scene.add(starfield);

const cosmicDustCount = 48000;
const cosmicDustPositions = new Float32Array(cosmicDustCount * 3);
const cosmicDustColors = new Float32Array(cosmicDustCount * 3);
const cosmicDustSizes = new Float32Array(cosmicDustCount);
const cosmicDustAlpha = new Float32Array(cosmicDustCount);
const dustPalette = [
  new THREE.Color(0x9a55ff),
  new THREE.Color(0x34d8ff),
  new THREE.Color(0xffa94d),
  new THREE.Color(0xf443c4),
];
for (let index = 0; index < cosmicDustCount; index += 1) {
  const angle = Math.random() * Math.PI * 2;
  const radius = 28 + Math.sqrt(Math.random()) * 520;
  const layer = Math.random();
  const verticalSpread = layer < 0.76 ? 24 : 100;
  cosmicDustPositions[index * 3] = Math.cos(angle) * radius + (Math.random() - 0.5) * 44;
  cosmicDustPositions[index * 3 + 1] = (Math.random() - 0.5) * verticalSpread;
  cosmicDustPositions[index * 3 + 2] = Math.sin(angle) * radius + (Math.random() - 0.5) * 44;

  const color = dustPalette[Math.floor(Math.random() * dustPalette.length)].clone();
  color.lerp(new THREE.Color(0xffcf9b), Math.random() * 0.22);
  cosmicDustColors[index * 3] = color.r;
  cosmicDustColors[index * 3 + 1] = color.g;
  cosmicDustColors[index * 3 + 2] = color.b;
  cosmicDustSizes[index] = 0.55 + Math.random() * 3.8;
  cosmicDustAlpha[index] = 0.12 + Math.random() * 0.38;
}

const cosmicDustGeometry = new THREE.BufferGeometry();
cosmicDustGeometry.setAttribute("position", new THREE.BufferAttribute(cosmicDustPositions, 3));
cosmicDustGeometry.setAttribute("aColor", new THREE.BufferAttribute(cosmicDustColors, 3));
cosmicDustGeometry.setAttribute("aSize", new THREE.BufferAttribute(cosmicDustSizes, 1));
cosmicDustGeometry.setAttribute("aAlpha", new THREE.BufferAttribute(cosmicDustAlpha, 1));
const cosmicDust = new THREE.Points(
  cosmicDustGeometry,
  new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      attribute vec3 aColor;
      attribute float aSize;
      attribute float aAlpha;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * viewPosition;
        gl_PointSize = clamp(aSize * (210.0 / max(-viewPosition.z, 1.0)), 0.7, 7.0);
        vColor = aColor;
        vAlpha = aAlpha;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        float radial = length(gl_PointCoord - 0.5);
        float haze = exp(-radial * 8.0) * (1.0 - smoothstep(0.2, 0.5, radial));
        gl_FragColor = vec4(vColor * (0.75 + haze * 1.2), haze * vAlpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  }),
);
cosmicDust.frustumCulled = false;
scene.add(cosmicDust);

interface GalaxySystem {
  group: THREE.Group;
  geometry: THREE.BufferGeometry;
  basePosition: THREE.Vector3;
  particleCount: number;
  rotationSpeed: number;
  parallax: number;
}

const galaxySystems: GalaxySystem[] = [];
const galaxyPalette = [
  new THREE.Color(0x9664ff),
  new THREE.Color(0x54dfff),
  new THREE.Color(0xffbd62),
  new THREE.Color(0xff4acb),
  new THREE.Color(0x5678ff),
];

function createGalaxy(
  kind: "spiral" | "elliptical" | "ring",
  particleCount: number,
  radius: number,
  position: THREE.Vector3,
  inclination: number,
  rotationSpeed: number,
  parallax: number,
  seed: number,
): GalaxySystem {
  const positions = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 3);
  const sizes = new Float32Array(particleCount);
  const opacities = new Float32Array(particleCount);

  for (let index = 0; index < particleCount; index += 1) {
    const normalizedRadius = kind === "ring"
      ? 0.68 + (Math.random() - 0.5) * 0.3
      : Math.pow(Math.random(), kind === "spiral" ? 0.68 : 0.48);
    const radialDistance = normalizedRadius * radius;
    let x: number;
    let y: number;
    let z: number;

    if (kind === "spiral") {
      const armCount = 4;
      const arm = Math.floor(Math.random() * armCount);
      const angle = arm * (Math.PI * 2 / armCount)
        + radialDistance * 0.34
        + (Math.random() - 0.5) * (0.22 + normalizedRadius * 0.4);
      x = Math.cos(angle) * radialDistance;
      z = Math.sin(angle) * radialDistance;
      y = (Math.random() - 0.5) * (0.35 + normalizedRadius * 2.2);
    } else if (kind === "ring") {
      const angle = Math.random() * Math.PI * 2;
      const ringRadius = radialDistance * (0.72 + Math.random() * 0.12);
      x = Math.cos(angle) * ringRadius;
      z = Math.sin(angle) * ringRadius;
      y = (Math.random() - 0.5) * (0.16 + normalizedRadius * 0.55);
    } else {
      const direction = new THREE.Vector3().randomDirection();
      const flatten = 0.3 + Math.random() * 0.1;
      x = direction.x * radialDistance;
      y = direction.y * radialDistance * flatten;
      z = direction.z * radialDistance;
    }

    positions[index * 3] = x;
    positions[index * 3 + 1] = y;
    positions[index * 3 + 2] = z;

    const colorMix = Math.random();
    const colorIndex = (index + seed) % galaxyPalette.length;
    const color = galaxyPalette[colorIndex].clone();
    color.lerp(galaxyPalette[(colorIndex + 1) % galaxyPalette.length], colorMix * 0.48);
    if (normalizedRadius < 0.22) color.lerp(new THREE.Color(0xffe3b0), 0.45);
    colors[index * 3] = color.r;
    colors[index * 3 + 1] = color.g;
    colors[index * 3 + 2] = color.b;
    sizes[index] = (kind === "elliptical" ? 0.7 : 0.55) + Math.random() * 2.4;
    opacities[index] = (0.2 + Math.random() * 0.65) * (1 - normalizedRadius * 0.24);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute("aOpacity", new THREE.BufferAttribute(opacities, 1));

  const material = new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      attribute vec3 aColor;
      attribute float aSize;
      attribute float aOpacity;
      varying vec3 vColor;
      varying float vOpacity;
      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * viewPosition;
        gl_PointSize = clamp(aSize * (320.0 / max(-viewPosition.z, 1.0)), 0.8, 8.0);
        vColor = aColor;
        vOpacity = aOpacity;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vOpacity;
      void main() {
        float radial = length(gl_PointCoord - 0.5);
        float core = 1.0 - smoothstep(0.04, 0.5, radial);
        float halo = exp(-radial * 7.0) * 0.32;
        float glow = max(core, halo);
        gl_FragColor = vec4(vColor * (0.8 + glow * 1.3), glow * vOpacity);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });

  const group = new THREE.Group();
  const galaxy = new THREE.Points(geometry, material);
  galaxy.frustumCulled = false;
  group.add(galaxy);
  group.position.copy(position);
  group.rotation.set(inclination, seed * 0.37, inclination * 0.42);
  scene.add(group);

  const system: GalaxySystem = {
    group,
    geometry,
    basePosition: position.clone(),
    particleCount,
    rotationSpeed,
    parallax,
  };
  galaxySystems.push(system);
  return system;
}

createGalaxy("spiral", 7600, 115, new THREE.Vector3(-220, 105, -2100), -0.28, 0.0018, 0.018, 1);
createGalaxy("spiral", 7600, 205, new THREE.Vector3(1250, -390, -4550), 0.48, -0.0011, 0.014, 2);
createGalaxy("elliptical", 7600, 440, new THREE.Vector3(-5150, -1900, -8700), 0.12, 0.00035, 0.011, 3);
createGalaxy("ring", 7600, 590, new THREE.Vector3(1800, 5100, -14600), -0.62, 0.0013, 0.009, 4);
createGalaxy("elliptical", 7600, 970, new THREE.Vector3(19800, 7800, -40200), 0.28, -0.00024, 0.007, 5);
createGalaxy("spiral", 7600, 330, new THREE.Vector3(-2300, -8200, -17900), 0.76, 0.0011, 0.01, 6);
createGalaxy("elliptical", 7600, 1330, new THREE.Vector3(-61400, 11900, -28600), -0.34, 0.0002, 0.005, 7);
createGalaxy("spiral", 7600, 1080, new THREE.Vector3(77400, -11000, -19900), 0.2, -0.00085, 0.004, 8);
createGalaxy("ring", 7600, 1670, new THREE.Vector3(4500, 66200, 31400), 0.52, 0.00065, 0.003, 9);
createGalaxy("spiral", 7600, 1510, new THREE.Vector3(-12500, -73800, 42700), -0.16, -0.00055, 0.003, 10);

const horizonMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });

const blackHole = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 96), horizonMaterial);
scene.add(blackHole);

const photonRingMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uCoolColor: { value: new THREE.Color(0xe95b1c) },
      uHotColor: { value: new THREE.Color(0xffcf69) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      uniform vec3 uCoolColor;
      uniform vec3 uHotColor;
      void main() {
        float temperature = smoothstep(0.08, 0.92, vUv.x);
        vec3 color = mix(uCoolColor, uHotColor, temperature);
        float pulse = 0.82 + 0.18 * sin(vUv.x * 6.28318);
        gl_FragColor = vec4(color * pulse * 2.2, 1.0);
      }
    `,
    toneMapped: false,
  });
const photonRing = new THREE.Mesh(new THREE.TorusGeometry(1.075, 0.022, 10, 192), photonRingMaterial);
scene.add(photonRing);

const diskMaterial = new THREE.ShaderMaterial({
  uniforms: {
    uTime: { value: 0 },
    uInnerRadius: { value: 0.16 },
    uCoolColor: { value: new THREE.Color(0xe95b1c) },
    uHotColor: { value: new THREE.Color(0xffcf69) },
    uCoreColor: { value: new THREE.Color(0xfff0c2) },
    uSpinSpeed: { value: 1 },
    uObserverDirection: { value: new THREE.Vector2(0, 1) },
    uDiskThickness: { value: 1 },
    uCoreTemperature: { value: 1.3 },
    uTurbulence: { value: 1 },
    uLayerIntensity: { value: 1 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    uniform float uTime;
    uniform float uSpinSpeed;
    uniform float uDiskThickness;
    uniform float uTurbulence;
    void main() {
      vUv = uv;
      vec3 displaced = position;
      float rippling = sin(position.x * 27.0 + uTime * uSpinSpeed)
        * cos(position.y * 19.0 - uTime * 0.7);
      displaced.z += rippling * uDiskThickness * uTurbulence * 0.006;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    varying vec2 vUv;
    uniform float uTime;
    uniform float uInnerRadius;
    uniform vec3 uCoolColor;
    uniform vec3 uHotColor;
    uniform vec3 uCoreColor;
    uniform float uSpinSpeed;
    uniform vec2 uObserverDirection;
    uniform float uDiskThickness;
    uniform float uCoreTemperature;
    uniform float uTurbulence;
    uniform float uLayerIntensity;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
        mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
        f.y
      );
    }

    float fbm(vec2 p) {
      float value = 0.0;
      float amplitude = 0.5;
      for (int octave = 0; octave < 5; octave++) {
        value += noise(p) * amplitude;
        p = p * 2.03 + vec2(13.7, 9.2);
        amplitude *= 0.5;
      }
      return value;
    }

    void main() {
      vec2 point = (vUv - 0.5) * 2.0;
      float radius = length(point);
      if (radius < uInnerRadius || radius > 1.0) discard;

      float angle = atan(point.y, point.x);
      float rotation = uTime * uSpinSpeed * (1.25 + 0.35 / max(radius, 0.2));
      vec2 flow = vec2((angle + rotation) * 3.0, radius * 17.0 - uTime * 1.8);
      float noiseField = fbm(flow + vec2(fbm(flow * 0.7), 0.0) * 1.4);
      float turbulence = mix(0.5, noiseField, uTurbulence);
      float filaments = smoothstep(0.2, 0.88, turbulence);
      float innerHeat = exp(-pow((radius - uInnerRadius * 1.22) * 8.0 / uDiskThickness, 2.0));
      float radialFade = smoothstep(uInnerRadius, uInnerRadius + 0.09 * uDiskThickness, radius)
        * (1.0 - smoothstep(0.74, 1.0, radius));
      float brightness = (0.28 + filaments * 1.5 * uTurbulence + innerHeat * 2.0 * uCoreTemperature) * radialFade * uLayerIntensity;
      float temperature = clamp(1.0 - (radius - uInnerRadius) * 1.12 + (turbulence - 0.5) * 0.28, 0.0, 1.0);
      vec2 diskDirection = normalize(vec2(point.x, -point.y));
      vec2 orbitalVelocity = normalize(vec2(-diskDirection.y, diskDirection.x));
      float lineOfSight = dot(orbitalVelocity, normalize(uObserverDirection));
      float approaching = max(lineOfSight, 0.0);
      float receding = max(-lineOfSight, 0.0);
      float dopplerBoost = clamp(1.0 + approaching * 0.9 - receding * 0.42, 0.48, 1.9);
      float shiftedTemperature = clamp(temperature + approaching * 0.22 - receding * 0.16, 0.0, 1.0);
      vec3 color = mix(uCoolColor, uHotColor, shiftedTemperature);
      color = mix(color, uCoreColor, innerHeat * 0.72 * clamp(uCoreTemperature, 0.0, 1.0));
      float alpha = radialFade * (0.23 + filaments * 0.65) * dopplerBoost;
      gl_FragColor = vec4(color * brightness * dopplerBoost, alpha);
    }
  `,
  side: THREE.DoubleSide,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  toneMapped: false,
});

const disk = new THREE.Mesh(new THREE.PlaneGeometry(2, 2, 128, 128), diskMaterial);
disk.rotation.x = -Math.PI / 2;
disk.scale.setScalar(7.2);
disk.renderOrder = 1;
scene.add(disk);

const outerDiskMaterial = diskMaterial.clone();
outerDiskMaterial.uniforms.uLayerIntensity.value = 0.34;
const outerDisk = new THREE.Mesh(disk.geometry, outerDiskMaterial);
outerDisk.rotation.x = -Math.PI / 2;
outerDisk.position.y = -0.045;
outerDisk.scale.setScalar(8.8);
outerDisk.renderOrder = 0;
scene.add(outerDisk);

const energyParticleCount = 1800;
const particleGeometry = new THREE.BufferGeometry();
const particleAngles = new Float32Array(energyParticleCount);
const particleRadii = new Float32Array(energyParticleCount);
const particleHeights = new Float32Array(energyParticleCount);
const particleSizes = new Float32Array(energyParticleCount);
const particleSeeds = new Float32Array(energyParticleCount);
for (let index = 0; index < energyParticleCount; index += 1) {
  particleAngles[index] = Math.random() * Math.PI * 2;
  particleRadii[index] = 1.4 + Math.random() * 6.1;
  particleHeights[index] = (Math.random() - 0.5) * 0.18;
  particleSizes[index] = 1.2 + Math.random() * 3.2;
  particleSeeds[index] = Math.random();
}
particleGeometry.setAttribute("aAngle", new THREE.BufferAttribute(particleAngles, 1));
particleGeometry.setAttribute("aRadius", new THREE.BufferAttribute(particleRadii, 1));
particleGeometry.setAttribute("aHeight", new THREE.BufferAttribute(particleHeights, 1));
particleGeometry.setAttribute("aSize", new THREE.BufferAttribute(particleSizes, 1));
particleGeometry.setAttribute("aSeed", new THREE.BufferAttribute(particleSeeds, 1));
const energyParticles = new THREE.Points(
  particleGeometry,
  new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uCoolColor: { value: new THREE.Color(0xe95b1c) },
      uHotColor: { value: new THREE.Color(0xffcf69) },
      uSpinSpeed: { value: 1 },
    },
    vertexShader: /* glsl */ `
      attribute float aAngle;
      attribute float aRadius;
      attribute float aHeight;
      attribute float aSize;
      attribute float aSeed;
      uniform float uTime;
      uniform float uSpinSpeed;
      uniform vec3 uCoolColor;
      uniform vec3 uHotColor;
      varying float vAlpha;
      varying vec3 vColor;

      void main() {
        float angle = aAngle + uTime * uSpinSpeed * (0.55 + 2.8 / max(aRadius, 1.0));
        float radius = aRadius + sin(uTime * 2.0 + aSeed * 30.0) * 0.025;
        vec3 position = vec3(
          cos(angle) * radius,
          aHeight + sin(angle * 2.0 + aSeed * 8.0) * 0.045,
          sin(angle) * radius
        );
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * viewPosition;
        gl_PointSize = clamp(aSize * (230.0 / -viewPosition.z), 1.0, 7.0);
        vAlpha = 0.32 + 0.58 * (0.5 + 0.5 * sin(uTime * 3.0 + aSeed * 60.0));
        vColor = mix(uCoolColor, uHotColor, aSeed);
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vAlpha;
      varying vec3 vColor;
      void main() {
        float distanceToCenter = length(gl_PointCoord - 0.5);
        float glow = exp(-distanceToCenter * 10.0) * (1.0 - smoothstep(0.18, 0.5, distanceToCenter));
        gl_FragColor = vec4(vColor * 1.7, glow * vAlpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  }),
);
scene.add(energyParticles);

const jetParticleCount = 1800;
const jetGeometry = new THREE.BufferGeometry();
const jetPositions = new Float32Array(jetParticleCount * 3);
const jetAlong = new Float32Array(jetParticleCount);
const jetAngles = new Float32Array(jetParticleCount);
const jetWidths = new Float32Array(jetParticleCount);
const jetSeeds = new Float32Array(jetParticleCount);
const jetSides = new Float32Array(jetParticleCount);
const jetSizes = new Float32Array(jetParticleCount);
for (let index = 0; index < jetParticleCount; index += 1) {
  const along = Math.random();
  const angle = Math.random() * Math.PI * 2;
  const width = 0.15 + Math.random();
  const side = index % 2 === 0 ? 1 : -1;
  const spread = along * (0.22 + width * 1.25);
  jetPositions[index * 3] = Math.cos(angle) * spread;
  jetPositions[index * 3 + 1] = side * (1.2 + along * 11.5);
  jetPositions[index * 3 + 2] = Math.sin(angle) * spread;
  jetAlong[index] = along;
  jetAngles[index] = angle;
  jetWidths[index] = width;
  jetSeeds[index] = Math.random();
  jetSides[index] = side;
  jetSizes[index] = 1.2 + Math.random() * 3.2;
}
jetGeometry.setAttribute("position", new THREE.BufferAttribute(jetPositions, 3));
jetGeometry.setAttribute("aAlong", new THREE.BufferAttribute(jetAlong, 1));
jetGeometry.setAttribute("aAngle", new THREE.BufferAttribute(jetAngles, 1));
jetGeometry.setAttribute("aWidth", new THREE.BufferAttribute(jetWidths, 1));
jetGeometry.setAttribute("aSeed", new THREE.BufferAttribute(jetSeeds, 1));
jetGeometry.setAttribute("aSide", new THREE.BufferAttribute(jetSides, 1));
jetGeometry.setAttribute("aSize", new THREE.BufferAttribute(jetSizes, 1));

const jetMaterial = new THREE.ShaderMaterial({
  uniforms: {
    uTime: { value: 0 },
    uHorizonRadius: { value: 1 },
    uJetColor: { value: new THREE.Color(0xffcf69) },
    uCoreColor: { value: new THREE.Color(0xfff0c2) },
  },
  vertexShader: /* glsl */ `
    attribute float aAlong;
    attribute float aAngle;
    attribute float aWidth;
    attribute float aSeed;
    attribute float aSide;
    attribute float aSize;
    uniform float uTime;
    uniform float uHorizonRadius;
    uniform vec3 uJetColor;
    uniform vec3 uCoreColor;
    varying float vAlpha;
    varying vec3 vColor;

    void main() {
      float angle = aAngle + uTime * (0.25 + aAlong * 0.85) + aSeed * 6.28318;
      float spread = aAlong * (0.2 + aWidth * 1.4);
      vec3 jetPosition = vec3(
        cos(angle) * spread,
        aSide * (uHorizonRadius * 1.2 + aAlong * 11.5),
        sin(angle) * spread
      );
      vec4 viewPosition = modelViewMatrix * vec4(jetPosition, 1.0);
      gl_Position = projectionMatrix * viewPosition;
      gl_PointSize = clamp(aSize * (250.0 / -viewPosition.z), 1.2, 8.0);
      vAlpha = (0.4 + 0.6 * sin(uTime * 2.4 + aSeed * 30.0) * 0.5 + 0.3) * (1.0 - aAlong * 0.35);
      vColor = mix(uCoreColor, uJetColor, smoothstep(0.0, 0.8, aAlong));
    }
  `,
  fragmentShader: /* glsl */ `
    varying float vAlpha;
    varying vec3 vColor;
    void main() {
      float radius = length(gl_PointCoord - 0.5);
      float glow = (1.0 - smoothstep(0.05, 0.5, radius)) * exp(-radius * 3.0);
      gl_FragColor = vec4(vColor * 1.8, glow * vAlpha);
    }
  `,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  toneMapped: false,
});
const polarJets = new THREE.Points(jetGeometry, jetMaterial);
polarJets.frustumCulled = false;
scene.add(polarJets);

interface PlanetSystem {
  mesh: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  atmosphere: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  orbitLine: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  orbitRadius: number;
  initialOrbitRadius: number;
  angle: number;
  inclination: number;
  angularSpeed: number;
  inspiralSpeed: number;
  size: number;
  baseColor: THREE.Color;
  disintegrationStarted: boolean;
}

interface PlanetDebris {
  points: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  velocities: Float32Array;
  age: number;
  lifetime: number;
}

const planets: PlanetSystem[] = [];
const planetDebris: PlanetDebris[] = [];
let planetOrbitSpeed = 1;
let orbitLinesVisible = false;

const planetVertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec3 vViewDirection;
  void main() {
    vUv = uv;
    vPosition = position;
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vViewDirection = normalize(-viewPosition.xyz);
    gl_Position = projectionMatrix * viewPosition;
  }
`;

const planetFragmentShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec3 vViewDirection;
  uniform float uTime;
  uniform float uSeed;
  uniform vec3 uBaseColor;
  uniform vec3 uSecondaryColor;
  uniform vec3 uAtmosphereColor;

  float hash(vec3 point) {
    return fract(sin(dot(point, vec3(127.1, 311.7, 74.7))) * 43758.5453);
  }

  float noise(vec3 point) {
    vec3 cell = floor(point);
    vec3 local = fract(point);
    local = local * local * (3.0 - 2.0 * local);
    return mix(
      mix(mix(hash(cell), hash(cell + vec3(1.0, 0.0, 0.0)), local.x),
          mix(hash(cell + vec3(0.0, 1.0, 0.0)), hash(cell + vec3(1.0, 1.0, 0.0)), local.x), local.y),
      mix(mix(hash(cell + vec3(0.0, 0.0, 1.0)), hash(cell + vec3(1.0, 0.0, 1.0)), local.x),
          mix(hash(cell + vec3(0.0, 1.0, 1.0)), hash(cell + vec3(1.0, 1.0, 1.0)), local.x), local.y),
      local.z
    );
  }

  float fbm(vec3 point) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int octave = 0; octave < 4; octave++) {
      value += noise(point) * amplitude;
      point = point * 2.04 + vec3(7.1, 13.7, 3.2);
      amplitude *= 0.5;
    }
    return value;
  }

  void main() {
    vec3 normal = normalize(vNormal);
    float terrain = fbm(vPosition * 5.5 + vec3(uSeed));
    float bands = sin(vUv.y * 74.0 + sin(vUv.x * 17.0 + uSeed) * 2.2 + terrain * 4.0);
    float clouds = fbm(vPosition * 15.0 + vec3(uTime * 0.025, uSeed, 0.0));
    float land = smoothstep(0.43, 0.67, terrain + bands * 0.065);
    vec3 surface = mix(uBaseColor, uSecondaryColor, land);
    surface = mix(surface, vec3(0.88, 0.91, 0.95), smoothstep(0.72, 0.88, clouds) * 0.28);
    float diffuse = 0.24 + 0.76 * max(dot(normal, normalize(vec3(-0.45, 0.62, 0.72))), 0.0);
    float rim = pow(1.0 - max(dot(normal, normalize(vViewDirection)), 0.0), 3.2);
    vec3 color = surface * diffuse + uAtmosphereColor * rim * 0.7;
    gl_FragColor = vec4(color, 1.0);
  }
`;

const atmosphereVertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewDirection;
  void main() {
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vViewDirection = normalize(-viewPosition.xyz);
    gl_Position = projectionMatrix * viewPosition;
  }
`;

const atmosphereFragmentShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewDirection;
  uniform vec3 uAtmosphereColor;
  void main() {
    float rim = pow(1.0 - max(dot(normalize(vNormal), normalize(vViewDirection)), 0.0), 2.1);
    gl_FragColor = vec4(uAtmosphereColor * 1.8, rim * 0.48);
  }
`;

function createOrbitLine(radius: number, inclination: number): THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial> {
  const points: THREE.Vector3[] = [];
  const segments = 192;
  for (let index = 0; index <= segments; index += 1) {
    const angle = (index / segments) * Math.PI * 2;
    points.push(new THREE.Vector3(
      Math.cos(angle) * radius,
      Math.sin(angle) * radius * Math.sin(inclination),
      Math.sin(angle) * radius * Math.cos(inclination),
    ));
  }
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color: 0x77bce8,
    transparent: true,
    opacity: 0.24,
    depthWrite: false,
    toneMapped: false,
  });
  const line = new THREE.Line(geometry, material);
  line.visible = orbitLinesVisible;
  line.renderOrder = 2;
  scene.add(line);
  return line;
}

function createPlanet(
  orbitRadius: number,
  size: number,
  angularSpeed: number,
  inclination: number,
  baseColor: THREE.Color,
  secondaryColor: THREE.Color,
  atmosphereColor: THREE.Color,
  inspiralSpeed = 0,
): PlanetSystem {
  const geometry = new THREE.SphereGeometry(1, 72, 56);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSeed: { value: Math.random() * 20 },
      uBaseColor: { value: baseColor.clone() },
      uSecondaryColor: { value: secondaryColor.clone() },
      uAtmosphereColor: { value: atmosphereColor.clone() },
    },
    vertexShader: planetVertexShader,
    fragmentShader: planetFragmentShader,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.scale.setScalar(size);
  mesh.castShadow = true;
  scene.add(mesh);

  const atmosphereMaterial = new THREE.ShaderMaterial({
    uniforms: { uAtmosphereColor: { value: atmosphereColor.clone() } },
    vertexShader: atmosphereVertexShader,
    fragmentShader: atmosphereFragmentShader,
    transparent: true,
    side: THREE.BackSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(1.045, 48, 40), atmosphereMaterial);
  atmosphere.scale.setScalar(size);
  scene.add(atmosphere);

  const orbitLine = createOrbitLine(orbitRadius, inclination);
  const planet: PlanetSystem = {
    mesh,
    atmosphere,
    orbitLine,
    orbitRadius,
    initialOrbitRadius: orbitRadius,
    angle: Math.random() * Math.PI * 2,
    inclination,
    angularSpeed,
    inspiralSpeed,
    size,
    baseColor: baseColor.clone(),
    disintegrationStarted: false,
  };
  planets.push(planet);
  return planet;
}

createPlanet(11.5, 0.62, 0.27, 0.08, new THREE.Color(0x2588bb), new THREE.Color(0x41b9b0), new THREE.Color(0x54d8ff));
createPlanet(15.4, 0.92, 0.19, 0.19, new THREE.Color(0x99593d), new THREE.Color(0xd5a35b), new THREE.Color(0xffc17a));
createPlanet(20.2, 1.16, 0.13, -0.12, new THREE.Color(0x473e93), new THREE.Color(0x9674bf), new THREE.Color(0xc0a3ff));
createPlanet(23.6, 0.74, 0.115, 0.3, new THREE.Color(0x4c9857), new THREE.Color(0x98b85c), new THREE.Color(0xb2ed93));
createPlanet(27.2, 1.42, 0.092, -0.22, new THREE.Color(0xa55e3c), new THREE.Color(0xe0bf8e), new THREE.Color(0xffd4a0));
createPlanet(30.8, 0.85, 0.078, 0.43, new THREE.Color(0x2d669d), new THREE.Color(0x9ed4dc), new THREE.Color(0x93ecff));
createPlanet(34.4, 1.04, 0.065, -0.38, new THREE.Color(0x7761a8), new THREE.Color(0xc6b8d8), new THREE.Color(0xe1c8ff));
createPlanet(38.2, 1.28, 0.054, 0.16, new THREE.Color(0x875127), new THREE.Color(0xc9a456), new THREE.Color(0xffd474));

interface AsteroidBelt {
  mesh: THREE.InstancedMesh<THREE.IcosahedronGeometry, THREE.MeshStandardMaterial>;
  angles: Float32Array;
  radii: Float32Array;
  radialOffsets: Float32Array;
  heights: Float32Array;
  sizes: Float32Array;
  spinX: Float32Array;
  spinY: Float32Array;
  spinZ: Float32Array;
  rotations: Float32Array;
}

const asteroidCount = 2600;
const asteroidGeometry = new THREE.IcosahedronGeometry(1, 0);
const asteroidMaterial = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  roughness: 0.92,
  metalness: 0.18,
});
const asteroidMesh = new THREE.InstancedMesh(asteroidGeometry, asteroidMaterial, asteroidCount);
asteroidMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
asteroidMesh.castShadow = true;
asteroidMesh.receiveShadow = true;
asteroidMesh.frustumCulled = false;
scene.add(asteroidMesh);
const asteroidDummy = new THREE.Object3D();
const asteroidColor = new THREE.Color();
const asteroidBelt: AsteroidBelt = {
  mesh: asteroidMesh,
  angles: new Float32Array(asteroidCount),
  radii: new Float32Array(asteroidCount),
  radialOffsets: new Float32Array(asteroidCount),
  heights: new Float32Array(asteroidCount),
  sizes: new Float32Array(asteroidCount),
  spinX: new Float32Array(asteroidCount),
  spinY: new Float32Array(asteroidCount),
  spinZ: new Float32Array(asteroidCount),
  rotations: new Float32Array(asteroidCount),
};
for (let index = 0; index < asteroidCount; index += 1) {
  asteroidBelt.angles[index] = Math.random() * Math.PI * 2;
  asteroidBelt.radialOffsets[index] = Math.random() * 2.2;
  asteroidBelt.radii[index] = diskRadius + 1.1 + asteroidBelt.radialOffsets[index];
  asteroidBelt.heights[index] = (Math.random() - 0.5) * 0.9;
  asteroidBelt.sizes[index] = 0.035 + Math.random() * 0.12;
  asteroidBelt.spinX[index] = (Math.random() - 0.5) * 1.7;
  asteroidBelt.spinY[index] = (Math.random() - 0.5) * 1.7;
  asteroidBelt.spinZ[index] = (Math.random() - 0.5) * 1.7;
  asteroidBelt.rotations[index] = Math.random() * Math.PI * 2;
  asteroidColor.setHSL(0.055 + Math.random() * 0.08, 0.12 + Math.random() * 0.18, 0.18 + Math.random() * 0.3);
  asteroidMesh.setColorAt(index, asteroidColor);
}
if (asteroidMesh.instanceColor) asteroidMesh.instanceColor.needsUpdate = true;

function spawnPlanetDebris(position: THREE.Vector3, color: THREE.Color): void {
  const count = Math.max(80, Math.floor(360 * getEffectiveParticleScale()));
  const positions = new Float32Array(count * 3);
  const velocities = new Float32Array(count * 3);
  for (let index = 0; index < count; index += 1) {
    const direction = new THREE.Vector3().randomDirection();
    const speed = 1.5 + Math.random() * 5.5;
    positions[index * 3] = position.x + direction.x * 0.12;
    positions[index * 3 + 1] = position.y + direction.y * 0.12;
    positions[index * 3 + 2] = position.z + direction.z * 0.12;
    velocities[index * 3] = direction.x * speed;
    velocities[index * 3 + 1] = direction.y * speed * 0.55;
    velocities[index * 3 + 2] = direction.z * speed;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color,
    size: 0.16,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
    toneMapped: false,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  scene.add(points);
  planetDebris.push({ points, velocities, age: 0, lifetime: 3.4 });
}

function disposePlanet(planet: PlanetSystem): void {
  scene.remove(planet.mesh, planet.atmosphere, planet.orbitLine);
  planet.mesh.geometry.dispose();
  planet.mesh.material.dispose();
  planet.atmosphere.geometry.dispose();
  planet.atmosphere.material.dispose();
  planet.orbitLine.geometry.dispose();
  planet.orbitLine.material.dispose();
}

function spawnPlanet(): void {
  createPlanet(
    diskRadius + 3.4,
    1.05,
    0.31,
    (Math.random() - 0.5) * 0.42,
    new THREE.Color(0x3575a9),
    new THREE.Color(0x65bdc5),
    new THREE.Color(0x72dcff),
    0.045,
  );
}

spawnPlanetButton.addEventListener("click", spawnPlanet);
orbitLinesButton.addEventListener("click", () => {
  orbitLinesVisible = !orbitLinesVisible;
  orbitLinesButton.setAttribute("aria-pressed", String(orbitLinesVisible));
  orbitLinesButton.textContent = orbitLinesVisible ? "HIDE ORBIT LINES" : "SHOW ORBIT LINES";
  for (const planet of planets) planet.orbitLine.visible = orbitLinesVisible;
});

document.addEventListener("keydown", (event) => {
  const target = event.target;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
    return;
  }

  switch (event.key.toLowerCase()) {
    case "h":
      toggleUIVisibility();
      break;
    case "m":
      spawnMatter();
      break;
    case "p":
      spawnPlanet();
      break;
    case "g":
      hudGridButton.click();
      break;
    case "o":
      orbitLinesButton.click();
      break;
    case "c":
      cameraModeButtons.find((button) => button.getAttribute("aria-pressed") === "false")?.click();
      if (!cameraModeButtons.some((button) => button.getAttribute("aria-pressed") === "false")) {
        cameraModeButtons[0]?.click();
      }
      break;
    case "a":
      audioToggleButton.click();
      break;
    case "1":
    case "2":
    case "3":
      themeButtons[Number(event.key) - 1]?.click();
      break;
    case "q": {
      const current = qualityButtons.findIndex((button) => button.getAttribute("aria-pressed") === "true");
      qualityButtons[(current + 1) % qualityButtons.length]?.click();
      break;
    }
    case "escape":
      clearTrajectory();
      break;
  }
});

const colorThemes = {
  interstellar: {
    cool: new THREE.Color(0xe95b1c),
    hot: new THREE.Color(0xffc45d),
    core: new THREE.Color(0xfff0c2),
    jet: new THREE.Color(0xffb84c),
  },
  magnetar: {
    cool: new THREE.Color(0x087de0),
    hot: new THREE.Color(0x42d8ff),
    core: new THREE.Color(0xd8faff),
    jet: new THREE.Color(0x49dfff),
  },
  supernova: {
    cool: new THREE.Color(0xe51c45),
    hot: new THREE.Color(0xff4c9e),
    core: new THREE.Color(0xffd4ed),
    jet: new THREE.Color(0xff58ae),
  },
};

function applyColorTheme(name: keyof typeof colorThemes): void {
  const theme = colorThemes[name];
  diskMaterial.uniforms.uCoolColor.value.copy(theme.cool);
  diskMaterial.uniforms.uHotColor.value.copy(theme.hot);
  diskMaterial.uniforms.uCoreColor.value.copy(theme.core);
  outerDiskMaterial.uniforms.uCoolColor.value.copy(theme.cool);
  outerDiskMaterial.uniforms.uHotColor.value.copy(theme.hot);
  outerDiskMaterial.uniforms.uCoreColor.value.copy(theme.core);
  photonRingMaterial.uniforms.uCoolColor.value.copy(theme.cool);
  photonRingMaterial.uniforms.uHotColor.value.copy(theme.hot);
  lensingPass.uniforms.uLensColor.value.copy(theme.hot);
  const energyMaterial = energyParticles.material as THREE.ShaderMaterial;
  energyMaterial.uniforms.uCoolColor.value.copy(theme.cool);
  energyMaterial.uniforms.uHotColor.value.copy(theme.hot);
  jetMaterial.uniforms.uJetColor.value.copy(theme.jet);
  jetMaterial.uniforms.uCoreColor.value.copy(theme.core);

  for (const button of themeButtons) {
    button.setAttribute("aria-pressed", String(button.dataset.theme === name));
  }
}

for (const button of themeButtons) {
  button.addEventListener("click", () => {
    const name = button.dataset.theme as keyof typeof colorThemes;
    if (name in colorThemes) applyColorTheme(name);
  });
}
applyColorTheme("interstellar");

function updateSpinSpeed(): void {
  const speed = Number(spinSpeedSlider.value);
  diskMaterial.uniforms.uSpinSpeed.value = speed;
  outerDiskMaterial.uniforms.uSpinSpeed.value = speed;
  (energyParticles.material as THREE.ShaderMaterial).uniforms.uSpinSpeed.value = speed;
  spinValue.value = `${speed.toFixed(1)}x`;
  spinValue.textContent = `${speed.toFixed(1)}x`;
}

function updateParticleDensity(): void {
  const density = Number(particleDensitySlider.value) / 100 * getEffectiveParticleScale();
  particleGeometry.setDrawRange(0, Math.floor(energyParticleCount * density));
  jetGeometry.setDrawRange(0, Math.floor(jetParticleCount * density));
  const label = `${particleDensitySlider.value}%`;
  densityValue.value = label;
  densityValue.textContent = label;
}

function updateGalaxyDensity(): void {
  const density = Number(galaxyDensitySlider.value) / 100 * getEffectiveParticleScale();
  starGeometry.setDrawRange(0, Math.floor(starCount * density));
  cosmicDustGeometry.setDrawRange(0, Math.floor(cosmicDustCount * density));
  for (const galaxy of galaxySystems) {
    galaxy.geometry.setDrawRange(0, Math.floor(galaxy.particleCount * density));
  }
  const label = `${galaxyDensitySlider.value}%`;
  galaxyDensityValue.value = label;
  galaxyDensityValue.textContent = label;
}

function updatePlanetOrbitSpeed(): void {
  planetOrbitSpeed = Number(planetOrbitSpeedSlider.value);
  const label = `${planetOrbitSpeed.toFixed(1)}x`;
  planetSpeedValue.value = label;
  planetSpeedValue.textContent = label;
}

function selectQuality(button: HTMLButtonElement): void {
  const requestedQuality = button.dataset.quality;
  if (!requestedQuality || !(requestedQuality in qualityProfiles)) return;
  qualityMode = requestedQuality as QualityMode;
  adaptiveQualityScale = 1;
  consecutiveLowFpsFrames = 0;
  consecutiveHighFpsFrames = 0;
  for (const qualityButton of qualityButtons) {
    qualityButton.setAttribute("aria-pressed", String(qualityButton === button));
  }
  applyQualitySettings();
}

function applyQualitySettings(): void {
  const profile = qualityProfiles[qualityMode];
  bloomPass.strength = profile.bloomStrength;
  bloomPass.radius = profile.bloomRadius;
  bloomPass.threshold = profile.bloomThreshold;
  renderer.shadowMap.enabled = profile.shadowMapSize > 0;
  keyLight.castShadow = profile.shadowMapSize > 0;
  if (keyLight.shadow.mapSize.width !== profile.shadowMapSize) {
    keyLight.shadow.map?.dispose();
    keyLight.shadow.map = null;
    keyLight.shadow.mapSize.set(profile.shadowMapSize, profile.shadowMapSize);
  }
  asteroidMesh.count = Math.floor(asteroidCount * getEffectiveParticleScale());
  updateParticleDensity();
  updateGalaxyDensity();
  resizeScene();
}

spinSpeedSlider.addEventListener("input", updateSpinSpeed);
particleDensitySlider.addEventListener("input", updateParticleDensity);
galaxyDensitySlider.addEventListener("input", updateGalaxyDensity);
planetOrbitSpeedSlider.addEventListener("input", updatePlanetOrbitSpeed);
for (const button of qualityButtons) {
  button.addEventListener("click", () => selectQuality(button));
}
updateSpinSpeed();
applyQualitySettings();
updatePlanetOrbitSpeed();

function updateDiskControls(): void {
  const thickness = Number(diskThicknessSlider.value);
  const temperature = Number(coreTemperatureSlider.value);
  diskMaterial.uniforms.uDiskThickness.value = thickness;
  diskMaterial.uniforms.uCoreTemperature.value = temperature;
  outerDiskMaterial.uniforms.uDiskThickness.value = thickness * 1.22;
  outerDiskMaterial.uniforms.uCoreTemperature.value = temperature * 0.68;
  thicknessValue.value = `${thickness.toFixed(1)}x`;
  thicknessValue.textContent = `${thickness.toFixed(1)}x`;
  temperatureValue.value = `${temperature.toFixed(1)}x`;
  temperatureValue.textContent = `${temperature.toFixed(1)}x`;
}

function updateTurbulence(): void {
  const enabled = turbulenceToggle.getAttribute("aria-pressed") !== "true";
  turbulenceToggle.setAttribute("aria-pressed", String(enabled));
  turbulenceToggle.textContent = `TURBULENCE NOISE: ${enabled ? "ON" : "OFF"}`;
  diskMaterial.uniforms.uTurbulence.value = enabled ? 1 : 0;
  outerDiskMaterial.uniforms.uTurbulence.value = enabled ? 1 : 0;
}

diskThicknessSlider.addEventListener("input", updateDiskControls);
coreTemperatureSlider.addEventListener("input", updateDiskControls);
turbulenceToggle.addEventListener("click", updateTurbulence);
updateDiskControls();

hudGridButton.addEventListener("click", () => {
  const enabled = hudGridButton.getAttribute("aria-pressed") !== "true";
  hudGridButton.setAttribute("aria-pressed", String(enabled));
  hudGridOverlay.classList.toggle("is-visible", enabled);
});

photoModeButton.addEventListener("click", () => {
  const originalPixelRatio = renderer.getPixelRatio();
  document.body.classList.add("photo-capture");

  try {
    const photoPixelRatio = Math.min(Math.max(window.devicePixelRatio * 2, 2), 4);
    resizeScene();
    renderer.setPixelRatio(photoPixelRatio);
    renderer.setSize(container.clientWidth, container.clientHeight, false);
    composer.setPixelRatio(photoPixelRatio);
    composer.setSize(container.clientWidth, container.clientHeight);
    composer.render();

    const imageUrl = renderer.domElement.toDataURL("image/png");
    if (imageUrl === "data:,") throw new Error("The photo could not be exported.");
    const download = document.createElement("a");
    download.href = imageUrl;
    download.download = `event-horizon-${new Date().toISOString().replace(/[:.]/g, "-")}.png`;
    download.click();
  } catch (error) {
    console.error("Photo mode export failed:", error);
  } finally {
    document.body.classList.remove("photo-capture");
    composer.setPixelRatio(originalPixelRatio);
    resizeScene();
  }
});

interface CapturedMatter {
  mesh: THREE.Mesh<THREE.IcosahedronGeometry, THREE.MeshStandardMaterial>;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  initialRadius: number;
}

interface CapturePulse {
  mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  light: THREE.PointLight;
  age: number;
}

const capturedMatter: CapturedMatter[] = [];
const capturePulses: CapturePulse[] = [];
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const blackHoleCenter = new THREE.Vector3(0, 0, 0);
const projectedCenter = new THREE.Vector3();
const trajectorySegments = 240;
const trajectoryGeometry = new THREE.BufferGeometry();
const trajectoryPositions = new Float32Array(trajectorySegments * 3);
const trajectoryAttribute = new THREE.BufferAttribute(trajectoryPositions, 3);
trajectoryAttribute.setUsage(THREE.DynamicDrawUsage);
trajectoryGeometry.setAttribute("position", trajectoryAttribute);
trajectoryGeometry.setDrawRange(0, 0);
const trajectoryMaterial = new THREE.LineBasicMaterial({
  color: 0xffa74a,
  transparent: true,
  opacity: 0.88,
  depthTest: false,
  toneMapped: false,
});
const trajectoryLine = new THREE.Line(trajectoryGeometry, trajectoryMaterial);
trajectoryLine.frustumCulled = false;
trajectoryLine.renderOrder = 5;
scene.add(trajectoryLine);

interface LaunchState {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
}

function getLaunchState(event: Pick<MouseEvent, "clientX" | "clientY">): LaunchState {
  const bounds = renderer.domElement.getBoundingClientRect();
  pointer.set(
    ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
    -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
  );
  camera.updateMatrixWorld();
  raycaster.setFromCamera(pointer, camera);

  const position = new THREE.Vector3();
  const spawnRadius = diskRadius + 3.2;
  const spawnShell = new THREE.Sphere(blackHoleCenter, spawnRadius);
  if (!raycaster.ray.intersectSphere(spawnShell, position)) {
    raycaster.ray.at(camera.position.length() + spawnRadius, position);
  }

  const radialDirection = position.clone().normalize();
  const tangent = new THREE.Vector3(-radialDirection.z, 0, radialDirection.x);
  if (tangent.lengthSq() < 0.001) tangent.set(1, 0, 0);
  tangent.normalize();
  const launchSpeed = THREE.MathUtils.lerp(0.65, 3.15, (pointer.x + 1) * 0.5);
  const velocity = tangent.multiplyScalar(launchSpeed).addScaledVector(radialDirection, -0.35);
  return { position, velocity };
}

function updateTrajectory(event: PointerEvent): void {
  const launch = getLaunchState(event);
  const position = launch.position.clone();
  const velocity = launch.velocity.clone();
  const initialRadius = position.length();
  const step = 0.045;
  let pointCount = 0;
  let outcome: "capture" | "escape" = "capture";

  trajectoryPositions[0] = position.x;
  trajectoryPositions[1] = position.y;
  trajectoryPositions[2] = position.z;
  pointCount = 1;

  for (let index = 1; index < trajectorySegments; index += 1) {
    const distance = position.length();
    const gravity = position.clone().negate().normalize().multiplyScalar(32 / Math.max(distance * distance, 0.55));
    velocity.addScaledVector(gravity, step).clampLength(0, 24);
    position.addScaledVector(velocity, step);
    trajectoryPositions[index * 3] = position.x;
    trajectoryPositions[index * 3 + 1] = position.y;
    trajectoryPositions[index * 3 + 2] = position.z;
    pointCount += 1;

    if (position.length() <= horizonRadius) {
      outcome = "capture";
      break;
    }
    if (position.length() >= initialRadius * 1.8 && position.dot(velocity) > 0) {
      outcome = "escape";
      break;
    }
  }

  if (pointCount === trajectorySegments) {
    const specificEnergy = launch.velocity.lengthSq() * 0.5 - 32 / initialRadius;
    outcome = specificEnergy >= 0 ? "escape" : "capture";
  }

  trajectoryAttribute.needsUpdate = true;
  trajectoryGeometry.setDrawRange(0, pointCount);
  trajectoryGeometry.computeBoundingSphere();
  trajectoryMaterial.color.set(outcome === "capture" ? 0xffa74a : 0x62dcff);
  trajectoryOutput.textContent = outcome === "capture"
    ? "PREDICTED: EVENT HORIZON CAPTURE"
    : "PREDICTED: GRAVITATIONAL SLINGSHOT";
  trajectoryOutput.style.color = outcome === "capture" ? "#ffbd75" : "#8fe9ff";
  trajectoryLine.visible = true;
}

function clearTrajectory(): void {
  trajectoryLine.visible = false;
  trajectoryGeometry.setDrawRange(0, 0);
  trajectoryOutput.textContent = "MOVE POINTER TO PREDICT";
}

function spawnCapturePulse(position: THREE.Vector3): void {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 16, 16),
    new THREE.MeshBasicMaterial({
      color: 0x9beaff,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  mesh.position.copy(position);
  scene.add(mesh);

  const light = new THREE.PointLight(0x8bdfff, 16, 4, 2);
  light.position.copy(position);
  scene.add(light);
  capturePulses.push({ mesh, light, age: 0 });
}

function spawnMatter(event?: MouseEvent): void {
  const geometry = new THREE.IcosahedronGeometry(0.2, 2);
  const positions = geometry.getAttribute("position");
  for (let index = 0; index < positions.count; index += 1) {
    const jitter = 0.78 + Math.random() * 0.44;
    positions.setXYZ(
      index,
      positions.getX(index) * jitter,
      positions.getY(index) * jitter,
      positions.getZ(index) * jitter,
    );
  }
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    color: 0xf4c28a,
    emissive: 0xff4b0a,
    emissiveIntensity: 3.2,
    metalness: 0.55,
    roughness: 0.27,
  });
  const mesh = new THREE.Mesh(geometry, material);
  let position: THREE.Vector3;
  let velocity: THREE.Vector3;

  if (event) {
    const launch = getLaunchState(event);
    position = launch.position;
    velocity = launch.velocity;
  } else {
    const spawnRadius = diskRadius + 3.2;
    position = new THREE.Vector3().randomDirection().multiplyScalar(spawnRadius);
    const radialDirection = position.clone().normalize();
    const tangent = new THREE.Vector3(-radialDirection.z, 0, radialDirection.x);
    if (tangent.lengthSq() < 0.001) tangent.set(1, 0, 0);
    velocity = tangent.normalize().multiplyScalar(1.8).addScaledVector(radialDirection, -0.15);
  }

  mesh.position.copy(position);
  mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
  scene.add(mesh);
  capturedMatter.push({ mesh, position, velocity, initialRadius: position.length() });
}

function updateMass(): void {
  const mass = Number(massSlider.value);
  const massRatio = mass / 100;
  horizonRadius = 0.72 + massRatio * 0.9;
  diskRadius = 6.2 + massRatio * 2.4;
  blackHole.scale.setScalar(horizonRadius);
  photonRing.scale.setScalar(horizonRadius);
  disk.scale.setScalar(diskRadius);
  outerDisk.scale.setScalar(diskRadius * 1.22);
  for (let index = 0; index < asteroidCount; index += 1) {
    asteroidBelt.radii[index] = diskRadius + 1.1 + asteroidBelt.radialOffsets[index];
  }
  diskMaterial.uniforms.uInnerRadius.value = Math.min(0.55, (horizonRadius * 1.26) / diskRadius);
  jetMaterial.uniforms.uHorizonRadius.value = horizonRadius;
  massValue.value = `${mass}%`;
  massValue.textContent = `${mass}%`;
}

massSlider.addEventListener("input", updateMass);
updateMass();

spawnMatterButton.addEventListener("click", spawnMatter);
renderer.domElement.addEventListener("click", (event) => spawnMatter(event));
renderer.domElement.addEventListener("pointermove", updateTrajectory);
renderer.domElement.addEventListener("pointerleave", clearTrajectory);

let audioContext: AudioContext | null = null;
let droneGain: GainNode | null = null;
let droneOscillators: OscillatorNode[] = [];
let soundEnabled = false;
let audioUpdateClock = 0;

async function toggleSpaceAudio(): Promise<void> {
  if (!audioContext) {
    audioContext = new AudioContext();
    const filter = audioContext.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 180;
    filter.Q.value = 0.7;

    droneGain = audioContext.createGain();
    droneGain.gain.value = 0;
    filter.connect(droneGain);
    droneGain.connect(audioContext.destination);

    for (const [index, frequency] of [38, 56].entries()) {
      const oscillator = audioContext.createOscillator();
      const voiceGain = audioContext.createGain();
      oscillator.type = index === 0 ? "sine" : "triangle";
      oscillator.frequency.value = frequency;
      voiceGain.gain.value = index === 0 ? 0.72 : 0.24;
      oscillator.connect(voiceGain);
      voiceGain.connect(filter);
      oscillator.start();
      droneOscillators.push(oscillator);
    }
  }

  const context = audioContext;
  const masterGain = droneGain;
  if (!context || !masterGain) return;

  soundEnabled = !soundEnabled;
  await context.resume();
  masterGain.gain.cancelScheduledValues(context.currentTime);
  masterGain.gain.setTargetAtTime(soundEnabled ? 0.035 : 0, context.currentTime, 0.28);
  audioToggleButton.setAttribute("aria-pressed", String(soundEnabled));
  audioToggleButton.textContent = soundEnabled ? "SPACE AUDIO: ON" : "ENABLE SPACE AUDIO";
}

audioToggleButton.addEventListener("click", () => {
  void toggleSpaceAudio();
});

function resizeScene(): void {
  const width = container.clientWidth;
  const height = container.clientHeight;
  if (width === 0 || height === 0) return;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(getRendererPixelRatio());
  renderer.setSize(width, height, false);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(width, height);
  lensingPass.uniforms.uAspect.value = width / height;
}

window.addEventListener("resize", resizeScene);
const containerResizeObserver = new ResizeObserver(resizeScene);
containerResizeObserver.observe(container);

const clock = new THREE.Clock();
const parallaxTarget = new THREE.Vector2();
const parallaxCurrent = new THREE.Vector2();
let horizonElapsed = 0;
let hudUpdateClock = 0;

window.addEventListener("pointermove", (event) => {
  parallaxTarget.set(
    (event.clientX / window.innerWidth - 0.5) * 2,
    (event.clientY / window.innerHeight - 0.5) * 2,
  );
});

function formatElapsedTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const remainder = (seconds % 60).toFixed(1).padStart(4, "0");
  return `${minutes}:${remainder}`;
}

function monitorFrameRate(delta: number): void {
  fpsWindowFrames += 1;
  fpsWindowSeconds += delta;
  if (fpsWindowSeconds < 0.5) return;

  const measuredFps = fpsWindowFrames / fpsWindowSeconds;
  fpsAverage = fpsMeasurementCount === 0 ? measuredFps : fpsAverage * 0.7 + measuredFps * 0.3;
  fpsMeasurementCount += 1;
  const measuredFrames = fpsWindowFrames;
  fpsWindowFrames = 0;
  fpsWindowSeconds = 0;

  if (qualityMode !== "auto") return;

  if (fpsAverage < 30) {
    consecutiveLowFpsFrames += measuredFrames;
    consecutiveHighFpsFrames = 0;
  } else if (fpsAverage > 52) {
    consecutiveHighFpsFrames += measuredFrames;
    consecutiveLowFpsFrames = 0;
  } else {
    consecutiveLowFpsFrames = 0;
    consecutiveHighFpsFrames = 0;
  }

  const now = performance.now();
  if (consecutiveLowFpsFrames >= 60 && now - lastAdaptiveChange > 1200 && adaptiveQualityScale > 0.3) {
    adaptiveQualityScale = Math.max(0.3, adaptiveQualityScale * 0.78);
    consecutiveLowFpsFrames = 0;
    consecutiveHighFpsFrames = 0;
    lastAdaptiveChange = now;
    applyQualitySettings();
  } else if (consecutiveHighFpsFrames >= 600 && now - lastAdaptiveChange > 5000 && adaptiveQualityScale < 1) {
    adaptiveQualityScale = Math.min(1, adaptiveQualityScale + 0.08);
    consecutiveHighFpsFrames = 0;
    lastAdaptiveChange = now;
    applyQualitySettings();
  }
}

const planetForwardAxis = new THREE.Vector3(0, 0, 1);
const planetTangentScratch = new THREE.Vector3();
const debrisPositionScratch = new THREE.Vector3();
const debrisDirectionScratch = new THREE.Vector3();
const debrisVelocityScratch = new THREE.Vector3();

function updatePlanetSystems(delta: number, elapsedTime: number): void {
  for (let index = planets.length - 1; index >= 0; index -= 1) {
    const planet = planets[index];
    const criticalRadius = horizonRadius * 1.18 + planet.size * 0.55;
    const approachDistance = Math.max(planet.initialOrbitRadius - criticalRadius, 0.1);
    const proximity = THREE.MathUtils.clamp(
      (planet.initialOrbitRadius - planet.orbitRadius) / approachDistance,
      0,
      1,
    );

    if (planet.inspiralSpeed > 0) {
      planet.orbitRadius -= delta * (planet.inspiralSpeed + proximity * proximity * 1.4);
    }
    planet.angle += delta * planet.angularSpeed * planetOrbitSpeed
      * (1 + proximity * proximity * 1.8);

    const x = Math.cos(planet.angle) * planet.orbitRadius;
    const z = Math.sin(planet.angle) * planet.orbitRadius;
    const y = Math.sin(planet.angle * 0.7) * Math.sin(planet.inclination) * planet.orbitRadius;
    planet.mesh.position.set(x, y, z);
    planet.atmosphere.position.copy(planet.mesh.position);
    planet.mesh.rotation.y += delta * (0.12 + planet.angularSpeed * 0.35);
    (planet.mesh.material as THREE.ShaderMaterial).uniforms.uTime.value = elapsedTime;

    planetTangentScratch.set(-Math.sin(planet.angle), 0, Math.cos(planet.angle)).normalize();
    const stretch = proximity > 0.68 ? (proximity - 0.68) * 8 : 0;
    planet.mesh.quaternion.setFromUnitVectors(planetForwardAxis, planetTangentScratch);
    planet.mesh.scale.set(planet.size * (1 + stretch * 0.04), planet.size, planet.size * (1 + stretch));
    planet.atmosphere.scale.set(
      planet.size * (1.045 + stretch * 0.04),
      planet.size * 1.045,
      planet.size * (1.045 + stretch),
    );
    planet.orbitLine.scale.setScalar(planet.orbitRadius / planet.initialOrbitRadius);

    if (!planet.disintegrationStarted && planet.orbitRadius <= criticalRadius) {
      planet.disintegrationStarted = true;
      spawnPlanetDebris(planet.mesh.position, planet.baseColor);
      disposePlanet(planet);
      planets.splice(index, 1);
    }
  }

  for (let index = planetDebris.length - 1; index >= 0; index -= 1) {
    const debris = planetDebris[index];
    debris.age += delta;
    const positionAttribute = debris.points.geometry.getAttribute("position") as THREE.BufferAttribute;
    for (let particle = 0; particle < positionAttribute.count; particle += 1) {
      debrisPositionScratch.fromBufferAttribute(positionAttribute, particle);
      debrisDirectionScratch.copy(debrisPositionScratch).negate().normalize();
      const distance = Math.max(debrisPositionScratch.length(), 0.5);
      const acceleration = 22 / (distance * distance);
      debrisVelocityScratch.set(
        debris.velocities[particle * 3],
        debris.velocities[particle * 3 + 1],
        debris.velocities[particle * 3 + 2],
      ).addScaledVector(debrisDirectionScratch, acceleration * delta);
      debris.velocities[particle * 3] = debrisVelocityScratch.x;
      debris.velocities[particle * 3 + 1] = debrisVelocityScratch.y;
      debris.velocities[particle * 3 + 2] = debrisVelocityScratch.z;
      debrisPositionScratch.addScaledVector(debrisVelocityScratch, delta);
      positionAttribute.setXYZ(particle, debrisPositionScratch.x, debrisPositionScratch.y, debrisPositionScratch.z);
    }
    positionAttribute.needsUpdate = true;
    debris.points.material.opacity = Math.max(0, 1 - debris.age / debris.lifetime);

    if (debris.age >= debris.lifetime) {
      scene.remove(debris.points);
      debris.points.geometry.dispose();
      debris.points.material.dispose();
      planetDebris.splice(index, 1);
    }
  }
}

function updateAsteroidBelt(delta: number): void {
  for (let index = 0; index < asteroidMesh.count; index += 1) {
    const radius = asteroidBelt.radii[index];
    asteroidBelt.angles[index] += delta * (0.035 + 0.18 / Math.sqrt(radius));
    asteroidBelt.rotations[index] += delta;
    asteroidDummy.position.set(
      Math.cos(asteroidBelt.angles[index]) * radius,
      asteroidBelt.heights[index] + Math.sin(asteroidBelt.angles[index] * 2) * 0.035,
      Math.sin(asteroidBelt.angles[index]) * radius,
    );
    asteroidDummy.rotation.set(
      asteroidBelt.rotations[index] * asteroidBelt.spinX[index],
      asteroidBelt.rotations[index] * asteroidBelt.spinY[index],
      asteroidBelt.rotations[index] * asteroidBelt.spinZ[index],
    );
    asteroidDummy.scale.setScalar(asteroidBelt.sizes[index]);
    asteroidDummy.updateMatrix();
    asteroidMesh.setMatrixAt(index, asteroidDummy.matrix);
  }
  asteroidMesh.instanceMatrix.needsUpdate = true;
}

function animate(): void {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  monitorFrameRate(delta);
  controls.update();
  const parallaxBlend = 1 - Math.exp(-delta * 2.8);
  parallaxCurrent.lerp(parallaxTarget, parallaxBlend);
  camera.lookAt(
    controls.target.x + parallaxCurrent.x * 1.45,
    controls.target.y - parallaxCurrent.y * 0.85,
    controls.target.z,
  );

  const cameraDistance = camera.position.distanceTo(blackHoleCenter);
  const dilationProximity = THREE.MathUtils.clamp(
    1 - (cameraDistance - horizonRadius * 1.25) / (horizonRadius * 14),
    0,
    1,
  );
  const dilationRate = Math.max(0.015, 1 - dilationProximity * 0.985);
  horizonElapsed += delta * dilationRate;
  hudUpdateClock += delta;
  if (hudUpdateClock >= 0.1) {
    hudUpdateClock = 0;
    earthTimeOutput.value = formatElapsedTime(clock.elapsedTime);
    horizonTimeOutput.value = formatElapsedTime(horizonElapsed);
    dilationRateOutput.value = `${dilationRate.toFixed(2)}x`;
  }

  starfield.rotation.y += delta * 0.003;
  cosmicDust.rotation.y += delta * 0.0008;
  outerDiskMaterial.uniforms.uTime.value = clock.elapsedTime;
  for (const galaxy of galaxySystems) {
    galaxy.group.rotation.y += delta * galaxy.rotationSpeed;
    galaxy.group.position.copy(galaxy.basePosition).addScaledVector(camera.position, galaxy.parallax);
  }
  diskMaterial.uniforms.uTime.value = clock.elapsedTime;
  (energyParticles.material as THREE.ShaderMaterial).uniforms.uTime.value = clock.elapsedTime;
  jetMaterial.uniforms.uTime.value = clock.elapsedTime;
  lensingPass.uniforms.uTime.value = clock.elapsedTime;
  projectedCenter.copy(blackHoleCenter).project(camera);
  const centerX = (projectedCenter.x + 1) * 0.5;
  const centerY = (1 - projectedCenter.y) * 0.5;
  lensingPass.uniforms.uCenter.value.set(centerX, centerY);
  hudGridOverlay.style.setProperty("--hud-x", `${centerX * 100}%`);
  hudGridOverlay.style.setProperty("--hud-y", `${centerY * 100}%`);
  lensingPass.uniforms.uAspect.value = container.clientWidth / container.clientHeight;
  const einsteinRadius = THREE.MathUtils.clamp(
    horizonRadius * 1.65 / (2 * cameraDistance * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))),
    0.018,
    0.16,
  );
  lensingPass.uniforms.uEinsteinRadius.value = einsteinRadius;
  lensingPass.uniforms.uRingWidth.value = einsteinRadius * 0.09 + 0.001;
  lensingPass.uniforms.uStrength.value = einsteinRadius * einsteinRadius * 0.72;
  const observerDirection = diskMaterial.uniforms.uObserverDirection.value;
  observerDirection.set(camera.position.x, camera.position.z);
  if (observerDirection.lengthSq() < 0.001) observerDirection.set(0, 1);
  observerDirection.normalize();

  if (audioContext && droneGain && soundEnabled) {
    audioUpdateClock += delta;
    if (audioUpdateClock >= 0.08) {
      audioUpdateClock = 0;
      const distance = camera.position.distanceTo(blackHoleCenter);
      const closeness = 1 - THREE.MathUtils.clamp((distance - 2) / 40, 0, 1);
      const frequency = 34 + closeness * 34;
      const now = audioContext.currentTime;
      droneOscillators[0].frequency.setTargetAtTime(frequency, now, 0.12);
      droneOscillators[1].frequency.setTargetAtTime(frequency * 1.47, now, 0.12);
      droneGain.gain.setTargetAtTime(0.022 + closeness * 0.04, now, 0.12);
    }
  }

  updatePlanetSystems(delta, clock.elapsedTime);
  updateAsteroidBelt(delta);

  for (let index = capturedMatter.length - 1; index >= 0; index -= 1) {
    const matter = capturedMatter[index];
    const distance = matter.position.length();
    const gravityDirection = matter.position.clone().negate().normalize();
    const gravitationalAcceleration = 32 / Math.max(distance * distance, 0.55);
    matter.velocity.addScaledVector(gravityDirection, gravitationalAcceleration * delta);
    matter.velocity.clampLength(0, 24);
    matter.position.addScaledVector(matter.velocity, delta);

    const updatedDistance = matter.position.length();
    const proximity = THREE.MathUtils.clamp(
      (matter.initialRadius - updatedDistance) / (matter.initialRadius - horizonRadius),
      0,
      1,
    );
    matter.mesh.position.copy(matter.position);
    matter.mesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      matter.velocity.clone().normalize(),
    );
    matter.mesh.scale.set(1, 1, 1 + proximity * 8.0);
    matter.mesh.material.emissiveIntensity = 3.2 + proximity * 5.0;

    if (updatedDistance <= horizonRadius) {
      spawnCapturePulse(matter.position);
      scene.remove(matter.mesh);
      matter.mesh.geometry.dispose();
      matter.mesh.material.dispose();
      capturedMatter.splice(index, 1);
    }
  }

  for (let index = capturePulses.length - 1; index >= 0; index -= 1) {
    const pulse = capturePulses[index];
    pulse.age += delta;
    const life = THREE.MathUtils.clamp(1 - pulse.age / 0.42, 0, 1);
    pulse.mesh.scale.setScalar(1 + pulse.age * 7);
    pulse.mesh.material.opacity = life;
    pulse.light.intensity = life * 16;
    pulse.light.distance = 4 + pulse.age * 8;

    if (life === 0) {
      scene.remove(pulse.mesh, pulse.light);
      pulse.mesh.geometry.dispose();
      pulse.mesh.material.dispose();
      capturePulses.splice(index, 1);
    }
  }

  composer.render();
}

animate();
