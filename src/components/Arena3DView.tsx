import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  Crosshair,
  Shield,
  Heart,
  RefreshCw,
  Trophy,
  Volume2,
  VolumeX,
  Eye,
  Zap,
} from 'lucide-react';
import { RoomState, PlayerState, WeaponType, Vector3, ServerTickPayload } from '../types';

interface Arena3DViewProps {
  roomState: RoomState;
  localPlayerId: string;
  onSendMovement: (pos: Vector3, vel: Vector3, rotY: number, pitch: number, seq: number) => void;
  onSendShoot: (weapon: WeaponType, origin: Vector3, dir: Vector3, targetId?: string) => void;
  onSendReload: () => void;
  onSwitchWeapon: (weapon: WeaponType) => void;
  onReturnToLobby: () => void;
}

export const Arena3DView: React.FC<Arena3DViewProps> = ({
  roomState,
  localPlayerId,
  onSendMovement,
  onSendShoot,
  onSendReload,
  onSwitchWeapon,
  onReturnToLobby,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [cameraMode, setCameraMode] = useState<'FPS' | 'TPS'>('TPS');
  const [hitmarker, setHitmarker] = useState<{ active: boolean; isHeadshot: boolean }>({
    active: false,
    isHeadshot: false,
  });

  // Keep state refs for animation loop
  const roomStateRef = useRef(roomState);
  roomStateRef.current = roomState;

  const localPlayer = roomState.players[localPlayerId];
  const localPlayerRef = useRef(localPlayer);
  localPlayerRef.current = localPlayer;

  const cameraModeRef = useRef(cameraMode);
  cameraModeRef.current = cameraMode;

  const movementSequenceRef = useRef(0);

  // Keyboard keys state
  const keysRef = useRef<{
    forward: boolean;
    backward: boolean;
    left: boolean;
    right: boolean;
    shift: boolean;
  }>({
    forward: false,
    backward: false,
    left: false,
    right: false,
    shift: false,
  });

  const mouseLookRef = useRef({ yaw: 0, pitch: 0, isMouseDown: false, lastX: 0, lastY: 0 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. Scene, Camera, Renderer
    const width = container.clientWidth || 900;
    const height = container.clientHeight || 550;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0c10);
    scene.fog = new THREE.FogExp2(0x0a0c10, 0.015);

    const camera = new THREE.PerspectiveCamera(65, width / height, 0.1, 500);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'default' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = false; // lightweight software path
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 2. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffeedd, 1.0);
    dirLight.position.set(30, 50, 20);
    scene.add(dirLight);

    const blueStreetLight = new THREE.PointLight(0x38bdf8, 2, 40);
    blueStreetLight.position.set(0, 10, -30);
    scene.add(blueStreetLight);

    const redStreetLight = new THREE.PointLight(0xf43f5e, 2, 40);
    redStreetLight.position.set(0, 10, 30);
    scene.add(redStreetLight);

    // 3. Build Avenue Tactical Map
    // Ground - Asphalt Road
    const roadGeo = new THREE.PlaneGeometry(36, 160);
    const roadMat = new THREE.MeshStandardMaterial({
      color: 0x1f242d,
      roughness: 0.8,
      metalness: 0.1,
    });
    const roadMesh = new THREE.Mesh(roadGeo, roadMat);
    roadMesh.rotation.x = -Math.PI / 2;
    roadMesh.position.y = 0;
    scene.add(roadMesh);

    // Road Markings (Dashed yellow Avenue center lines)
    for (let z = -70; z <= 70; z += 10) {
      const lineGeo = new THREE.PlaneGeometry(0.8, 5);
      const lineMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
      const lineMesh = new THREE.Mesh(lineGeo, lineMat);
      lineMesh.rotation.x = -Math.PI / 2;
      lineMesh.position.set(0, 0.02, z);
      scene.add(lineMesh);
    }

    // Sidewalks
    const sidewalkGeo = new THREE.BoxGeometry(15, 0.6, 160);
    const sidewalkMat = new THREE.MeshStandardMaterial({ color: 0x333b47, roughness: 0.9 });

    const leftWalk = new THREE.Mesh(sidewalkGeo, sidewalkMat);
    leftWalk.position.set(-25.5, 0.3, 0);
    scene.add(leftWalk);

    const rightWalk = new THREE.Mesh(sidewalkGeo, sidewalkMat);
    rightWalk.position.set(25.5, 0.3, 0);
    scene.add(rightWalk);

    // Urban Tactical Barriers (Jersey Concrete barriers)
    const barrierGeo = new THREE.BoxGeometry(4, 1.4, 1.2);
    const barrierMat = new THREE.MeshStandardMaterial({ color: 0x52525b, roughness: 0.7 });

    const barrierPositions = [
      [-6, 0.7, -25],
      [6, 0.7, -15],
      [-8, 0.7, 0],
      [8, 0.7, 0],
      [-6, 0.7, 15],
      [6, 0.7, 25],
      [-12, 0.7, -40],
      [12, 0.7, 40],
    ];

    barrierPositions.forEach(([x, y, z]) => {
      const b = new THREE.Mesh(barrierGeo, barrierMat);
      b.position.set(x, y, z);
      scene.add(b);
    });

    // Tactical Shipping Containers
    const containerGeo = new THREE.BoxGeometry(6, 4, 14);
    const blueContainerMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.6 });
    const redContainerMat = new THREE.MeshStandardMaterial({ color: 0x881337, roughness: 0.6 });

    const blueBox = new THREE.Mesh(containerGeo, blueContainerMat);
    blueBox.position.set(-15, 2, -45);
    scene.add(blueBox);

    const redBox = new THREE.Mesh(containerGeo, redContainerMat);
    redBox.position.set(15, 2, 45);
    scene.add(redBox);

    // 4. Remote Player Meshes Map
    const playerMeshes = new Map<string, THREE.Group>();

    function createPlayerModel(team: 'ALPHA' | 'BRAVO', isLocal: boolean): THREE.Group {
      const group = new THREE.Group();

      const teamColor = team === 'ALPHA' ? 0x2563eb : 0xdc2626;

      // Body / Tactical Torso
      const torsoGeo = new THREE.BoxGeometry(0.9, 1.3, 0.5);
      const torsoMat = new THREE.MeshStandardMaterial({
        color: teamColor,
        roughness: 0.5,
        metalness: 0.3,
      });
      const torso = new THREE.Mesh(torsoGeo, torsoMat);
      torso.position.y = 1.1;
      group.add(torso);

      // Head & Helmet
      const headGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
      const headMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.4 });
      const head = new THREE.Mesh(headGeo, headMat);
      head.position.y = 2.0;
      group.add(head);

      // Visor
      const visorGeo = new THREE.BoxGeometry(0.35, 0.15, 0.1);
      const visorMat = new THREE.MeshBasicMaterial({
        color: team === 'ALPHA' ? 0x38bdf8 : 0xf43f5e,
      });
      const visor = new THREE.Mesh(visorGeo, visorMat);
      visor.position.set(0, 2.0, 0.28);
      group.add(visor);

      // Gun model
      const gunGeo = new THREE.BoxGeometry(0.18, 0.2, 1.0);
      const gunMat = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.3 });
      const gun = new THREE.Mesh(gunGeo, gunMat);
      gun.position.set(0.4, 1.2, 0.4);
      group.add(gun);

      return group;
    }

    // 5. Tracers pool
    const activeTracers: Array<{ mesh: THREE.Line; expires: number }> = [];

    // Local position state for smooth client prediction
    const localPos = {
      x: localPlayer?.position.x || 0,
      y: 1.0,
      z: localPlayer?.position.z || -55,
    };

    let lastTickSent = Date.now();

    // 6. Animation / Tick Loop
    let animationFrameId: number;
    let lastFrameTime = performance.now();

    const animate = (time: number) => {
      animationFrameId = requestAnimationFrame(animate);

      const delta = Math.min((time - lastFrameTime) / 1000, 0.1);
      lastFrameTime = time;

      const currentRoom = roomStateRef.current;
      const curLocalPlayer = localPlayerRef.current;

      // Handle Keyboard Movement for Local Player
      if (curLocalPlayer && curLocalPlayer.isAlive && currentRoom.matchState === 'IN_PROGRESS') {
        const speed = keysRef.current.shift ? 12.0 : 8.0;
        const moveVector = new THREE.Vector3(0, 0, 0);

        if (keysRef.current.forward) moveVector.z += 1;
        if (keysRef.current.backward) moveVector.z -= 1;
        if (keysRef.current.left) moveVector.x += 1;
        if (keysRef.current.right) moveVector.x -= 1;

        if (moveVector.lengthSq() > 0) {
          moveVector.normalize();
          // Rotate by camera yaw
          const yaw = mouseLookRef.current.yaw;
          const rotatedX = moveVector.x * Math.cos(yaw) + moveVector.z * Math.sin(yaw);
          const rotatedZ = -moveVector.x * Math.sin(yaw) + moveVector.z * Math.cos(yaw);

          localPos.x += rotatedX * speed * delta;
          localPos.z += rotatedZ * speed * delta;

          // Clamp to Arena boundaries
          localPos.x = Math.max(-45, Math.min(45, localPos.x));
          localPos.z = Math.max(-70, Math.min(70, localPos.z));
        }

        // Send 20Hz movement packet to server
        const now = Date.now();
        if (now - lastTickSent >= 50) {
          lastTickSent = now;
          movementSequenceRef.current++;
          onSendMovement(
            { x: localPos.x, y: localPos.y, z: localPos.z },
            { x: moveVector.x * speed, y: 0, z: moveVector.z * speed },
            mouseLookRef.current.yaw,
            mouseLookRef.current.pitch,
            movementSequenceRef.current
          );
        }
      }

      // Update Camera Position based on FPS / TPS
      if (cameraModeRef.current === 'FPS') {
        camera.position.set(localPos.x, localPos.y + 1.8, localPos.z);
        camera.rotation.order = 'YXZ';
        camera.rotation.y = mouseLookRef.current.yaw + Math.PI;
        camera.rotation.x = mouseLookRef.current.pitch;
      } else {
        // Third-Person Tactical Camera
        const camDistance = 6.0;
        const camHeight = 3.5;
        const yaw = mouseLookRef.current.yaw;
        const camX = localPos.x - Math.sin(yaw) * camDistance;
        const camZ = localPos.z - Math.cos(yaw) * camDistance;

        camera.position.set(camX, localPos.y + camHeight, camZ);
        camera.lookAt(localPos.x, localPos.y + 1.5, localPos.z);
      }

      // Update / Render Remote Players
      const existingIds = new Set(Object.keys(currentRoom.players));

      // Remove stale meshes
      for (const [id, mesh] of playerMeshes.entries()) {
        if (!existingIds.has(id)) {
          scene.remove(mesh);
          playerMeshes.delete(id);
        }
      }

      // Update active players
      for (const player of Object.values(currentRoom.players)) {
        let pMesh = playerMeshes.get(player.id);
        if (!pMesh) {
          pMesh = createPlayerModel(player.team, player.id === localPlayerId);
          scene.add(pMesh);
          playerMeshes.set(player.id, pMesh);
        }

        if (player.id === localPlayerId) {
          // Local player mesh: visible in TPS, hidden or transparent in FPS
          pMesh.visible = cameraModeRef.current === 'TPS' && player.isAlive;
          pMesh.position.set(localPos.x, 0, localPos.z);
          pMesh.rotation.y = mouseLookRef.current.yaw + Math.PI;
        } else {
          // Remote players: interpolate position and rotation
          pMesh.visible = player.isAlive;
          pMesh.position.x += (player.position.x - pMesh.position.x) * 0.3;
          pMesh.position.y = 0;
          pMesh.position.z += (player.position.z - pMesh.position.z) * 0.3;
          pMesh.rotation.y += (player.rotationY - pMesh.rotation.y) * 0.3;
        }
      }

      // Clean expired tracers
      const curNow = Date.now();
      for (let i = activeTracers.length - 1; i >= 0; i--) {
        if (curNow > activeTracers[i].expires) {
          scene.remove(activeTracers[i].mesh);
          activeTracers.splice(i, 1);
        }
      }

      renderer.render(scene, camera);
    };

    animationFrameId = requestAnimationFrame(animate);

    // 7. Input Event Listeners
    const handleKeyDown = (e: KeyboardEvent) => {
      const code = e.code;
      if (code === 'KeyW' || code === 'ArrowUp') keysRef.current.forward = true;
      if (code === 'KeyS' || code === 'ArrowDown') keysRef.current.backward = true;
      if (code === 'KeyA' || code === 'ArrowLeft') keysRef.current.left = true;
      if (code === 'KeyD' || code === 'ArrowRight') keysRef.current.right = true;
      if (code === 'ShiftLeft' || code === 'ShiftRight') keysRef.current.shift = true;
      if (code === 'KeyR') onSendReload();

      // Number keys for weapons
      if (code === 'Digit1') onSwitchWeapon('rifle');
      if (code === 'Digit2') onSwitchWeapon('smg');
      if (code === 'Digit3') onSwitchWeapon('shotgun');
      if (code === 'Digit4') onSwitchWeapon('sniper');
      if (code === 'Digit5') onSwitchWeapon('pistol');
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const code = e.code;
      if (code === 'KeyW' || code === 'ArrowUp') keysRef.current.forward = false;
      if (code === 'KeyS' || code === 'ArrowDown') keysRef.current.backward = false;
      if (code === 'KeyA' || code === 'ArrowLeft') keysRef.current.left = false;
      if (code === 'KeyD' || code === 'ArrowRight') keysRef.current.right = false;
      if (code === 'ShiftLeft' || code === 'ShiftRight') keysRef.current.shift = false;
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        // Left click to fire
        mouseLookRef.current.isMouseDown = true;
        mouseLookRef.current.lastX = e.clientX;
        mouseLookRef.current.lastY = e.clientY;

        // Perform shooting raycast
        if (localPlayerRef.current?.isAlive && roomStateRef.current.matchState === 'IN_PROGRESS') {
          handleShoot();
        }
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (mouseLookRef.current.isMouseDown) {
        const dx = e.clientX - mouseLookRef.current.lastX;
        const dy = e.clientY - mouseLookRef.current.lastY;
        mouseLookRef.current.lastX = e.clientX;
        mouseLookRef.current.lastY = e.clientY;

        mouseLookRef.current.yaw -= dx * 0.005;
        mouseLookRef.current.pitch = Math.max(
          -Math.PI / 4,
          Math.min(Math.PI / 4, mouseLookRef.current.pitch - dy * 0.005)
        );
      }
    };

    const handleMouseUp = () => {
      mouseLookRef.current.isMouseDown = false;
    };

    function handleShoot() {
      const player = localPlayerRef.current;
      if (!player || !player.isAlive) return;

      const origin: Vector3 = {
        x: localPos.x,
        y: localPos.y + 1.5,
        z: localPos.z,
      };

      // Calculate forward direction vector based on camera rotation
      const yaw = mouseLookRef.current.yaw;
      const pitch = mouseLookRef.current.pitch;
      const direction: Vector3 = {
        x: Math.sin(yaw) * Math.cos(pitch),
        y: Math.sin(pitch),
        z: Math.cos(yaw) * Math.cos(pitch),
      };

      // Raycast against opponent player bounding cylinders
      let closestTargetId: string | undefined;
      let minTargetDist = Infinity;

      for (const other of Object.values(roomStateRef.current.players)) {
        if (other.id === localPlayerId || !other.isAlive || other.team === player.team) continue;

        // Vector to other
        const toOther = {
          x: other.position.x - origin.x,
          y: other.position.y + 1.0 - origin.y,
          z: other.position.z - origin.z,
        };
        const d = Math.hypot(toOther.x, toOther.y, toOther.z);
        if (d < minTargetDist) {
          // Normalize
          const nx = toOther.x / d;
          const ny = toOther.y / d;
          const nz = toOther.z / d;
          const dot = nx * direction.x + ny * direction.y + nz * direction.z;
          if (dot > 0.85) {
            // Target locked!
            minTargetDist = d;
            closestTargetId = other.id;
          }
        }
      }

      // Add visual bullet tracer in Three.js
      const endPoint = new THREE.Vector3(
        origin.x + direction.x * 60,
        origin.y + direction.y * 60,
        origin.z + direction.z * 60
      );

      const tracerPoints = [
        new THREE.Vector3(origin.x, origin.y, origin.z),
        endPoint,
      ];
      const tracerGeo = new THREE.BufferGeometry().setFromPoints(tracerPoints);
      const tracerMat = new THREE.LineBasicMaterial({
        color: player.team === 'ALPHA' ? 0x60a5fa : 0xf87171,
        linewidth: 2,
      });
      const tracerLine = new THREE.Line(tracerGeo, tracerMat);
      scene.add(tracerLine);
      activeTracers.push({ mesh: tracerLine, expires: Date.now() + 120 });

      // Trigger hitmarker if targeted
      if (closestTargetId) {
        setHitmarker({ active: true, isHeadshot: pitch > 0.1 });
        setTimeout(() => setHitmarker({ active: false, isHeadshot: false }), 200);
      }

      // Emit authoritative shoot event to server
      onSendShoot(player.selectedWeapon, origin, direction, closestTargetId);
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    container.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      container.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      scene.clear();
    };
  }, []);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="relative w-full h-[calc(100vh-4rem)] bg-neutral-950 overflow-hidden select-none">
      {/* 3D WebGL Canvas Container */}
      <div ref={containerRef} className="w-full h-full cursor-crosshair" />

      {/* Crosshair & Hitmarker in Center */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div className="relative w-8 h-8 flex items-center justify-center">
          {/* Subtle tactical crosshair */}
          <div className="w-1.5 h-1.5 rounded-full bg-white/70" />
          <div className="absolute w-4 h-0.5 bg-white/50 -top-2" />
          <div className="absolute w-4 h-0.5 bg-white/50 -bottom-2" />
          <div className="absolute h-4 w-0.5 bg-white/50 -left-2" />
          <div className="absolute h-4 w-0.5 bg-white/50 -right-2" />

          {/* Hitmarker Flash */}
          {hitmarker.active && (
            <div
              className={`absolute w-8 h-8 border-2 rotate-45 animate-ping ${
                hitmarker.isHeadshot ? 'border-red-500' : 'border-amber-400'
              }`}
            />
          )}
        </div>
      </div>

      {/* TOP HUD: Match Scores & Timer Bar */}
      <div className="absolute top-4 inset-x-0 flex justify-center pointer-events-none">
        <div className="bg-neutral-950/90 border border-neutral-800 rounded-xl px-6 py-2.5 shadow-2xl backdrop-blur-md flex items-center gap-6">
          {/* TEAM ALPHA (BLUE) SCORE */}
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-blue-500 shadow-md shadow-blue-500" />
            <div className="text-right">
              <div className="text-[10px] text-blue-400 font-mono uppercase font-bold">
                TEAM ALPHA
              </div>
              <div className="text-2xl font-black text-white font-mono leading-none">
                {roomState.scores.ALPHA}
              </div>
            </div>
          </div>

          {/* MATCH TIMER */}
          <div className="border-x border-neutral-800 px-5 text-center">
            <div className="text-[10px] text-neutral-400 font-mono uppercase">TIME LEFT</div>
            <div className="text-xl font-bold font-mono text-amber-400">
              {formatTimer(roomState.timeRemainingSeconds)}
            </div>
          </div>

          {/* TEAM BRAVO (RED) SCORE */}
          <div className="flex items-center gap-3">
            <div>
              <div className="text-[10px] text-red-400 font-mono uppercase font-bold">
                TEAM BRAVO
              </div>
              <div className="text-2xl font-black text-white font-mono leading-none">
                {roomState.scores.BRAVO}
              </div>
            </div>
            <span className="w-3 h-3 rounded-full bg-red-500 shadow-md shadow-red-500" />
          </div>
        </div>
      </div>

      {/* TOP RIGHT: Authoritative Kill Feed */}
      <div className="absolute top-4 right-4 w-72 space-y-1.5 pointer-events-none">
        {roomState.killFeed.slice(0, 5).map((entry) => (
          <div
            key={entry.id}
            className="bg-neutral-950/85 border border-neutral-800/80 rounded px-2.5 py-1 text-xs font-mono flex items-center justify-between shadow-lg"
          >
            <span
              className={
                entry.killerTeam === 'ALPHA' ? 'text-blue-400 font-bold' : 'text-red-400 font-bold'
              }
            >
              {entry.killerName}
            </span>
            <div className="flex items-center gap-1 text-[10px] text-neutral-400 uppercase bg-neutral-900 px-1.5 py-0.5 rounded">
              <span>{entry.weapon}</span>
              {entry.isHeadshot && <span className="text-red-400">💀</span>}
            </div>
            <span
              className={
                entry.victimTeam === 'ALPHA' ? 'text-blue-400 font-bold' : 'text-red-400 font-bold'
              }
            >
              {entry.victimName}
            </span>
          </div>
        ))}
      </div>

      {/* BOTTOM LEFT: Health, Shield & Status */}
      <div className="absolute bottom-6 left-6 pointer-events-auto">
        <div className="bg-neutral-950/90 border border-neutral-800 rounded-xl p-4 shadow-2xl backdrop-blur-md w-72">
          {/* Health Bar */}
          <div className="mb-2.5">
            <div className="flex items-center justify-between text-xs font-mono mb-1">
              <span className="flex items-center gap-1 text-emerald-400 font-bold">
                <Heart className="w-3.5 h-3.5 fill-current" /> HEALTH
              </span>
              <span className="text-white font-bold">{localPlayer?.health || 0} / 100</span>
            </div>
            <div className="w-full h-2.5 bg-neutral-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-150"
                style={{ width: `${Math.max(0, localPlayer?.health || 0)}%` }}
              />
            </div>
          </div>

          {/* Armor / Shield Bar */}
          <div>
            <div className="flex items-center justify-between text-xs font-mono mb-1">
              <span className="flex items-center gap-1 text-blue-400 font-bold">
                <Shield className="w-3.5 h-3.5 fill-current" /> ARMOR SHIELD
              </span>
              <span className="text-white font-bold">{localPlayer?.armor || 0} / 50</span>
            </div>
            <div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-150"
                style={{ width: `${Math.max(0, ((localPlayer?.armor || 0) / 50) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM RIGHT: Weapon, Ammo & Reload */}
      <div className="absolute bottom-6 right-6 pointer-events-auto">
        <div className="bg-neutral-950/90 border border-neutral-800 rounded-xl p-4 shadow-2xl backdrop-blur-md flex items-center gap-5">
          {/* Ammo display */}
          <div className="text-right">
            <div className="text-[10px] text-neutral-400 font-mono uppercase">
              {localPlayer?.selectedWeapon.toUpperCase()} AMMUNITION
            </div>
            <div className="text-3xl font-black font-mono text-white tracking-wider">
              {localPlayer?.ammo}
              <span className="text-neutral-500 text-sm font-normal"> / MAG</span>
            </div>
          </div>

          {/* Reload Button */}
          <button
            onClick={onSendReload}
            className="p-3 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-amber-400 border border-neutral-700 transition-colors flex flex-col items-center gap-1 cursor-pointer"
            title="Reload weapon [R]"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="text-[9px] font-mono font-bold">RELOAD [R]</span>
          </button>
        </div>
      </div>

      {/* BOTTOM CENTER: Weapon Selector Bar & Controls Hint */}
      <div className="absolute bottom-6 inset-x-0 flex flex-col items-center pointer-events-none gap-2">
        {/* Weapon quickbar */}
        <div className="pointer-events-auto flex items-center gap-1.5 bg-neutral-950/80 p-1.5 rounded-lg border border-neutral-800">
          {(['rifle', 'smg', 'shotgun', 'sniper', 'pistol'] as WeaponType[]).map((w, idx) => (
            <button
              key={w}
              onClick={() => onSwitchWeapon(w)}
              className={`px-3 py-1 rounded text-xs font-mono uppercase font-bold transition-all cursor-pointer ${
                localPlayer?.selectedWeapon === w
                  ? 'bg-amber-500 text-neutral-950 shadow-md shadow-amber-500/30'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
              }`}
            >
              <span className="text-[10px] opacity-60 mr-1">[{idx + 1}]</span>
              {w}
            </button>
          ))}
          <div className="border-l border-neutral-800 pl-1.5">
            <button
              onClick={() => setCameraMode(cameraMode === 'TPS' ? 'FPS' : 'TPS')}
              className="px-2.5 py-1 rounded text-xs font-mono text-cyan-300 hover:bg-neutral-800 transition-colors flex items-center gap-1 cursor-pointer"
              title="Toggle First/Third person camera"
            >
              <Eye className="w-3.5 h-3.5" />
              {cameraMode}
            </button>
          </div>
        </div>

        {/* Controls guidance */}
        <div className="text-[11px] font-mono text-neutral-400 bg-neutral-950/80 px-3 py-1 rounded-full border border-neutral-800">
          WASD: Move • Mouse Drag: Aim • Left-Click: Fire • R: Reload • 1-5: Weapons
        </div>
      </div>

      {/* MATCH OVER OVERLAY */}
      {roomState.matchState === 'ENDED' && (
        <div className="absolute inset-0 bg-neutral-950/90 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8 max-w-lg w-full text-center shadow-2xl">
            <div className="inline-flex p-4 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 mb-4">
              <Trophy className="w-8 h-8" />
            </div>
            <h2 className="text-3xl font-black text-white uppercase tracking-wider mb-2">
              VICTORY: TEAM {roomState.winnerTeam}
            </h2>
            <p className="text-sm text-neutral-400 font-mono mb-6">
              Final Score: ALPHA {roomState.scores.ALPHA} - BRAVO {roomState.scores.BRAVO}
            </p>

            {/* Quick Stats Summary */}
            <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4 mb-6">
              <div className="text-xs font-mono text-neutral-400 mb-3 uppercase tracking-wider">
                MVP Operators
              </div>
              <div className="space-y-2">
                {Object.values(roomState.players)
                  .sort((a, b) => b.eliminations - a.eliminations)
                  .slice(0, 3)
                  .map((p, rank) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between text-xs font-mono px-3 py-1.5 rounded bg-neutral-900"
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-amber-400 font-bold">#{rank + 1}</span>
                        <span className="text-white font-semibold">{p.name}</span>
                        <span
                          className={`text-[10px] px-1.5 rounded ${
                            p.team === 'ALPHA' ? 'text-blue-400' : 'text-red-400'
                          }`}
                        >
                          {p.team}
                        </span>
                      </span>
                      <span className="text-neutral-300">
                        {p.eliminations} Kills • {p.damageDealt} DMG
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            <button
              onClick={onReturnToLobby}
              className="w-full bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold py-3 rounded-lg text-sm tracking-wider uppercase transition-all shadow-lg shadow-amber-500/30 cursor-pointer"
            >
              Return to Lobby
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
