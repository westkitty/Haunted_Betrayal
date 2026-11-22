import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { GameState } from "./game";
const wood = new THREE.MeshStandardMaterial({
    color: 0x32221d,
    roughness: 0.84,
  }),
  wall = new THREE.MeshStandardMaterial({ color: 0x51443c, roughness: 0.95 }),
  floorMat = new THREE.MeshStandardMaterial({
    color: 0x75604d,
    roughness: 0.88,
  }),
  gold = new THREE.MeshStandardMaterial({
    color: 0xc79a54,
    metalness: 0.65,
    roughness: 0.3,
  }),
  cyan = new THREE.MeshStandardMaterial({
    color: 0x83dce3,
    emissive: 0x4ccbd5,
    emissiveIntensity: 1.4,
    transparent: true,
    opacity: 0.75,
  }),
  red = new THREE.MeshStandardMaterial({ color: 0x902f38, emissive: 0x31080b });
function box(
  w: number,
  h: number,
  d: number,
  m: THREE.Material,
  x: number,
  y: number,
  z: number,
) {
  const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  o.position.set(x, y, z);
  o.castShadow = true;
  o.receiveShadow = true;
  return o;
}
function makeRoom(room: any, center: THREE.Vector3, scene: THREE.Object3D) {
  const group = new THREE.Group();
  group.position.copy(center);
  const size = 4.5;
  group.add(box(size, 0.18, size, floorMat, 0, 0.08, 0));
  // perimeter walls with open doorway at the north edge; distinct heights convey dollhouse cutaway
  const h = room.template === "ballroom" ? 3.3 : 2.7;
  group.add(box(size, 0.18, 0.12, wood, 0, h, -size / 2));
  group.add(box(0.12, h, size, wood, -size / 2, h / 2, 0));
  group.add(box(0.12, h, size, wood, size / 2, h / 2, 0));
  group.add(box(1.4, h, 0.12, wood, -1.55, h / 2, size / 2));
  group.add(box(1.4, h, 0.12, wood, 1.55, h / 2, size / 2));
  // wallpaper panels and trim
  for (let i = -1; i <= 1; i++) {
    group.add(
      box(0.035, h - 0.3, 0.04, gold, i * 1.25, h / 2, -size / 2 + 0.11),
    );
    group.add(
      box(0.035, h - 0.3, 0.04, gold, -size / 2 + 0.11, h / 2, i * 1.25),
    );
  }
  group.add(box(size, 0.09, 0.08, gold, 0, 0.28, -size / 2 + 0.13));
  const t = room.template;
  if (t === "library" || t === "archive" || t === "study") {
    for (let i = 0; i < 3; i++) {
      group.add(box(0.56, 1.75, 0.38, wood, -1.3 + i * 1.15, 1.03, -1.65));
      for (let j = 0; j < 5; j++)
        group.add(
          box(
            0.08,
            0.28,
            0.27,
            [gold, red, cyan][(i + j) % 3],
            -1.48 + i * 1.15 + j * 0.15,
            0.46 + Math.floor(j / 2) * 0.55,
            -1.42,
          ),
        );
    }
    group.add(box(1.4, 0.7, 0.65, wood, 0, 0.55, 0.1));
  } else if (t === "nursery" || t === "bedroom") {
    group.add(
      box(2, 0.52, 1.3, t === "nursery" ? wall : wood, -0.2, 0.42, -0.9),
    );
    group.add(box(2, 0.15, 1.35, gold, -0.2, 0.76, -0.9));
    group.add(box(0.65, 0.62, 0.65, wood, 1.25, 0.38, 0.8));
  } else if (t === "conservatory") {
    for (let i = 0; i < 4; i++) {
      const p = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.22, 0.82, 7),
        new THREE.MeshStandardMaterial({ color: 0x5f7650 }),
      );
      p.position.set(-1.5 + i, 0.52, 0.1);
      group.add(p);
      const leaf = new THREE.Mesh(
        new THREE.SphereGeometry(0.36, 8, 6),
        new THREE.MeshStandardMaterial({ color: i % 2 ? 0x687951 : 0x829261 }),
      );
      leaf.position.set(-1.5 + i, 1, 0.1);
      group.add(leaf);
    }
    group.add(box(2, 0.08, 0.3, cyan, 0, 1.9, -2.1));
  } else if (t === "gallery" || t === "chapel" || t === "parlor") {
    for (let i = 0; i < 3; i++) {
      group.add(box(0.65, 0.85, 0.09, red, -1.35 + i * 1.35, 1.72, -2.1));
      group.add(box(0.46, 0.59, 0.04, gold, -1.35 + i * 1.35, 1.72, -2.02));
    }
    group.add(box(1.25, 0.8, 0.62, wood, 0, 0.5, 0.3));
  } else if (t === "music") {
    group.add(box(1.65, 0.85, 0.8, wood, -0.4, 0.5, -0.7));
    const top = box(1.7, 0.11, 0.84, gold, -0.38, 1.03, -0.7);
    top.rotation.z = -0.22;
    group.add(top);
    for (let i = 0; i < 8; i++)
      group.add(
        box(0.13, 0.04, 0.18, i % 2 ? wall : gold, -1 + i * 0.18, 1.08, -0.5),
      );
  } else if (t === "mirror" || t === "impossible") {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(
        1.25,
        2,
        0.12,
        t === "mirror" ? undefined : undefined,
      ),
      cyan,
    );
    m.position.set(0, 1.27, -2);
    group.add(m);
    group.add(box(1.48, 2.2, 0.1, gold, 0, 1.27, -2.1));
  } else if (t === "ballroom" || t === "dining") {
    group.add(box(2.1, 0.16, 1.1, wood, 0, 0.95, 0));
    for (const x of [-0.85, 0.85])
      for (const z of [-0.5, 0.5])
        group.add(box(0.11, 0.82, 0.11, wood, x, 0.45, z));
    for (let i = 0; i < 4; i++)
      group.add(box(0.4, 0.5, 0.4, red, -1.5 + i, 0.38, 1));
  } else if (t === "cellar" || t === "boiler" || t === "flooded") {
    for (let i = 0; i < 4; i++) {
      const barrel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3, 0.34, 0.85, 10),
        i === 0 ? gold : wood,
      );
      barrel.position.set(-1.4 + i * 0.85, 0.57, -1.1);
      group.add(barrel);
    }
    if (t === "flooded") {
      const water = new THREE.Mesh(
        new THREE.PlaneGeometry(4, 1.5),
        new THREE.MeshStandardMaterial({
          color: 0x385d6a,
          transparent: true,
          opacity: 0.5,
          metalness: 0.4,
        }),
      );
      water.rotation.x = -Math.PI / 2;
      water.position.set(0, 0.2, 1.25);
      group.add(water);
    }
  } else if (t === "stair") {
    for (let i = 0; i < 7; i++)
      group.add(
        box(
          1.4,
          0.15,
          0.38,
          wood,
          -0.65 + i * 0.1,
          0.22 + i * 0.24,
          0.85 - i * 0.4,
        ),
      );
  } else {
    group.add(box(1, 0.8, 0.7, wood, 0, 0.48, 0));
    group.add(box(1.2, 0.12, 0.78, gold, 0, 0.94, 0));
    for (let i = 0; i < 3; i++) {
      const candle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.045, 0.06, 0.36, 8),
        wall,
      );
      candle.position.set(-0.35 + i * 0.35, 1.17, 0);
      group.add(candle);
      const flame = new THREE.Mesh(
        new THREE.SphereGeometry(0.075, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xffbd65 }),
      );
      flame.position.set(-0.35 + i * 0.35, 1.39, 0);
      group.add(flame);
    }
  }
  if (room.haunted) {
    const hue =
      room.haunted === "mourner"
        ? 0x9cc6ce
        : room.haunted === "wisp"
          ? 0xffcd79
          : 0x83dce3;
    const spiritMat = new THREE.MeshStandardMaterial({
      color: hue,
      emissive: hue,
      emissiveIntensity: 1.35,
      transparent: true,
      opacity: 0.74,
      roughness: 0.3,
    });
    const orb =
      room.haunted === "mourner"
        ? new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.2, 8), spiritMat)
        : new THREE.Mesh(
            new THREE.IcosahedronGeometry(
              room.haunted === "wisp" ? 0.19 : 0.32,
              1,
            ),
            spiritMat,
          );
    orb.position.set(
      room.haunted === "wisp" ? 1.3 : 0,
      room.haunted === "mourner" ? 1.2 : 1.6,
      0,
    );
    group.add(orb);
    if (room.haunted === "mourner") {
      const veil = new THREE.Mesh(
        new THREE.ConeGeometry(0.62, 1.1, 8, 1, true),
        new THREE.MeshBasicMaterial({
          color: hue,
          transparent: true,
          opacity: 0.15,
          side: THREE.DoubleSide,
        }),
      );
      veil.position.set(0, 0.82, 0);
      group.add(veil);
    }
    const light = new THREE.PointLight(hue, 1.6, 5);
    light.position.copy(orb.position);
    group.add(light);
  }
  // lantern pools and room labels are intentionally in-scene
  const point = new THREE.PointLight(
    room.haunted ? 0x4db6c4 : 0xffc477,
    1.2,
    7,
  );
  point.position.set(-0.6, 2.3, 0.3);
  group.add(point);
  scene.add(group);
  return group;
}
export default function Stage({
  state,
  onMove,
}: {
  state: GameState;
  onMove: (room: string) => void;
}) {
  const mount = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<any>(null);
  const drag = useRef({ active: false, x: 0, y: 0, theta: 0, phi: 0.9 });
  const walk = useRef({ roomId: "", x: 0, z: 0 });
  const step = useRef<(x: number, z: number) => void>(() => {});
  useEffect(() => {
    const el = mount.current;
    if (!el) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x101319);
    scene.fog = new THREE.Fog(0x101319, 13, 45);
    const camera = new THREE.PerspectiveCamera(
      42,
      el.clientWidth / el.clientHeight,
      0.1,
      120,
    );
    cameraRef.current = camera;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    el.appendChild(renderer.domElement);
    scene.add(new THREE.HemisphereLight(0x8b9aa8, 0x281b18, 1.45));
    const key = new THREE.DirectionalLight(0xffd49a, 2.15);
    key.position.set(-8, 14, 8);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    scene.add(key);
    const mansion = new THREE.Group();
    scene.add(mansion);
    const roomsById = new Map<string, THREE.Group>();
    const gap = 5.3;
    const floorY = (f: number) => (f === 0 ? 0 : f === 1 ? 5 : -5);
    const coords = (r: any) =>
      new THREE.Vector3(r.x * gap, floorY(r.floor), r.y * gap);
    for (const r of state.rooms) {
      const g = makeRoom(r, coords(r), mansion);
      roomsById.set(r.id, g);
    }
    for (const r of state.rooms) {
      for (const id of r.links) {
        if (r.id > id) continue;
        const target = state.rooms.find((q) => q.id === id);
        if (!target) continue;
        const a = coords(r),
          b = coords(target);
        const connector = box(
          0.4,
          0.08,
          0.7,
          gold,
          (a.x + b.x) / 2,
          0.2,
          (a.z + b.z) / 2,
        );
        mansion.add(connector);
      }
    }
    const p = state.players[state.current],
      current = state.rooms.find((r) => r.id === p.roomId) || state.rooms[0],
      cp = coords(current);
    if (walk.current.roomId !== current.id)
      walk.current = { roomId: current.id, x: 0, z: 0 };
    const avatar = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.22, 0.65, 4, 8),
      new THREE.MeshStandardMaterial({ color: 0xb99568, roughness: 0.8 }),
    );
    body.position.y = 0.64;
    avatar.add(body);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.21, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xe1cba8 }),
    );
    head.position.y = 1.18;
    avatar.add(head);
    const lantern = new THREE.PointLight(0xffbf65, 1.1, 4);
    lantern.position.set(0.3, 1, 0.3);
    avatar.add(lantern);
    avatar.position.set(cp.x + walk.current.x, cp.y, cp.z + walk.current.z);
    mansion.add(avatar);
    // hover details and dust motes
    const dustGeo = new THREE.BufferGeometry();
    const dustCount = 120;
    const pos = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 24;
      pos[i * 3 + 1] = Math.random() * 8;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 24;
    }
    dustGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const dust = new THREE.Points(
      dustGeo,
      new THREE.PointsMaterial({
        color: 0xd9c8a1,
        size: 0.035,
        transparent: true,
        opacity: 0.42,
      }),
    );
    scene.add(dust);
    let target = new THREE.Vector3(cp.x, 1, cp.z);
    let angle = drag.current.theta;
    let phi = drag.current.phi;
    let zoom =
      state.mode === "dollhouse"
        ? Math.max(15, state.rooms.length * 1.13)
        : 8.4;
    let alive = true;
    let raf = 0;
    const animate = () => {
      if (!alive) return;
      raf = requestAnimationFrame(animate);
      if (state.mode === "explore") {
        const desired = new THREE.Vector3(
          cp.x + walk.current.x,
          1.15,
          cp.z + walk.current.z,
        );
        target.lerp(desired, 0.07);
      } else target.lerp(new THREE.Vector3(0, 0, 0), 0.04);
      const r = zoom;
      const desiredCam = new THREE.Vector3(
        target.x + r * Math.sin(phi) * Math.sin(angle),
        target.y + r * Math.cos(phi),
        target.z + r * Math.sin(phi) * Math.cos(angle),
      );
      camera.position.lerp(desiredCam, 0.045);
      camera.lookAt(target);
      dust.rotation.y += 0.0003;
      renderer.render(scene, camera);
    };
    animate();
    step.current = (dx, dz) => {
      if (state.mode !== "explore") return;
      walk.current.x = Math.max(-1.55, Math.min(1.55, walk.current.x + dx));
      walk.current.z = Math.max(-1.55, Math.min(1.55, walk.current.z + dz));
      avatar.position.set(cp.x + walk.current.x, cp.y, cp.z + walk.current.z);
    };
    const keydown = (e: KeyboardEvent) => {
      if (state.mode !== "explore") return;
      const key = e.key.toLowerCase();
      const dirs: Record<string, [number, number]> = {
        w: [0, -0.32],
        arrowup: [0, -0.32],
        s: [0, 0.32],
        arrowdown: [0, 0.32],
        a: [-0.32, 0],
        arrowleft: [-0.32, 0],
        d: [0.32, 0],
        arrowright: [0.32, 0],
      };
      if (dirs[key]) {
        e.preventDefault();
        step.current(...dirs[key]);
      }
    };
    window.addEventListener("keydown", keydown);
    const resize = () => {
      if (!el) return;
      camera.aspect = el.clientWidth / el.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(el.clientWidth, el.clientHeight);
    };
    window.addEventListener("resize", resize);
    const down = (e: PointerEvent) => {
      drag.current.active = true;
      drag.current.x = e.clientX;
      drag.current.y = e.clientY;
      renderer.domElement.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!drag.current.active) return;
      const dx = e.clientX - drag.current.x,
        dy = e.clientY - drag.current.y;
      drag.current.x = e.clientX;
      drag.current.y = e.clientY;
      angle -= dx * 0.005;
      phi = Math.max(0.22, Math.min(1.48, phi + dy * 0.004));
      drag.current.theta = angle;
      drag.current.phi = phi;
    };
    const up = () => (drag.current.active = false);
    const wheel = (e: WheelEvent) => {
      zoom = Math.max(4, Math.min(42, zoom + e.deltaY * 0.012));
    };
    renderer.domElement.addEventListener("pointerdown", down);
    renderer.domElement.addEventListener("pointermove", move);
    renderer.domElement.addEventListener("pointerup", up);
    renderer.domElement.addEventListener("wheel", wheel);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", keydown);
      renderer.dispose();
      dustGeo.dispose();
      renderer.domElement.removeEventListener("pointerdown", down);
      renderer.domElement.removeEventListener("pointermove", move);
      renderer.domElement.removeEventListener("pointerup", up);
      renderer.domElement.removeEventListener("wheel", wheel);
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
          else o.material.dispose();
        }
      });
    };
  }, [state.rooms, state.players, state.current, state.mode, state.phase]);
  const mapSpread = Math.max(
    1,
    ...state.rooms.map((r) => Math.max(Math.abs(r.x), Math.abs(r.y))),
  );
  const mapScale = 44 / mapSpread;
  return (
    <div className="stage-wrap">
      <div className="stage" ref={mount} />
      <div className="scene-caption">
        <span className="live-dot" />{" "}
        {state.mode === "dollhouse"
          ? "THE LIVING FLOOR PLAN"
          : "INSIDE THE HOUSE"}{" "}
        <span className="scene-hint">Drag to look · scroll to focus</span>
      </div>
      {state.mode === "explore" && (
        <div className="walk-controls" aria-label="Move explorer">
          <button
            aria-label="Move forward"
            onClick={() => step.current(0, -0.38)}
          >
            ↑
          </button>
          <div>
            <button
              aria-label="Move left"
              onClick={() => step.current(-0.38, 0)}
            >
              ←
            </button>
            <button
              aria-label="Move backward"
              onClick={() => step.current(0, 0.38)}
            >
              ↓
            </button>
            <button
              aria-label="Move right"
              onClick={() => step.current(0.38, 0)}
            >
              →
            </button>
          </div>
        </div>
      )}
      {state.mode === "dollhouse" && (
        <div className="mini-map">
          {state.rooms.map((r) => (
            <button
              key={r.id}
              title={r.name}
              className={`map-room ${state.players.some((p) => p.roomId === r.id) ? "occupied" : ""} ${r.haunted ? "haunted" : ""}`}
              style={{
                left: `calc(50% + ${r.x * mapScale}px)`,
                top: `calc(50% + ${r.y * mapScale}px)`,
              }}
              onClick={() => onMove(r.id)}
            />
          ))}
        </div>
      )}
      {state.mode === "explore" && (
        <div className="doorway-nav">
          <span>CONNECTED DOORS</span>
          {(
            state.rooms.find(
              (r) => r.id === state.players[state.current].roomId,
            )?.links || []
          ).map((id) => {
            const r = state.rooms.find((x) => x.id === id);
            return r ? (
              <button
                key={id}
                disabled={state.ap < 1}
                onClick={() => onMove(id)}
              >
                <span className="nav-door">↗</span>
                {r.name}
                <i>ENTER</i>
              </button>
            ) : null;
          })}
        </div>
      )}
    </div>
  );
}
