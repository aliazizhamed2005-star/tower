import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  AnimationSettings,
  AppStage,
  ElevationAtmosphere,
  ExtractedScene,
  FloorHotspot,
  ImageBounds,
} from '../types/architecture';

interface ThreeZoomPortalProps {
  stage: AppStage;
  selectedFloor: FloorHotspot | null;
  targetScene: ExtractedScene | null;
  elevationSrc: string;
  atmosphere: ElevationAtmosphere;
  stageRef: React.RefObject<HTMLDivElement | null>;
  boundsRef: React.MutableRefObject<ImageBounds>;
  animation: AnimationSettings;
  onZoomComplete: () => void;
  onReturnComplete: () => void;
}

const isSoftwareGl = (() => {
  if (typeof document === 'undefined') return false;
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2') || probe.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
})();

const imageCache = new Map<string, Promise<HTMLImageElement>>();

export function warmImageAsset(src: string | undefined): Promise<HTMLImageElement> | null {
  if (!src || typeof Image === 'undefined') return null;
  const existing = imageCache.get(src);
  if (existing) return existing;

  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = async () => {
      try {
        if (typeof img.decode === 'function') {
          await img.decode();
        }
      } catch {
        // Fallback smoothly if decode throws on cached blob
      }
      resolve(img);
    };
    img.onerror = () => {
      imageCache.delete(src);
      reject(new Error(`Unable to load 3D portal texture: ${src}`));
    };
    img.src = src;
  });

  imageCache.set(src, promise);
  return promise;
}

