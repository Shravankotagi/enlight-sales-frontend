import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';

export type SteelCategory = 'Flat Steel' | 'Structural Steel' | 'Pipes & Tubes' | 'Value Added Products';

interface Steel3DCanvasProps {
  activeCategory: SteelCategory;
  className?: string;
}

export default function Steel3DCanvas({
  activeCategory,
  className = '',
}: Steel3DCanvasProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const modelGroupRef = useRef<THREE.Group | null>(null);
  const currentModelRef = useRef<THREE.Group | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Mouse drag & parallax state
  const isDraggingRef = useRef(false);
  const previousMousePositionRef = useRef({ x: 0, y: 0 });
  const targetRotationRef = useRef({ x: 0.35, y: -0.55 });
  const currentRotationRef = useRef({ x: 0.35, y: -0.55 });
  const mouseParallaxRef = useRef({ x: 0, y: 0 });

  const [isInteracting, setIsInteracting] = useState(false);

  // Helper to create materials
  const createMaterials = useCallback(() => {
    // Brushed metallic steel
    const steelMat = new THREE.MeshStandardMaterial({
      color: 0x8fa0b0,
      metalness: 0.88,
      roughness: 0.25,
      envMapIntensity: 1.2,
    });

    // High-specular polished steel
    const polishedMat = new THREE.MeshStandardMaterial({
      color: 0xd0dae5,
      metalness: 0.95,
      roughness: 0.16,
    });

    // Enlight crimson branding accent strap
    const strapMat = new THREE.MeshStandardMaterial({
      color: 0xd71920,
      metalness: 0.65,
      roughness: 0.32,
    });

    // Darker inner bore/recess
    const innerMat = new THREE.MeshStandardMaterial({
      color: 0x2e3742,
      metalness: 0.7,
      roughness: 0.5,
    });

    return { steelMat, polishedMat, strapMat, innerMat };
  }, []);

  // 1. Flat Steel - Realistic Steel Coil
  const buildCoilModel = useCallback((mats: ReturnType<typeof createMaterials>) => {
    const group = new THREE.Group();
    const outerR = 1.9;
    const innerR = 0.75;
    const depth = 2.4;

    const shape = new THREE.Shape();
    shape.absarc(0, 0, outerR, 0, Math.PI * 2, false);
    const hole = new THREE.Path();
    hole.absarc(0, 0, innerR, 0, Math.PI * 2, true);
    shape.holes.push(hole);

    const coilGeo = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: true,
      bevelSegments: 3,
      bevelSize: 0.05,
      bevelThickness: 0.05,
      curveSegments: 54,
    });
    coilGeo.center();
    const coilMesh = new THREE.Mesh(coilGeo, mats.steelMat);
    group.add(coilMesh);

    // Inner bore lining
    const coreGeo = new THREE.CylinderGeometry(innerR - 0.01, innerR - 0.01, depth + 0.02, 48, 1, true);
    coreGeo.rotateX(Math.PI / 2);
    const coreMesh = new THREE.Mesh(coreGeo, mats.innerMat);
    group.add(coreMesh);

    // Strapping steel bands (crimson)
    [-0.65, 0.65].forEach((z) => {
      const strapShape = new THREE.Shape();
      strapShape.absarc(0, 0, outerR + 0.03, 0, Math.PI * 2, false);
      const strapHole = new THREE.Path();
      strapHole.absarc(0, 0, outerR - 0.01, 0, Math.PI * 2, true);
      strapShape.holes.push(strapHole);

      const strapGeo = new THREE.ExtrudeGeometry(strapShape, {
        depth: 0.12,
        bevelEnabled: false,
        curveSegments: 48,
      });
      strapGeo.center();
      const strapMesh = new THREE.Mesh(strapGeo, mats.strapMat);
      strapMesh.position.z = z;
      group.add(strapMesh);

      // Strap tension buckle clip
      const buckleGeo = new THREE.BoxGeometry(0.18, 0.32, 0.16);
      const buckleMesh = new THREE.Mesh(buckleGeo, mats.polishedMat);
      buckleMesh.position.set(outerR + 0.02, 0, z);
      group.add(buckleMesh);
    });

    group.rotation.x = Math.PI / 5;
    group.rotation.y = -Math.PI / 4;
    return group;
  }, []);

  // 2. Structural Steel - Heavy I-Beam
  const buildIBeamModel = useCallback((mats: ReturnType<typeof createMaterials>) => {
    const group = new THREE.Group();
    const w = 2.4;
    const tf = 0.32;
    const tw = 0.28;
    const h = 3.3;
    const depth = 4.2;

    const shape = new THREE.Shape();
    shape.moveTo(-w / 2, h / 2);
    shape.lineTo(w / 2, h / 2);
    shape.lineTo(w / 2, h / 2 - tf);
    shape.lineTo(tw / 2, h / 2 - tf);
    shape.lineTo(tw / 2, -h / 2 + tf);
    shape.lineTo(w / 2, -h / 2 + tf);
    shape.lineTo(w / 2, -h / 2);
    shape.lineTo(-w / 2, -h / 2);
    shape.lineTo(-w / 2, -h / 2 + tf);
    shape.lineTo(-tw / 2, -h / 2 + tf);
    shape.lineTo(-tw / 2, h / 2 - tf);
    shape.lineTo(-w / 2, h / 2 - tf);
    shape.closePath();

    const beamGeo = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: 0.03,
      bevelThickness: 0.03,
    });
    beamGeo.center();
    const beamMesh = new THREE.Mesh(beamGeo, mats.polishedMat);
    group.add(beamMesh);

    // Stiffener ribs & Enlight brand mark
    [-1.2, 1.2].forEach((z) => {
      const ribGeo = new THREE.BoxGeometry(tw + 0.12, h - 2 * tf - 0.04, 0.14);
      const ribMesh = new THREE.Mesh(ribGeo, mats.strapMat);
      ribMesh.position.z = z;
      group.add(ribMesh);
    });

    group.rotation.x = 0.45;
    group.rotation.y = -0.65;
    return group;
  }, []);

  // 3. Pipes & Tubes - Hexagonal Steel Pipe Bundle
  const buildPipesModel = useCallback((mats: ReturnType<typeof createMaterials>) => {
    const group = new THREE.Group();
    const r = 0.46;
    const length = 4.2;
    const wall = 0.07;

    const coords: [number, number][] = [
      [0, 0],
      [r * 2 * Math.cos(0), r * 2 * Math.sin(0)],
      [r * 2 * Math.cos(Math.PI / 3), r * 2 * Math.sin(Math.PI / 3)],
      [r * 2 * Math.cos((2 * Math.PI) / 3), r * 2 * Math.sin((2 * Math.PI) / 3)],
      [r * 2 * Math.cos(Math.PI), r * 2 * Math.sin(Math.PI)],
      [r * 2 * Math.cos((4 * Math.PI) / 3), r * 2 * Math.sin((4 * Math.PI) / 3)],
      [r * 2 * Math.cos((5 * Math.PI) / 3), r * 2 * Math.sin((5 * Math.PI) / 3)],
    ];

    coords.forEach(([x, y]) => {
      const pShape = new THREE.Shape();
      pShape.absarc(0, 0, r, 0, Math.PI * 2, false);
      const pHole = new THREE.Path();
      pHole.absarc(0, 0, r - wall, 0, Math.PI * 2, true);
      pShape.holes.push(pHole);

      const pGeo = new THREE.ExtrudeGeometry(pShape, {
        depth: length,
        bevelEnabled: true,
        bevelSegments: 2,
        bevelSize: 0.02,
        bevelThickness: 0.02,
        curveSegments: 36,
      });
      pGeo.center();
      const pMesh = new THREE.Mesh(pGeo, mats.steelMat);
      pMesh.position.set(x, y, 0);
      group.add(pMesh);
    });

    // Bundle binding straps
    [-1.2, 1.2].forEach((z) => {
      const strapGeo = new THREE.TorusGeometry(r * 3.12, 0.06, 12, 48);
      const strapMesh = new THREE.Mesh(strapGeo, mats.strapMat);
      strapMesh.position.z = z;
      group.add(strapMesh);
    });

    group.rotation.x = 0.35;
    group.rotation.y = -0.7;
    return group;
  }, []);

  // 4. Value Added Products - Precision Industrial Flange / Disc
  const buildFlangeModel = useCallback((mats: ReturnType<typeof createMaterials>) => {
    const group = new THREE.Group();
    const outerR = 2.0;
    const innerR = 0.65;
    const boltCircleR = 1.42;
    const boltHoleR = 0.14;
    const numBolts = 8;

    const shape = new THREE.Shape();
    shape.absarc(0, 0, outerR, 0, Math.PI * 2, false);

    // Center bore hole
    const centerHole = new THREE.Path();
    centerHole.absarc(0, 0, innerR, 0, Math.PI * 2, true);
    shape.holes.push(centerHole);

    // Bolt holes
    for (let i = 0; i < numBolts; i++) {
      const angle = (i * Math.PI * 2) / numBolts;
      const bx = Math.cos(angle) * boltCircleR;
      const by = Math.sin(angle) * boltCircleR;
      const boltHole = new THREE.Path();
      boltHole.absarc(bx, by, boltHoleR, 0, Math.PI * 2, true);
      shape.holes.push(boltHole);
    }

    const flangeGeo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.55,
      bevelEnabled: true,
      bevelSegments: 3,
      bevelSize: 0.04,
      bevelThickness: 0.04,
      curveSegments: 54,
    });
    flangeGeo.center();
    const flangeMesh = new THREE.Mesh(flangeGeo, mats.polishedMat);
    group.add(flangeMesh);

    // Raised hub collar
    const hubShape = new THREE.Shape();
    hubShape.absarc(0, 0, innerR + 0.38, 0, Math.PI * 2, false);
    const hubHole = new THREE.Path();
    hubHole.absarc(0, 0, innerR, 0, Math.PI * 2, true);
    hubShape.holes.push(hubHole);

    const hubGeo = new THREE.ExtrudeGeometry(hubShape, {
      depth: 0.85,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: 0.03,
      bevelThickness: 0.03,
      curveSegments: 54,
    });
    hubGeo.center();
    const hubMesh = new THREE.Mesh(hubGeo, mats.steelMat);
    hubMesh.position.z = 0.45;
    group.add(hubMesh);

    // Red brand identification ring on face
    const idRingShape = new THREE.Shape();
    idRingShape.absarc(0, 0, outerR - 0.08, 0, Math.PI * 2, false);
    const idRingHole = new THREE.Path();
    idRingHole.absarc(0, 0, outerR - 0.16, 0, Math.PI * 2, true);
    idRingShape.holes.push(idRingHole);
    const idRingGeo = new THREE.ExtrudeGeometry(idRingShape, {
      depth: 0.08,
      bevelEnabled: false,
      curveSegments: 48,
    });
    idRingGeo.center();
    const idRingMesh = new THREE.Mesh(idRingGeo, mats.strapMat);
    idRingMesh.position.z = 0.29;
    group.add(idRingMesh);

    group.rotation.x = 0.6;
    group.rotation.y = -0.4;
    return group;
  }, []);

  // Switch Model based on active category
  useEffect(() => {
    if (!modelGroupRef.current) return;
    const mats = createMaterials();

    // Fade/scale out existing model
    if (currentModelRef.current) {
      modelGroupRef.current.remove(currentModelRef.current);
    }

    let newModel: THREE.Group;
    switch (activeCategory) {
      case 'Flat Steel':
        newModel = buildCoilModel(mats);
        break;
      case 'Structural Steel':
        newModel = buildIBeamModel(mats);
        break;
      case 'Pipes & Tubes':
        newModel = buildPipesModel(mats);
        break;
      case 'Value Added Products':
      default:
        newModel = buildFlangeModel(mats);
        break;
    }

    newModel.scale.set(0.01, 0.01, 0.01);
    modelGroupRef.current.add(newModel);
    currentModelRef.current = newModel;

    // Reset base rotation
    targetRotationRef.current = { x: 0.35, y: -0.55 };
    currentRotationRef.current = { x: 0.35, y: -0.55 };

    // Entrance animation
    let start: number | null = null;
    const animateIn = (t: number) => {
      if (!start) start = t;
      const progress = Math.min((t - start) / 450, 1);
      const ease = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      if (newModel) {
        newModel.scale.set(ease, ease, ease);
      }
      if (progress < 1) {
        requestAnimationFrame(animateIn);
      }
    };
    requestAnimationFrame(animateIn);
  }, [activeCategory, buildCoilModel, buildIBeamModel, buildPipesModel, buildFlangeModel, createMaterials]);

  // Main Three.js Setup & Animation Loop
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(
      42,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    );
    camera.position.set(0, 0, 8.2);
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. Lighting System
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    // Key directional light (cool steel daylight)
    const keyLight = new THREE.DirectionalLight(0xf0f6ff, 2.8);
    keyLight.position.set(5, 7, 6);
    scene.add(keyLight);

    // Rim light (contrasting metallic reflection)
    const rimLight = new THREE.DirectionalLight(0x9bc2e6, 2.0);
    rimLight.position.set(-6, -4, -3);
    scene.add(rimLight);

    // Enlight Brand Crimson edge light
    const brandPoint = new THREE.PointLight(0xd71920, 2.2, 14);
    brandPoint.position.set(3, -2, 3);
    scene.add(brandPoint);

    // 5. Ambient Atmospheric Floating Sparks / Particles
    const particleCount = 45;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleSpeeds = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      particlePositions[i * 3] = (Math.random() - 0.5) * 12;
      particlePositions[i * 3 + 1] = (Math.random() - 0.5) * 10;
      particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 8;
      particleSpeeds[i] = 0.005 + Math.random() * 0.012;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));

    const particleMat = new THREE.PointsMaterial({
      color: 0xd71920,
      size: 0.09,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    // 6. Master Model Group
    const modelGroup = new THREE.Group();
    scene.add(modelGroup);
    modelGroupRef.current = modelGroup;

    // Handle Resize
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const width = container.clientWidth;
      const height = container.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // 7. Render Loop
    let clock = new THREE.Clock();
    const renderLoop = () => {
      const delta = clock.getDelta();
      const elapsedTime = clock.getElapsedTime();

      // Ambient slow auto-rotation if not actively dragging
      if (!isDraggingRef.current) {
        targetRotationRef.current.y += delta * 0.28;
      }

      // Smooth interpolation for rotation with parallax
      const smoothFactor = 0.06;
      currentRotationRef.current.x += (targetRotationRef.current.x + mouseParallaxRef.current.y - currentRotationRef.current.x) * smoothFactor;
      currentRotationRef.current.y += (targetRotationRef.current.y + mouseParallaxRef.current.x - currentRotationRef.current.y) * smoothFactor;

      if (modelGroupRef.current) {
        modelGroupRef.current.rotation.x = currentRotationRef.current.x;
        modelGroupRef.current.rotation.y = currentRotationRef.current.y;
        // Subtle floating bob
        modelGroupRef.current.position.y = Math.sin(elapsedTime * 1.4) * 0.12;
      }

      // Animate floating sparks
      const posAttr = particleGeo.getAttribute('position') as THREE.BufferAttribute;
      const posArray = posAttr.array as Float32Array;
      for (let i = 0; i < particleCount; i++) {
        posArray[i * 3 + 1] += particleSpeeds[i];
        // Wrap around when rising past ceiling
        if (posArray[i * 3 + 1] > 5) {
          posArray[i * 3 + 1] = -5;
          posArray[i * 3] = (Math.random() - 0.5) * 12;
        }
      }
      posAttr.needsUpdate = true;

      renderer.render(scene, camera);
      animFrameRef.current = requestAnimationFrame(renderLoop);
    };

    renderLoop();

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      resizeObserver.disconnect();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Global mouse move for parallax tilt
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const nx = (e.clientX / window.innerWidth) * 2 - 1;
      const ny = -(e.clientY / window.innerHeight) * 2 + 1;
      mouseParallaxRef.current = {
        x: nx * 0.35,
        y: ny * 0.25,
      };
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Drag to rotate handlers on canvas
  const handlePointerDown = (e: React.PointerEvent) => {
    isDraggingRef.current = true;
    setIsInteracting(true);
    previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const deltaX = e.clientX - previousMousePositionRef.current.x;
    const deltaY = e.clientY - previousMousePositionRef.current.y;

    targetRotationRef.current.y += deltaX * 0.012;
    targetRotationRef.current.x += deltaY * 0.012;

    // Clamp pitch
    targetRotationRef.current.x = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, targetRotationRef.current.x));

    previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = () => {
    isDraggingRef.current = false;
    setTimeout(() => setIsInteracting(false), 800);
  };

  return (
    <div className={`relative flex flex-col items-center justify-center overflow-hidden select-none ${className}`}>
      {/* 3D Canvas Mount */}
      <div
        ref={mountRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className={`w-full h-full min-h-[440px] sm:min-h-[480px] xl:min-h-[520px] cursor-grab active:cursor-grabbing transition-transform duration-300 ${
          isInteracting ? 'scale-[1.02]' : 'scale-100'
        }`}
        title="Click and drag to rotate 3D steel model"
      />

      {/* Radial Metallic Ambient Glow behind 3D model */}
      <div className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center">
        <div className="h-80 w-80 rounded-full bg-gradient-to-tr from-[#d71920]/15 via-[#1f4bb8]/12 to-transparent blur-3xl animate-pulse" />
      </div>
    </div>
  );
}