function captureElevationSnapshot(
  stageEl: HTMLDivElement | null,
  fallbackImg: HTMLImageElement
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const videoEl = stageEl?.querySelector('video');

  if (videoEl && videoEl.readyState >= 2 && videoEl.videoWidth > 0 && videoEl.videoHeight > 0) {
    canvas.width = videoEl.videoWidth;
    canvas.height = videoEl.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
      return canvas;
    }
  }

  canvas.width = Math.max(1, fallbackImg.naturalWidth || 1280);
  canvas.height = Math.max(1, fallbackImg.naturalHeight || 720);
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.drawImage(fallbackImg, 0, 0, canvas.width, canvas.height);
  }
  return canvas;
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / Math.max(1e-5, edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// Reusable math objects outside animation loop (zero per-frame GC)
const _camTarget = new THREE.Vector3();
const _upVec = new THREE.Vector3(0, 1, 0);

const TOWER_VERTEX_SHADER = `
uniform float uRelief;
uniform vec4 uFloorRect; // xMin, xMax, yMin, yMax in 0..1 bottom-left UV

varying vec2 vUv;
varying float vDepthLayer;

void main() {
  vUv = uv;
  vec3 pos = position;

  // Approximate the architectural prism silhouette of the tower (center shaft + tapering crown + podium)
  float xCenter = 0.505;
  float halfShaft = mix(0.245, 0.125, smoothstep(0.08, 0.92, uv.y));
  float towerXMask = 1.0 - smoothstep(halfShaft - 0.04, halfShaft + 0.05, abs(uv.x - xCenter));
  float towerYMask = smoothstep(0.0, 0.04, uv.y) * (1.0 - smoothstep(0.92, 0.98, uv.y));
  float inTower = towerXMask * towerYMask;

  // Wide lower podium plinth steps subtly forward
  float podiumMask = (1.0 - smoothstep(0.21, 0.27, abs(uv.x - 0.50))) * (1.0 - smoothstep(0.06, 0.12, uv.y));

  // Convex architectural prism spine so straight diagrid facets read cleanly in 3D perspective
  float prismFacet = clamp(1.0 - abs(uv.x - 0.515) / max(0.08, halfShaft), 0.0, 1.0);
  float towerZ = inTower * mix(0.22, 0.58, prismFacet) + podiumMask * 0.22;

  // Background sky settles deep behind the skyscraper (-Z), while outer foreground tree canopies sit closer (+Z)
  float outerSide = smoothstep(0.22, 0.34, abs(uv.x - 0.50));
  float treeZoneLeft = (1.0 - smoothstep(0.24, 0.37, uv.x)) * smoothstep(0.26, 0.44, uv.y);
  float treeZoneRight = smoothstep(0.68, 0.78, uv.x) * (1.0 - smoothstep(0.32, 0.55, uv.y));
  float foregroundTrees = clamp(treeZoneLeft + treeZoneRight, 0.0, 1.0) * (1.0 - inTower);

  float skyZ = (1.0 - inTower) * (1.0 - podiumMask) * (1.0 - foregroundTrees) * (-0.36);
  float treeZ = foregroundTrees * (0.95 + outerSide * 0.35);

  // Flatten displacement around the selected floor bay cleanly to FLOOR_Z (0.52) so the 3D window box fits flush
  vec2 floorCenter = vec2((uFloorRect.x + uFloorRect.y) * 0.5, (uFloorRect.z + uFloorRect.w) * 0.5);
  vec2 floorHalf = max(vec2(0.03), vec2(uFloorRect.y - uFloorRect.x, uFloorRect.w - uFloorRect.z) * 0.5);
  vec2 dFloor = max(abs(uv - floorCenter) - floorHalf, vec2(0.0));
  float nearWindow = 1.0 - smoothstep(0.0, 0.09, length(dFloor));

  float rawZ = mix(skyZ + towerZ + treeZ, 0.52, nearWindow);
  pos.z += rawZ * uRelief;
  vDepthLayer = rawZ;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;

const TOWER_FRAGMENT_SHADER = `
uniform sampler2D tMap;
uniform float uBrightness;
uniform float uContrast;
uniform float uPortalOpen;
uniform vec4 uFloorRect; // xMin, xMax, yMin, yMax

varying vec2 vUv;
varying float vDepthLayer;

void main() {
  vec4 texel = texture2D(tMap, vUv);

  // Match CSS brightness(...) contrast(...) calibration order cleanly
  vec3 color = texel.rgb * uBrightness;
  color = clamp((color - 0.5) * uContrast + 0.5, 0.0, 1.0);

  // Clean antialiased window glazing cutout matching the target floor bay
  vec2 center = vec2((uFloorRect.x + uFloorRect.y) * 0.5, (uFloorRect.z + uFloorRect.w) * 0.5);
  vec2 halfSize = vec2(uFloorRect.y - uFloorRect.x, uFloorRect.w - uFloorRect.z) * 0.5 * 0.92;
  vec2 distEdge = abs(vUv - center) - halfSize;
  float sdBox = length(max(distEdge, 0.0)) + min(max(distEdge.x, distEdge.y), 0.0);

  // Soft aperture feather right around window glazing jamb
  float insideWindow = 1.0 - smoothstep(-0.0025, 0.0025, sdBox);
  float alpha = 1.0 - insideWindow * uPortalOpen;

  // Warm champagne interior rim spill on surrounding glazing sill as window opens
  float sillGlow = smoothstep(0.025, 0.0, max(sdBox, 0.0)) * (1.0 - insideWindow) * uPortalOpen;
  color = mix(color, color + vec3(0.16, 0.13, 0.08), sillGlow * 0.55);

  if (alpha < 0.02) {
    discard;
  }

  gl_FragColor = vec4(color, alpha);
}
`;

const GLASS_FRAGMENT_SHADER = `
uniform float uGlintOffset;
uniform float uGlassOpacity;
varying vec2 vUv;

void main() {
  // Diagonal low-iron glass sky reflection & Fresnel rim sheen
  float diag = (vUv.x * 0.72 + vUv.y * 0.68) - uGlintOffset;
  float band1 = exp(-pow((diag - 0.05) * 7.5, 2.0));
  float band2 = exp(-pow((diag + 0.22) * 14.0, 2.0)) * 0.55;

  vec2 edge = abs(vUv - 0.5) * 2.0;
  float fresnel = pow(max(edge.x, edge.y), 3.0);

  vec3 tint = mix(vec3(0.76, 0.84, 0.92), vec3(0.95, 0.89, 0.78), band1);
  float alpha = clamp((0.14 + band1 * 0.34 + band2 * 0.22 + fresnel * 0.22) * uGlassOpacity, 0.0, 0.72);

  gl_FragColor = vec4(tint, alpha);
}
`;

const INTERIOR_VERTEX_SHADER = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const INTERIOR_FRAGMENT_SHADER = `
uniform sampler2D tMap;
uniform float uRoomReveal; // 0..1 opens clipped inner slice smoothly to full room after passing window frame
varying vec2 vUv;

void main() {
  vec4 texel = texture2D(tMap, vUv);

  // While camera is still outside tower, confine room texture strictly behind the central bay
  // so edges can never peek past a narrow portrait skyscraper silhouette, then open seamlessly inside
  vec2 halfOpen = mix(vec2(0.28, 0.24), vec2(0.55, 0.55), uRoomReveal);
  vec2 d = abs(vUv - 0.5) - halfOpen;
  float mask = 1.0 - smoothstep(-0.04, 0.04, max(d.x, d.y));

  gl_FragColor = vec4(texel.rgb, mask);
}
`;

export const ThreeZoomPortal: React.FC<ThreeZoomPortalProps> = ({
  stage,
  selectedFloor,
  targetScene,
  elevationSrc,
  atmosphere,
  stageRef,
  boundsRef,
  animation,
  onZoomComplete,
  onReturnComplete,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lastFloorRef = useRef<FloorHotspot | null>(selectedFloor);
  const lastSceneRef = useRef<ExtractedScene | null>(targetScene);

  const callbacksRef = useRef({ onZoomComplete, onReturnComplete });
  callbacksRef.current = { onZoomComplete, onReturnComplete };

  if (selectedFloor) lastFloorRef.current = selectedFloor;
  if (targetScene) lastSceneRef.current = targetScene;

  // Pre-warm elevation & scene assets gently in background
  useEffect(() => {
    warmImageAsset(elevationSrc);
  }, [elevationSrc]);

  useEffect(() => {
    if (targetScene?.blobUrl) {
      warmImageAsset(targetScene.blobUrl);
    }
  }, [targetScene?.blobUrl]);

  useEffect(() => {
    if (stage !== 'zooming' && stage !== 'returning') {
      return;
    }

    const mountEl = containerRef.current;
    const floor = selectedFloor || lastFloorRef.current;
    const sceneItem = targetScene || lastSceneRef.current;
    if (!mountEl || !floor || !sceneItem) {
      if (stage === 'zooming') callbacksRef.current.onZoomComplete();
      else callbacksRef.current.onReturnComplete();
      return;
    }

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      const timer = window.setTimeout(() => {
        if (stage === 'zooming') callbacksRef.current.onZoomComplete();
        else callbacksRef.current.onReturnComplete();
      }, 240);
      return () => window.clearTimeout(timer);
    }

    let cancelled = false;
    let rafId = 0;
    let pollTimerId = 0;
    let renderer: THREE.WebGLRenderer | null = null;
    let scene: THREE.Scene | null = null;
    let envTexture: THREE.Texture | null = null;
    let towerTexture: THREE.Texture | null = null;
    let interiorTexture: THREE.Texture | null = null;
    const disposables: { dispose: () => void }[] = [];

    const start3DFlyThrough = async () => {
      let elevImg: HTMLImageElement;
      let roomImg: HTMLImageElement;

      try {
        const [loadedElev, loadedRoom] = await Promise.all([
          warmImageAsset(elevationSrc)!,
          warmImageAsset(sceneItem.blobUrl)!,
        ]);
        elevImg = loadedElev;
        roomImg = loadedRoom;
      } catch {
        if (!cancelled) {
          if (stage === 'zooming') callbacksRef.current.onZoomComplete();
          else callbacksRef.current.onReturnComplete();
        }
        return;
      }

      if (cancelled || !mountEl) return;

      // Capture exact live video frame (or poster fallback) synchronously at launch
      const snapshotCanvas = captureElevationSnapshot(stageRef.current, elevImg);
      towerTexture = new THREE.CanvasTexture(snapshotCanvas);
      towerTexture.minFilter = THREE.LinearFilter;
      towerTexture.magFilter = THREE.LinearFilter;
      towerTexture.generateMipmaps = false;

      interiorTexture = new THREE.Texture(roomImg);
      interiorTexture.needsUpdate = true;
      interiorTexture.minFilter = THREE.LinearFilter;
      interiorTexture.magFilter = THREE.LinearFilter;
      interiorTexture.generateMipmaps = false;

      try {
        renderer = new THREE.WebGLRenderer({
          antialias: !isSoftwareGl,
          alpha: false,
          powerPreference: 'high-performance',
        });
      } catch {
        if (!cancelled) {
          if (stage === 'zooming') callbacksRef.current.onZoomComplete();
          else callbacksRef.current.onReturnComplete();
        }
        return;
      }

      const width = Math.max(1, mountEl.clientWidth || window.innerWidth);
      const height = Math.max(1, mountEl.clientHeight || window.innerHeight);
      const aspect = width / height;

      renderer.setSize(width, height);
      renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      renderer.setClearColor(0x0b0c0e, 1);

      const maxAniso = renderer.capabilities.getMaxAnisotropy();
      towerTexture.anisotropy = maxAniso;
      interiorTexture.anisotropy = maxAniso;

      const domCanvas = renderer.domElement;
      domCanvas.style.display = 'block';
      domCanvas.style.width = '100%';
      domCanvas.style.height = '100%';
      mountEl.appendChild(domCanvas);

      const handleContextLost = (e: Event) => {
        e.preventDefault();
        cancelled = true;
        if (stage === 'zooming') callbacksRef.current.onZoomComplete();
        else callbacksRef.current.onReturnComplete();
      };
      domCanvas.addEventListener('webglcontextlost', handleContextLost);

      scene = new THREE.Scene();
      scene.background = new THREE.Color(0x0b0c0e);

      // Studio metallic environment reflection for 3D steel diagrid mullions & trim
      const pmrem = new THREE.PMREMGenerator(renderer);
      const envScene = new RoomEnvironment();
      envTexture = pmrem.fromScene(envScene, 0.04).texture;
      scene.environment = envTexture;
      envScene.dispose();
      pmrem.dispose();

      // Balanced 3-point warm/cool architectural lighting for the 3D window frame & reveal
      const hemi = new THREE.HemisphereLight(0xcdd8e8, 0x26211c, 0.9);
      scene.add(hemi);
      const sunKey = new THREE.DirectionalLight(0xfff1dc, 1.85);
      sunKey.position.set(5, 8, 7);
      scene.add(sunKey);
      const interiorGlow = new THREE.PointLight(0xffdfb0, 2.2, 8, 1.4);
      scene.add(interiorGlow);

      // Exact pixel-matched world geometry calibrated to TowerElevation bounds
      const FOV_START = 44;
      const FOV_MID = 36;
      const FOV_END = 48;
      const Z_START = 10;
      const FLOOR_Z = 0.52;
      const CAM_END_Z = -0.85;
      const ROOM_DIST = 2.6;
      const ROOM_Z = CAM_END_Z - ROOM_DIST; // -3.45

      const camera = new THREE.PerspectiveCamera(FOV_START, aspect, 0.05, 100);
      camera.position.set(0, 0, Z_START);
      camera.lookAt(0, 0, 0);

      const H0 = 2 * Z_START * Math.tan(THREE.MathUtils.degToRad(FOV_START * 0.5));
      const W0 = H0 * aspect;

      const bounds = boundsRef.current;
      const cW = Math.max(1, bounds.containerWidth || width);
      const cH = Math.max(1, bounds.containerHeight || height);

      const towerWorldW = (bounds.width / cW) * W0;
      const towerWorldH = (bounds.height / cH) * H0;
      const boundsCenterX = ((bounds.left + bounds.width * 0.5) / cW - 0.5) * W0;
      const boundsCenterY = -((bounds.top + bounds.height * 0.5) / cH - 0.5) * H0;

      // Exact 3D world center & dimensions of the clicked floor bay
      const floorCenterU = floor.zoomTargetX;
      const floorCenterV = 1 - floor.zoomTargetY;
      const floorHalfU = Math.max(0.055, floor.width * 0.44);
      const floorHalfV = Math.max(0.032, floor.height * 0.46);
      const floorRect = new THREE.Vector4(
        floorCenterU - floorHalfU,
        floorCenterU + floorHalfU,
        floorCenterV - floorHalfV,
        floorCenterV + floorHalfV
      );

      const floorWorldX = boundsCenterX + (floorCenterU - 0.5) * towerWorldW;
      const floorWorldY = boundsCenterY + (floorCenterV - 0.5) * towerWorldH;
      const floorWorldW = floorHalfU * 2 * towerWorldW;
      const floorWorldH = floorHalfV * 2 * towerWorldH;

      interiorGlow.position.set(floorWorldX, floorWorldY, FLOOR_Z - 1.2);

      // 1. Wide blurred sky extension backdrop so ultrawide/mobile edges match TowerElevation
      const skySkirtGeo = new THREE.PlaneGeometry(W0 * 1.4, H0 * 1.4);
      const skySkirtMat = new THREE.ShaderMaterial({
        uniforms: {
          tMap: { value: towerTexture },
          uBrightness: { value: atmosphere.brightness },
          uContrast: { value: atmosphere.contrast },
        },
        vertexShader: INTERIOR_VERTEX_SHADER,
        fragmentShader: `
          uniform sampler2D tMap;
          uniform float uBrightness;
          uniform float uContrast;
          varying vec2 vUv;
          void main() {
            vec3 c = texture2D(tMap, vUv).rgb * uBrightness;
            c = clamp((c - 0.5) * uContrast + 0.5, 0.0, 1.0);
            gl_FragColor = vec4(c * 0.24, 1.0);
          }
        `,
        depthWrite: false,
      });
      const skySkirtMesh = new THREE.Mesh(skySkirtGeo, skySkirtMat);
      skySkirtMesh.position.set(0, 0, -0.45);
      scene.add(skySkirtMesh);
      disposables.push(skySkirtGeo, skySkirtMat);

      // 2. 3D Sculpted Architectural Tower Elevation Plane
      const segX = isSoftwareGl ? 64 : 128;
      const segY = isSoftwareGl ? 48 : 96;
      const towerGeo = new THREE.PlaneGeometry(towerWorldW, towerWorldH, segX, segY);
      const towerMat = new THREE.ShaderMaterial({
        uniforms: {
          tMap: { value: towerTexture },
          uBrightness: { value: atmosphere.brightness },
          uContrast: { value: atmosphere.contrast },
          uRelief: { value: stage === 'returning' ? 1 : 0 },
          uPortalOpen: { value: stage === 'returning' ? 1 : 0 },
          uFloorRect: { value: floorRect },
        },
        vertexShader: TOWER_VERTEX_SHADER,
        fragmentShader: TOWER_FRAGMENT_SHADER,
        transparent: true,
        side: THREE.DoubleSide,
      });
      const towerMesh = new THREE.Mesh(towerGeo, towerMat);
      towerMesh.position.set(boundsCenterX, boundsCenterY, 0);
      towerMesh.renderOrder = 2;
      scene.add(towerMesh);
      disposables.push(towerGeo, towerMat);

      // 3. Real 3D Steel Diagrid Window Frame, Recessed Architectural Reveal & Glass Pane
      const windowGroup = new THREE.Group();
      windowGroup.position.set(floorWorldX, floorWorldY, FLOOR_Z);
      scene.add(windowGroup);

      const steelMat = new THREE.MeshStandardMaterial({
        color: 0x191c22,
        metalness: 0.88,
        roughness: 0.24,
        transparent: true,
        opacity: 1,
      });
      const trimGoldMat = new THREE.MeshStandardMaterial({
        color: 0xc8a96e,
        metalness: 0.85,
        roughness: 0.28,
        transparent: true,
        opacity: 1,
      });
      const revealWallMat = new THREE.MeshStandardMaterial({
        color: 0x22201e,
        metalness: 0.15,
        roughness: 0.72,
        side: THREE.BackSide,
        transparent: true,
        opacity: 1,
      });
      disposables.push(steelMat, trimGoldMat, revealWallMat);

      const beamThick = Math.max(0.032, floorWorldH * 0.065);
      const beamDepth = 0.26;
      const frameW = floorWorldW * 0.94;
      const frameH = floorWorldH * 0.94;

      // Perimeter transoms & jambs
      const topBeamGeo = new THREE.BoxGeometry(frameW + beamThick, beamThick, beamDepth);
      const sideBeamGeo = new THREE.BoxGeometry(beamThick, frameH, beamDepth);
      const topBeam = new THREE.Mesh(topBeamGeo, steelMat);
      topBeam.position.set(0, frameH * 0.5, -beamDepth * 0.35);
      topBeam.renderOrder = 3;
      const botBeam = new THREE.Mesh(topBeamGeo, steelMat);
      botBeam.position.set(0, -frameH * 0.5, -beamDepth * 0.35);
      botBeam.renderOrder = 3;
      const leftBeam = new THREE.Mesh(sideBeamGeo, steelMat);
      leftBeam.position.set(-frameW * 0.5, 0, -beamDepth * 0.35);
      leftBeam.renderOrder = 3;
      const rightBeam = new THREE.Mesh(sideBeamGeo, steelMat);
      rightBeam.position.set(frameW * 0.5, 0, -beamDepth * 0.35);
      rightBeam.renderOrder = 3;
      windowGroup.add(topBeam, botBeam, leftBeam, rightBeam);
      disposables.push(topBeamGeo, sideBeamGeo);

      // Subtle inner champagne-bronze architectural sill trim
      const sillTrimGeo = new THREE.BoxGeometry(frameW * 0.98, beamThick * 0.35, 0.34);
      const sillTrim = new THREE.Mesh(sillTrimGeo, trimGoldMat);
      sillTrim.position.set(0, -frameH * 0.5 + beamThick * 0.5, -0.18);
      sillTrim.renderOrder = 3;
      windowGroup.add(sillTrim);
      disposables.push(sillTrimGeo);

      // Flanking signature 45-deg steel diagrid struts that sweep out past edges during entry
      const diagLen = Math.hypot(frameW * 0.42, frameH * 1.15);
      const diagGeo = new THREE.BoxGeometry(beamThick * 0.85, diagLen, beamDepth * 0.8);
      const diagAngle = Math.atan2(frameW * 0.35, frameH);
      const diagPositions = [-frameW * 0.34, frameW * 0.34];
      diagPositions.forEach((px, idx) => {
        const strut = new THREE.Mesh(diagGeo, steelMat);
        strut.position.set(px, 0, -0.04);
        strut.rotation.z = idx === 0 ? diagAngle : -diagAngle;
        strut.renderOrder = 3;
        windowGroup.add(strut);
      });
      disposables.push(diagGeo);

      // 4 open architectural reveal walls (soffit, stone sill, left/right jambs — open front & back)
      revealWallMat.side = THREE.DoubleSide;
      const tunnelDepth = 1.25;
      const horizWallGeo = new THREE.PlaneGeometry(frameW * 0.98, tunnelDepth);
      const vertWallGeo = new THREE.PlaneGeometry(tunnelDepth, frameH * 0.98);

      const ceilingSoffit = new THREE.Mesh(horizWallGeo, revealWallMat);
      ceilingSoffit.rotation.x = Math.PI * 0.5;
      ceilingSoffit.position.set(0, frameH * 0.485, -tunnelDepth * 0.5);
      ceilingSoffit.renderOrder = 3;

      const floorSill = new THREE.Mesh(horizWallGeo, revealWallMat);
      floorSill.rotation.x = -Math.PI * 0.5;
      floorSill.position.set(0, -frameH * 0.485, -tunnelDepth * 0.5);
      floorSill.renderOrder = 3;

      const leftJamb = new THREE.Mesh(vertWallGeo, revealWallMat);
      leftJamb.rotation.y = Math.PI * 0.5;
      leftJamb.position.set(-frameW * 0.485, 0, -tunnelDepth * 0.5);
      leftJamb.renderOrder = 3;

      const rightJamb = new THREE.Mesh(vertWallGeo, revealWallMat);
      rightJamb.rotation.y = -Math.PI * 0.5;
      rightJamb.position.set(frameW * 0.485, 0, -tunnelDepth * 0.5);
      rightJamb.renderOrder = 3;

      windowGroup.add(ceilingSoffit, floorSill, leftJamb, rightJamb);
      disposables.push(horizWallGeo, vertWallGeo);

      // Reflective low-iron architectural glass pane across the facade opening
      const glassGeo = new THREE.PlaneGeometry(frameW * 0.96, frameH * 0.96);
      const glassMat = new THREE.ShaderMaterial({
        uniforms: {
          uGlintOffset: { value: -0.2 },
          uGlassOpacity: { value: 0 },
        },
        vertexShader: INTERIOR_VERTEX_SHADER,
        fragmentShader: GLASS_FRAGMENT_SHADER,
        transparent: true,
        depthWrite: false,
      });
      const glassMesh = new THREE.Mesh(glassGeo, glassMat);
      glassMesh.position.set(0, 0, 0.015);
      glassMesh.renderOrder = 4;
      windowGroup.add(glassMesh);
      disposables.push(glassGeo, glassMat);

      // 4. Full-Bleed Interior Suite Plane (pixel-exact match at CAM_END_Z = -0.85)
      const H1 = 2 * ROOM_DIST * Math.tan(THREE.MathUtils.degToRad(FOV_END * 0.5));
      const W1 = H1 * aspect;
      const roomImgAspect = (roomImg.naturalWidth || 16) / Math.max(1, roomImg.naturalHeight || 9);
      let roomMeshW: number;
      let roomMeshH: number;
      if (roomImgAspect >= aspect) {
        roomMeshH = H1;
        roomMeshW = H1 * roomImgAspect;
      } else {
        roomMeshW = W1;
        roomMeshH = W1 / roomImgAspect;
      }

      const interiorGeo = new THREE.PlaneGeometry(roomMeshW, roomMeshH);
      const interiorMat = new THREE.ShaderMaterial({
        uniforms: {
          tMap: { value: interiorTexture },
          uRoomReveal: { value: stage === 'returning' ? 1 : 0 },
        },
        vertexShader: INTERIOR_VERTEX_SHADER,
        fragmentShader: INTERIOR_FRAGMENT_SHADER,
        transparent: true,
        depthWrite: true,
      });
      const interiorMesh = new THREE.Mesh(interiorGeo, interiorMat);
      interiorMesh.position.set(floorWorldX, floorWorldY, ROOM_Z);
      interiorMesh.renderOrder = 1;
      scene.add(interiorMesh);
      disposables.push(interiorGeo, interiorMat);

      // Pre-compile WebGL shaders once on GPU
      if (!isSoftwareGl) {
        renderer.compile(scene, camera);
      }

      // Compute graceful 3D curved drone path (arc off-axis during facade approach, level cleanly into room)
      const sideSign = floorWorldX >= boundsCenterX ? 1 : -1;
      const arcOffsetX = sideSign * Math.min(0.95, towerWorldW * 0.09);
      const arcOffsetY = -Math.min(0.45, towerWorldH * 0.045);

      const durationMs = Math.max(
        750,
        (stage === 'zooming' ? animation.zoomDuration : animation.returnDuration) * 1000
      );
      const startTime = performance.now();

      const applyProgress = (rawT: number) => {
        const p = easeInOutCubic(rawT);

        // 3D position curve: arcs sideways & slightly low during approach, then threads squarely through the window
        const approachArc = Math.sin(Math.min(1, p / 0.72) * Math.PI);
        const camX =
          THREE.MathUtils.lerp(0, floorWorldX, smoothstep(0.0, 0.72, p)) +
          arcOffsetX * approachArc * 0.65;
        const camY =
          THREE.MathUtils.lerp(0, floorWorldY, smoothstep(0.0, 0.74, p)) +
          arcOffsetY * approachArc * 0.55;

        // Z progresses from exterior Z_START (10) -> through glass pane (FLOOR_Z = 0.52 at p~0.62) -> interior landing (-0.85)
        let camZ: number;
        if (p < 0.64) {
          const zPhase = p / 0.64;
          camZ = THREE.MathUtils.lerp(Z_START, FLOOR_Z - 0.05, Math.pow(zPhase, 0.85));
        } else {
          const innerPhase = (p - 0.64) / 0.36;
          camZ = THREE.MathUtils.lerp(FLOOR_Z - 0.05, CAM_END_Z, 1 - Math.pow(1 - innerPhase, 2.2));
        }

        // Cinema dolly-zoom lens breathing: slightly narrower (44 -> 36) approaching glass, then opening (36 -> 48) inside room
        const fov =
          p < 0.58
            ? THREE.MathUtils.lerp(FOV_START, FOV_MID, smoothstep(0.0, 0.58, p))
            : THREE.MathUtils.lerp(FOV_MID, FOV_END, smoothstep(0.58, 1.0, p));

        camera.fov = fov;
        camera.updateProjectionMatrix();
        camera.position.set(camX, camY, camZ);

        // Target shifts smoothly from elevation center (0,0,0) -> floor bay -> interior wall center (floorWorldX, floorWorldY, ROOM_Z)
        const targetBlend = smoothstep(0.0, 0.65, p);
        _camTarget.set(
          THREE.MathUtils.lerp(0, floorWorldX, targetBlend),
          THREE.MathUtils.lerp(0, floorWorldY, targetBlend),
          THREE.MathUtils.lerp(0, ROOM_Z, smoothstep(0.18, 0.85, p))
        );
        camera.lookAt(_camTarget);

        // Subtle ~1.1deg drone banking during lateral arc, leveling cleanly to 0 at start and arrival
        const bank = Math.sin(p * Math.PI) * sideSign * 0.018 * (1 - smoothstep(0.65, 1.0, p));
        camera.up.copy(_upVec);
        camera.rotateZ(bank);

        // 1. Ramp 3D elevation depth relief right after launch so Frame 0 matches 2D identically
        towerMat.uniforms.uRelief.value = smoothstep(0.0, 0.24, p);

        // 2. Open the physical window glazing aperture cleanly on tower facade
        const portalOpen = smoothstep(0.06, 0.42, p);
        towerMat.uniforms.uPortalOpen.value = portalOpen;

        // 3. Fade in 3D steel diagrid frame as tower extrudes, then clear cleanly once past glass
        const frameFadeIn = smoothstep(0.02, 0.16, p);
        const frameFadeOut = 1 - smoothstep(0.64, 0.78, p);
        const frameOp = frameFadeIn * frameFadeOut;
        steelMat.opacity = frameOp;
        trimGoldMat.opacity = frameOp;
        revealWallMat.opacity = frameOp;
        windowGroup.visible = frameOp > 0.01;

        // 4. Specular glass glint sweeps across pane before dissolving smoothly at entry
        const glassIn = smoothstep(0.05, 0.22, p);
        const glassOut = 1 - smoothstep(0.46, 0.64, p);
        glassMat.uniforms.uGlassOpacity.value = glassIn * glassOut;
        glassMat.uniforms.uGlintOffset.value = THREE.MathUtils.lerp(-0.45, 0.95, p);
        glassMesh.visible = glassMat.uniforms.uGlassOpacity.value > 0.005;

        // 5. Open full interior frame once camera crosses through the curtain wall
        interiorMat.uniforms.uRoomReveal.value = smoothstep(0.46, 0.72, p);

        // Keep sky backdrop out of interior sightlines after entry
        skySkirtMesh.visible = p < 0.78;
        towerMesh.visible = p < 0.78;
      };

      // Render Frame 0 (or 1) synchronously before loop ticks so mounting has zero blank frame
      applyProgress(stage === 'zooming' ? 0 : 1);
      renderer.render(scene, camera);

      const afterDraw = (cb: () => void) => {
        if (!renderer || cancelled) return;
        const gl = renderer.getContext() as WebGL2RenderingContext;
        if (typeof gl.fenceSync === 'function') {
          const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
          gl.flush();
          const poll = () => {
            if (cancelled) {
              if (sync) gl.deleteSync(sync);
              return;
            }
            const status = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
            if (status === gl.UNSIGNALED) {
              pollTimerId = window.setTimeout(poll, 5);
            } else {
              if (sync) gl.deleteSync(sync);
              pollTimerId = window.setTimeout(cb, 80);
            }
          };
          pollTimerId = window.setTimeout(poll, 5);
        } else {
          pollTimerId = window.setTimeout(cb, 80);
        }
      };

      const tick = () => {
        if (cancelled || !renderer || !scene) return;
        const elapsed = performance.now() - startTime;
        const rawT = Math.min(1, elapsed / durationMs);
        const directedT = stage === 'zooming' ? rawT : 1 - rawT;

        applyProgress(directedT);
        renderer.render(scene, camera);

        if (rawT >= 1) {
          if (stage === 'zooming') {
            callbacksRef.current.onZoomComplete();
          } else {
            callbacksRef.current.onReturnComplete();
          }
          return;
        }

        if (isSoftwareGl) {
          afterDraw(tick);
        } else {
          rafId = requestAnimationFrame(tick);
        }
      };

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        rafId = requestAnimationFrame(tick);
      }
    };

    start3DFlyThrough();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      window.clearTimeout(pollTimerId);

      disposables.forEach((d) => d.dispose());
      towerTexture?.dispose();
      interiorTexture?.dispose();
      envTexture?.dispose();

      if (renderer) {
        const canvas = renderer.domElement;
        if (canvas.parentElement === mountEl) {
          mountEl.removeChild(canvas);
        }
        renderer.dispose();
      }
    };
  }, [
    stage,
    selectedFloor,
    targetScene,
    elevationSrc,
    atmosphere.brightness,
    atmosphere.contrast,
    stageRef,
    boundsRef,
    animation.zoomDuration,
    animation.returnDuration,
  ]);

  if (stage !== 'zooming' && stage !== 'returning') {
    return null;
  }

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="fixed inset-0 z-[45] pointer-events-none select-none bg-[#0B0C0E] overflow-hidden"
    />
  );
};
