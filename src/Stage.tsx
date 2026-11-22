import { useEffect, useRef } from "react";
import * as THREE from "three";
import { Crosshair, Minus, Plus } from "lucide-react";
import type { GameState } from "./game";
const ROOM_FLOOR_TOP = 0.17;
const FIGURE_BASE_HEIGHT = 0.08;
const FIGURE_ROOT_Y = ROOM_FLOOR_TOP + FIGURE_BASE_HEIGHT;
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
function makePatternTexture(base: string, accent: string, floor = false) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);
  if (floor) {
    for (let y = 0; y < 256; y += 32) {
      const offset = (y / 32) % 2 ? 16 : 0;
      for (let x = -16; x < 256; x += 32) {
        ctx.fillStyle = (x + y) % 3 ? base : accent;
        ctx.fillRect(x + offset + 1, y + 1, 30, 30);
        ctx.strokeStyle = "#100b0a";
        ctx.lineWidth = 2;
        ctx.strokeRect(x + offset + 1, y + 1, 30, 30);
      }
    }
  } else {
    ctx.fillStyle = accent;
    ctx.globalAlpha = 0.35;
    for (let x = 16; x < 256; x += 32) {
      ctx.fillRect(x, 0, 2, 256);
      for (let y = 16; y < 256; y += 32) {
        ctx.beginPath();
        ctx.arc(x + 8, y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + 8, y, 10, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#d7c39a";
    for (let i = 0; i < 180; i++) {
      const x = (i * 73) % 256,
        y = (i * 137) % 256;
      ctx.globalAlpha = (i % 5) / 40;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(floor ? 2.4 : 1.5, floor ? 2.4 : 1.2);
  texture.anisotropy = 4;
  return texture;
}
const wallPaletteDefs = [
  ["#69554c", "#c3a477"],
  ["#38444b", "#b29a71"],
  ["#60474f", "#c29c83"],
  ["#4b5547", "#c6ae7b"],
  ["#5b4b61", "#d0b58a"],
  ["#74684f", "#dbc38f"],
];
const wallTints = [0xe3d4b8, 0xc7d8d6, 0xe2c3bc, 0xcbd9b5, 0xd3c3df, 0xe0d5b8];
let wallPalettes: THREE.MeshStandardMaterial[] = [];
const damaskTexture = new THREE.TextureLoader().load(
  `${import.meta.env.BASE_URL}textures/house-damask.webp`,
  (texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1.35, 1.1);
    texture.anisotropy = 4;
    wallPalettes.forEach((material, index) => {
      const fallbackTexture = material.map;
      material.map = texture;
      material.bumpMap = texture;
      if (fallbackTexture && fallbackTexture !== texture)
        fallbackTexture.dispose();
      material.bumpScale = 0.012;
      material.color.setHex(wallTints[index]);
      material.needsUpdate = true;
    });
  },
);
damaskTexture.wrapS = damaskTexture.wrapT = THREE.RepeatWrapping;
damaskTexture.repeat.set(1.35, 1.1);
wallPalettes = wallPaletteDefs.map(
  ([base, accent]) =>
    new THREE.MeshStandardMaterial({
      map: makePatternTexture(base, accent),
      roughness: 0.94,
    }),
);
function makePortraitFallback(background: string, coat: string, hair: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 168;
  const ctx = canvas.getContext("2d")!;
  const wash = ctx.createLinearGradient(0, 0, 128, 168);
  wash.addColorStop(0, background);
  wash.addColorStop(1, "#171719");
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, 128, 168);
  ctx.fillStyle = "#b79b6c22";
  for (let y = 10; y < 168; y += 20) ctx.fillRect(0, y, 128, 1);
  ctx.fillStyle = coat;
  ctx.beginPath();
  ctx.moveTo(8, 168);
  ctx.quadraticCurveTo(16, 112, 47, 103);
  ctx.lineTo(81, 103);
  ctx.quadraticCurveTo(114, 116, 122, 168);
  ctx.fill();
  ctx.fillStyle = "#d2b99a";
  ctx.beginPath();
  ctx.ellipse(64, 62, 23, 31, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = hair;
  ctx.beginPath();
  ctx.ellipse(64, 43, 27, 24, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(38, 41, 7, 29);
  ctx.fillRect(83, 41, 7, 29);
  ctx.fillStyle = "#362923";
  ctx.fillRect(53, 64, 3, 2);
  ctx.fillRect(72, 64, 3, 2);
  ctx.strokeStyle = "#e0c98d";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(64, 122);
  ctx.lineTo(64, 146);
  ctx.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}
const portraitFallbacks = [
  makePortraitFallback("#29413c", "#242328", "#171414"),
  makePortraitFallback("#50313a", "#153633", "#281b18"),
  makePortraitFallback("#34434a", "#68707a", "#392c25"),
];
const portraitMaterials = portraitFallbacks.map(
  (map) =>
    new THREE.MeshStandardMaterial({
      map,
      color: 0xe8dfd1,
      emissive: 0x21170f,
      emissiveIntensity: 0.22,
      roughness: 0.96,
    }),
);
const portraitFiles = [
  "portrait-ancestor.webp",
  "portrait-heir.webp",
  "portrait-child.webp",
];
portraitFiles.forEach((file, index) => {
  new THREE.TextureLoader().load(
    `${import.meta.env.BASE_URL}textures/${file}`,
    (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 4;
      const fallback = portraitMaterials[index].map;
      portraitMaterials[index].map = texture;
      portraitMaterials[index].needsUpdate = true;
      if (fallback && fallback !== texture) fallback.dispose();
    },
  );
});
function addPortrait(group: THREE.Group, x: number, y: number, index: number) {
  const z = -2.08;
  group.add(box(0.74, 0.94, 0.13, wood, x, y, z));
  const canvas = new THREE.Mesh(
    new THREE.PlaneGeometry(0.56, 0.72),
    portraitMaterials[index % portraitMaterials.length],
  );
  canvas.position.set(x, y, -2.005);
  canvas.castShadow = false;
  canvas.receiveShadow = false;
  group.add(canvas);
  const frameZ = -1.975;
  group.add(
    box(0.075, 0.9, 0.14, gold, x - 0.32, y, frameZ),
    box(0.075, 0.9, 0.14, gold, x + 0.32, y, frameZ),
    box(0.7, 0.075, 0.14, gold, x, y - 0.405, frameZ),
    box(0.7, 0.075, 0.14, gold, x, y + 0.405, frameZ),
  );
  const crest = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), gold);
  crest.position.set(x, y + 0.445, -1.91);
  group.add(crest);
}
function makeRoomLabel(name: string, haunted = false) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  const backing = ctx.createLinearGradient(0, 0, 256, 64);
  backing.addColorStop(0, "#201a18");
  backing.addColorStop(0.5, "#30241d");
  backing.addColorStop(1, "#171415");
  ctx.fillStyle = backing;
  ctx.fillRect(4, 4, 248, 56);
  const accent = haunted ? "#8fd6d5" : "#c8a46d";
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.strokeRect(5, 5, 246, 54);
  ctx.strokeStyle = haunted ? "#8fd6d555" : "#c8a46d55";
  ctx.lineWidth = 1;
  ctx.strokeRect(9, 9, 238, 46);
  ctx.fillStyle = "#ead8b6";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "600 17px Georgia, serif";
  ctx.fillText(name, 128, 33, 222);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const label = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    }),
  );
  label.position.set(0, 3.15, 0);
  label.scale.set(3.1, 0.78, 1);
  label.renderOrder = 5;
  label.userData.disposeTexture = true;
  return label;
}
function addDiscoveryBurst(room: THREE.Group, color: number) {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.3, 0.34, 28),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = ROOM_FLOOR_TOP + 0.025;
  ring.castShadow = false;
  ring.receiveShadow = false;
  room.add(ring);
  const count = 12;
  const positions = new Float32Array(count * 3);
  const velocities = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const radius = 0.18 + (i % 3) * 0.035;
    positions[i * 3] = Math.cos(angle) * radius;
    positions[i * 3 + 1] = ROOM_FLOOR_TOP + 0.06 + (i % 4) * 0.035;
    positions[i * 3 + 2] = Math.sin(angle) * radius;
    velocities[i * 3] = Math.cos(angle) * (0.3 + (i % 3) * 0.1);
    velocities[i * 3 + 1] = 0.55 + (i % 4) * 0.1;
    velocities[i * 3 + 2] = Math.sin(angle) * (0.3 + (i % 3) * 0.1);
  }
  const geometry = new THREE.BufferGeometry();
  const position = new THREE.BufferAttribute(positions, 3);
  position.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute("position", position);
  const sparks = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      color,
      size: 0.065,
      transparent: true,
      opacity: 0.82,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  sparks.frustumCulled = false;
  room.add(sparks);
  room.userData.discoveryBurst = { ring, sparks, velocities, age: 0 };
}
floorMat.map = makePatternTexture("#4b352e", "#82664b", true);
const grainCanvas = document.createElement("canvas");
grainCanvas.width = 256;
grainCanvas.height = 256;
const grainCtx = grainCanvas.getContext("2d")!;
grainCtx.fillStyle = "#563f31";
grainCtx.fillRect(0, 0, 256, 256);
for (let y = 0; y < 256; y += 5) {
  grainCtx.beginPath();
  grainCtx.moveTo(0, y);
  grainCtx.bezierCurveTo(
    72,
    y + Math.sin(y * 0.12) * 4,
    184,
    y - Math.cos(y * 0.08) * 5,
    256,
    y + Math.sin(y * 0.05) * 3,
  );
  grainCtx.strokeStyle = y % 3 ? "#8b694c22" : "#24191555";
  grainCtx.lineWidth = y % 3 ? 1 : 2;
  grainCtx.stroke();
}
const woodTexture = new THREE.CanvasTexture(grainCanvas);
woodTexture.colorSpace = THREE.SRGBColorSpace;
woodTexture.wrapS = woodTexture.wrapT = THREE.RepeatWrapping;
woodTexture.repeat.set(1.5, 1.5);
wood.map = woodTexture;
wood.color.set(0xffffff);
floorMat.needsUpdate = true;
wood.needsUpdate = true;
const feltCanvas = document.createElement("canvas");
feltCanvas.width = feltCanvas.height = 256;
const feltCtx = feltCanvas.getContext("2d")!;
feltCtx.fillStyle = "#1d2422";
feltCtx.fillRect(0, 0, 256, 256);
for (let i = 0; i < 1800; i++) {
  const x = (i * 97) % 256;
  const y = (i * 151) % 256;
  feltCtx.fillStyle = i % 4 ? "#71806d12" : "#0b111015";
  feltCtx.fillRect(x, y, 1 + (i % 3), 1);
}
for (let y = 0; y < 256; y += 4) {
  feltCtx.strokeStyle = y % 8 ? "#89918408" : "#080d0c12";
  feltCtx.beginPath();
  feltCtx.moveTo(0, y);
  feltCtx.lineTo(256, y + 3);
  feltCtx.stroke();
}
const feltTexture = new THREE.CanvasTexture(feltCanvas);
feltTexture.colorSpace = THREE.SRGBColorSpace;
feltTexture.wrapS = feltTexture.wrapT = THREE.RepeatWrapping;
feltTexture.repeat.set(58, 58);
feltTexture.anisotropy = 4;
const feltMaterial = new THREE.MeshStandardMaterial({
  map: feltTexture,
  color: 0xb8c1ad,
  roughness: 0.98,
});
const carpetCanvas = document.createElement("canvas");
carpetCanvas.width = carpetCanvas.height = 256;
const carpetCtx = carpetCanvas.getContext("2d")!;
carpetCtx.fillStyle = "#493039";
carpetCtx.fillRect(0, 0, 256, 256);
carpetCtx.strokeStyle = "#b28d5b";
carpetCtx.globalAlpha = 0.52;
carpetCtx.lineWidth = 3;
for (let x = -128; x <= 256; x += 32) {
  carpetCtx.beginPath();
  carpetCtx.moveTo(x, 0);
  carpetCtx.lineTo(x + 128, 128);
  carpetCtx.lineTo(x, 256);
  carpetCtx.stroke();
}
carpetCtx.globalAlpha = 0.75;
for (let x = 16; x < 256; x += 32)
  for (let y = 16; y < 256; y += 32) {
    carpetCtx.beginPath();
    carpetCtx.arc(x, y, 4, 0, Math.PI * 2);
    carpetCtx.fillStyle = "#d2b17a";
    carpetCtx.fill();
  }
carpetCtx.globalAlpha = 1;
const carpetTexture = new THREE.CanvasTexture(carpetCanvas);
carpetTexture.colorSpace = THREE.SRGBColorSpace;
carpetTexture.anisotropy = 4;
const glowCanvas = document.createElement("canvas");
glowCanvas.width = glowCanvas.height = 128;
const glowCtx = glowCanvas.getContext("2d")!;
const glowGradient = glowCtx.createRadialGradient(64, 64, 2, 64, 64, 64);
glowGradient.addColorStop(0, "rgba(255,255,255,0.78)");
glowGradient.addColorStop(0.18, "rgba(255,255,255,0.36)");
glowGradient.addColorStop(0.55, "rgba(255,255,255,0.08)");
glowGradient.addColorStop(1, "rgba(255,255,255,0)");
glowCtx.fillStyle = glowGradient;
glowCtx.fillRect(0, 0, 128, 128);
const glowTexture = new THREE.CanvasTexture(glowCanvas);
glowTexture.colorSpace = THREE.SRGBColorSpace;
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
function addCutawayWall(
  group: THREE.Group,
  side: string,
  mesh: THREE.Mesh,
  height: number,
) {
  mesh.userData.cutaway = { side, baseY: mesh.position.y, height };
  group.add(mesh);
}
function makeRoom(
  room: any,
  center: THREE.Vector3,
  scene: THREE.Object3D,
  doorTargets: Record<string, string>,
  illuminate: boolean,
  showRoomLabel: boolean,
) {
  const group = new THREE.Group();
  const flames: THREE.Object3D[] = [];
  group.userData.flames = flames;
  group.position.copy(center);
  if (showRoomLabel) group.add(makeRoomLabel(room.name, Boolean(room.haunted)));
  const size = 4.5;
  const h = room.template === "ballroom" ? 3.3 : 2.7;
  const wallpaper =
    wallPalettes[
      Math.abs(
        String(room.template)
          .split("")
          .reduce((n, c) => n + c.charCodeAt(0), 0),
      ) % wallPalettes.length
    ];
  const floorTone =
    room.template === "chapel"
      ? 0xc9a5a0
      : room.template === "flooded"
        ? 0x91b5b1
        : room.template === "conservatory"
          ? 0xc2c59e
          : room.floor > 0
            ? 0xc9b993
            : 0xbda58d;
  const roomFloor = floorMat.clone();
  roomFloor.color.setHex(floorTone);
  group.add(box(size, 0.18, size, roomFloor, 0, 0.08, 0));
  // Each face has an actual door opening; linked doors are open, unused exits stay shut.
  const doorWidth = 1.55,
    segment = (size - doorWidth) / 2,
    edge = doorWidth / 2 + segment / 2;
  addCutawayWall(
    group,
    "north",
    box(size, 0.14, 0.12, wood, 0, h, -size / 2),
    0.14,
  );
  for (const side of ["north", "south", "east", "west"]) {
    const zSide = side === "north" || side === "south";
    const edgePos = side === "north" || side === "west" ? -size / 2 : size / 2;
    const sideSign = edgePos < 0 ? -1 : 1;
    const material = wallpaper;
    const walls = zSide
      ? [
          [segment, h, 0.12, -edge, h / 2, edgePos],
          [segment, h, 0.12, edge, h / 2, edgePos],
        ]
      : [
          [0.12, h, segment, edgePos, h / 2, -edge],
          [0.12, h, segment, edgePos, h / 2, edge],
        ];
    for (const [w, height, d, x, y, z] of walls)
      addCutawayWall(group, side, box(w, height, d, material, x, y, z), h);
    const jambA = zSide ? [-doorWidth / 2, edgePos] : [edgePos, -doorWidth / 2];
    const jambB = zSide ? [doorWidth / 2, edgePos] : [edgePos, doorWidth / 2];
    for (const [x, z] of [jambA, jambB])
      addCutawayWall(group, side, box(0.14, h, 0.16, wood, x, h / 2, z), h);
    const lintel = zSide
      ? box(doorWidth + 0.14, 0.18, 0.16, gold, 0, h - 0.08, edgePos)
      : box(0.16, 0.18, doorWidth + 0.14, gold, edgePos, h - 0.08, 0);
    addCutawayWall(group, side, lintel, 0.18);
    if (!doorTargets[side]) {
      const leaf = zSide
        ? box(
            doorWidth - 0.12,
            h - 0.18,
            0.08,
            wood,
            0,
            (h - 0.18) / 2,
            edgePos,
          )
        : box(
            0.08,
            h - 0.18,
            doorWidth - 0.12,
            wood,
            edgePos,
            (h - 0.18) / 2,
            0,
          );
      addCutawayWall(group, side, leaf, h - 0.18);
      const panel = zSide
        ? box(
            doorWidth - 0.42,
            h - 0.55,
            0.025,
            gold,
            0,
            (h - 0.18) / 2,
            edgePos + sideSign * 0.05,
          )
        : box(
            0.025,
            h - 0.55,
            doorWidth - 0.42,
            gold,
            edgePos + sideSign * 0.05,
            (h - 0.18) / 2,
            0,
          );
      addCutawayWall(group, side, panel, h - 0.55);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), gold);
      knob.position.set(
        zSide ? doorWidth * 0.32 : edgePos - sideSign * 0.09,
        1.05,
        zSide ? edgePos + sideSign * 0.09 : doorWidth * 0.32,
      );
      knob.userData.cutaway = { side, baseY: knob.position.y, height: 0.12 };
      group.add(knob);
    } else {
      group.add(
        zSide
          ? box(doorWidth, 0.06, 0.46, gold, 0, 0.12, edgePos - sideSign * 0.2)
          : box(0.46, 0.06, doorWidth, gold, edgePos - sideSign * 0.2, 0.12, 0),
      );
    }
    const doorHit = new THREE.Mesh(
      new THREE.PlaneGeometry(doorWidth, 2.25),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        colorWrite: false,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    if (zSide) doorHit.position.set(0, 1.15, edgePos);
    else {
      doorHit.rotation.y = Math.PI / 2;
      doorHit.position.set(edgePos, 1.15, 0);
    }
    doorHit.userData.doorHit = true;
    doorHit.userData.roomId = room.id;
    doorHit.userData.doorSide = side;
    doorHit.userData.doorTarget = doorTargets[side] || null;
    group.add(doorHit);
  }
  // Brass skirting, ceiling cornice, and repeated wall pilasters give rooms a common architectural language.
  for (const side of ["north", "south", "east", "west"]) {
    const zSide = side === "north" || side === "south";
    const edgePos =
      side === "north" || side === "west" ? -size / 2 + 0.12 : size / 2 - 0.12;
    for (const along of [-1.92, -1.15, 1.15, 1.92]) {
      group.add(
        zSide
          ? box(0.045, h - 0.45, 0.05, gold, along, h / 2, edgePos)
          : box(0.05, h - 0.45, 0.045, gold, edgePos, h / 2, along),
      );
    }
    group.add(
      zSide
        ? box(size, 0.1, 0.1, gold, 0, 0.24, edgePos)
        : box(0.1, 0.1, size, gold, edgePos, 0.24, 0),
    );
  }
  // A patterned rug anchors the room and gives the miniature an authored, tactile scale.
  const rug = new THREE.Mesh(
    new THREE.PlaneGeometry(2.1, 1.35),
    new THREE.MeshStandardMaterial({
      map: carpetTexture,
      color: room.template === "chapel" ? 0xe2a876 : 0xb6a1ad,
      roughness: 0.98,
    }),
  );
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(0, 0.19, 0.15);
  group.add(rug);
  const rugBorder = new THREE.Mesh(
    new THREE.RingGeometry(0.82, 0.95, 4),
    new THREE.MeshStandardMaterial({ color: 0xb99659, side: THREE.DoubleSide }),
  );
  rugBorder.rotation.x = -Math.PI / 2;
  rugBorder.scale.set(1.1, 0.72, 1);
  rugBorder.position.set(0, 0.2, 0.15);
  group.add(rugBorder);
  const rugSeal = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.27, 12), gold);
  rugSeal.rotation.x = -Math.PI / 2;
  rugSeal.position.set(0, 0.205, 0.15);
  group.add(rugSeal);
  const rugDiamond = box(0.075, 0.018, 0.34, gold, 0, 0.21, 0.15);
  rugDiamond.rotation.y = Math.PI / 4;
  group.add(rugDiamond);
  const t = room.template;
  if (
    ["conservatory", "gallery", "observatory", "nursery", "ballroom"].includes(
      t,
    )
  ) {
    const glass = new THREE.MeshPhysicalMaterial({
      color: 0x82b8b8,
      emissive: 0x1b3339,
      roughness: 0.2,
      metalness: 0.1,
      transparent: true,
      opacity: 0.58,
      side: THREE.DoubleSide,
    });
    for (const x of [-1.28, 1.28]) {
      const arch = new THREE.Shape();
      arch.moveTo(-0.38, -0.64);
      arch.lineTo(0.38, -0.64);
      arch.lineTo(0.38, 0.27);
      arch.quadraticCurveTo(0.34, 0.75, 0, 0.78);
      arch.quadraticCurveTo(-0.34, 0.75, -0.38, 0.27);
      arch.closePath();
      const pane = new THREE.Mesh(new THREE.ShapeGeometry(arch), glass);
      pane.position.set(x, 1.62, -2.17);
      group.add(pane);
      group.add(box(0.055, 1.42, 0.07, gold, x - 0.4, 1.63, -2.18));
      group.add(box(0.055, 1.42, 0.07, gold, x + 0.4, 1.63, -2.18));
      group.add(box(0.88, 0.06, 0.07, gold, x, 0.91, -2.18));
      group.add(box(0.88, 0.06, 0.07, gold, x, 2.33, -2.18));
      group.add(box(0.045, 0.98, 0.05, wood, x, 1.63, -2.2));
      group.add(box(0.7, 0.045, 0.05, wood, x, 1.61, -2.2));
    }
  }
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
    for (let i = 0; i < 3; i++) addPortrait(group, -1.35 + i * 1.35, 1.72, i);
    group.add(box(1.25, 0.8, 0.62, wood, 0, 0.5, 0.3));
  } else if (t === "observatory") {
    const tripodMat = new THREE.MeshStandardMaterial({
      color: 0x4a4034,
      metalness: 0.5,
      roughness: 0.42,
    });
    for (const [x, z] of [
      [-0.45, 0.35],
      [0.45, 0.35],
      [0, -0.42],
    ]) {
      const leg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.06, 1.22, 7),
        tripodMat,
      );
      leg.position.set(x, 0.68, z);
      leg.rotation.z = x * 0.35;
      group.add(leg);
    }
    const telescope = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.22, 1.6, 12),
      gold,
    );
    telescope.position.set(0, 1.62, -0.05);
    telescope.rotation.x = 0.9;
    group.add(telescope);
    const lens = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.2, 0.08, 12),
      cyan,
    );
    lens.position.set(0, 2.2, 0.22);
    lens.rotation.x = 0.9;
    group.add(lens);
    group.add(
      new THREE.Mesh(
        new THREE.SphereGeometry(0.35, 12, 8),
        new THREE.MeshBasicMaterial({ color: 0xd0be91 }),
      ),
    );
    group.children[group.children.length - 1].position.set(1.25, 2.05, -1.2);
  } else if (t === "laboratory") {
    group.add(box(2.1, 0.16, 0.8, wood, 0, 0.95, -0.6));
    for (let i = 0; i < 3; i++) {
      const flask = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.22, 0.55, 10),
        new THREE.MeshPhysicalMaterial({
          color: [0x6c9793, 0x8e5972, 0xb48b4d][i],
          transparent: true,
          opacity: 0.72,
          roughness: 0.15,
        }),
      );
      flask.position.set(-0.62 + i * 0.62, 1.32, -0.6);
      group.add(flask);
      const liquid = new THREE.Mesh(
        new THREE.CylinderGeometry(0.13, 0.17, 0.13, 10),
        new THREE.MeshBasicMaterial({
          color: [0x63c4b4, 0xb34882, 0xf0bb5a][i],
        }),
      );
      liquid.position.set(-0.62 + i * 0.62, 1.15, -0.6);
      group.add(liquid);
    }
    for (const x of [-0.85, 0.85])
      group.add(box(0.12, 0.9, 0.12, wood, x, 0.48, -0.6));
  } else if (t === "taxidermy") {
    for (const x of [-1.15, 1.15]) {
      group.add(box(0.62, 0.82, 0.16, wood, x, 1.55, -2.05));
      const skull = new THREE.Mesh(
        new THREE.SphereGeometry(0.26, 10, 8),
        new THREE.MeshStandardMaterial({ color: 0x9c8a6f, roughness: 0.95 }),
      );
      skull.position.set(x, 1.7, -1.82);
      group.add(skull);
      for (const side of [-1, 1]) {
        const horn = new THREE.Mesh(
          new THREE.ConeGeometry(0.09, 0.56, 7),
          new THREE.MeshStandardMaterial({ color: 0xb4a27e }),
        );
        horn.position.set(x + side * 0.31, 2.02, -1.82);
        horn.rotation.z = side * -0.55;
        group.add(horn);
      }
    }
    group.add(box(1.3, 0.12, 0.7, red, 0, 0.25, 0.7));
  } else if (t === "vault") {
    group.add(box(1.9, 2.35, 0.22, wood, 0, 1.3, -1.98));
    const door = new THREE.Mesh(
      new THREE.CylinderGeometry(0.82, 0.82, 0.16, 24),
      new THREE.MeshStandardMaterial({
        color: 0x4d5552,
        metalness: 0.78,
        roughness: 0.32,
      }),
    );
    door.rotation.x = Math.PI / 2;
    door.position.set(0, 1.35, -1.78);
    group.add(door);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.88, 0.07, 8, 24),
      gold,
    );
    ring.position.set(0, 1.35, -1.67);
    group.add(ring);
    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.17, 0.17, 0.23, 12),
      gold,
    );
    hub.rotation.x = Math.PI / 2;
    hub.position.set(0, 1.35, -1.58);
    group.add(hub);
    for (let i = 0; i < 8; i++) {
      const spoke = box(0.06, 0.56, 0.08, gold, 0, 1.35, -1.54);
      spoke.rotation.z = (i * Math.PI) / 4;
      group.add(spoke);
    }
  } else if (t === "impossible") {
    for (let i = 0; i < 4; i++) {
      const scale = 1 - i * 0.17,
        z = -1.65 - i * 0.2;
      group.add(
        box(
          0.08 * scale,
          2.05 * scale,
          0.08,
          gold,
          -0.65 * scale,
          1.12 * scale,
          z,
        ),
      );
      group.add(
        box(
          0.08 * scale,
          2.05 * scale,
          0.08,
          gold,
          0.65 * scale,
          1.12 * scale,
          z,
        ),
      );
      group.add(
        box(1.38 * scale, 0.08 * scale, 0.08, gold, 0, 2.15 * scale, z),
      );
    }
    const portal = new THREE.Mesh(
      new THREE.PlaneGeometry(1.15, 1.75),
      new THREE.MeshBasicMaterial({
        color: 0x326d78,
        transparent: true,
        opacity: 0.38,
        side: THREE.DoubleSide,
      }),
    );
    portal.position.set(0, 1.16, -1.58);
    group.add(portal);
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
  } else if (t === "boiler") {
    group.add(box(1.1, 1.25, 0.72, red, -0.8, 0.8, -1));
    group.add(box(1.28, 0.16, 0.82, gold, -0.8, 1.47, -1));
    const gauge = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.24, 0.08, 16),
      new THREE.MeshStandardMaterial({ color: 0xd5c8a2, metalness: 0.2 }),
    );
    gauge.rotation.x = Math.PI / 2;
    gauge.position.set(-0.8, 1.9, -1.37);
    group.add(gauge);
    const hand = box(0.025, 0.31, 0.025, red, -0.8, 1.9, -1.31);
    hand.rotation.z = -0.42;
    group.add(hand);
    for (const x of [-1.5, 0.1, 1.15]) {
      const pipe = new THREE.Mesh(
        new THREE.CylinderGeometry(0.055, 0.055, 2.4, 8),
        gold,
      );
      pipe.position.set(x, 1.3, -1.95);
      group.add(pipe);
      for (const y of [0.45, 1.15, 1.85])
        group.add(box(0.18, 0.12, 0.12, wood, x, y, -1.92));
    }
    const valve = new THREE.Mesh(
      new THREE.TorusGeometry(0.26, 0.045, 6, 12),
      red,
    );
    valve.position.set(0.8, 1.55, -1.4);
    group.add(valve);
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xe68946 }),
    );
    glow.position.set(-0.8, 0.75, -0.59);
    group.add(glow);
  } else if (t === "cellar" || t === "flooded") {
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
      water.userData.waterSurface = true;
      water.userData.baseY = water.position.y;
      group.add(water);
    }
  } else if (t === "funeral") {
    group.add(box(1.2, 0.72, 2.3, wood, 0, 0.48, -0.3));
    const lid = new THREE.Mesh(
      new THREE.CylinderGeometry(0.64, 0.72, 2.35, 6),
      new THREE.MeshStandardMaterial({ color: 0x412c2a, roughness: 0.72 }),
    );
    lid.rotation.x = Math.PI / 2;
    lid.scale.x = 0.84;
    lid.position.set(0, 0.88, -0.3);
    group.add(lid);
    for (const z of [-1.12, 0.52])
      group.add(box(0.12, 0.2, 0.08, gold, -0.62, 0.5, z));
    group.add(box(0.44, 0.08, 0.28, gold, 0, 1.3, -0.3));
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
      flame.userData.flame = true;
      flames.push(flame);
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
    orb.userData.spirit = true;
    orb.userData.baseY = orb.position.y;
    const aura = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture,
        color: hue,
        transparent: true,
        opacity: 0.36,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    aura.position.copy(orb.position);
    aura.position.z -= 0.12;
    aura.scale.set(1.7, 1.9, 1);
    aura.userData.hauntGlow = true;
    aura.userData.baseGlow = aura.scale.clone();
    group.add(aura, orb);
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
    light.userData.spiritLight = true;
    group.add(light);
  }
  // lantern pools and room labels are intentionally in-scene
  if (illuminate) {
    const point = new THREE.PointLight(0xffc477, 1.35, 7);
    point.userData.roomLight = true;
    point.position.set(-0.6, 2.3, 0.3);
    group.add(point);
    const chandelier = new THREE.Group();
    chandelier.add(box(0.08, 0.7, 0.08, gold, 0, h - 0.35, -0.2));
    const arms = new THREE.Mesh(
      new THREE.TorusGeometry(0.48, 0.035, 5, 20),
      gold,
    );
    arms.position.set(0, h - 0.7, -0.2);
    arms.rotation.x = Math.PI / 2;
    chandelier.add(arms);
    for (const [x, z] of [
      [-0.45, -0.2],
      [0.45, -0.2],
      [0, -0.65],
      [0, 0.25],
    ]) {
      chandelier.add(box(0.06, 0.24, 0.06, gold, x, h - 0.82, z));
      const flame = new THREE.Mesh(
        new THREE.SphereGeometry(0.065, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xffcf7f }),
      );
      flame.position.set(x, h - 0.66, z);
      flame.userData.flame = true;
      flames.push(flame);
      chandelier.add(flame);
    }
    group.add(chandelier);
  }
  scene.add(group);
  return group;
}
export default function Stage({
  state,
  onMove,
  onToggleMode,
  onExplore,
  onSearch,
  onEndTurn,
  hudOpen,
}: {
  state: GameState;
  onMove: (room: string) => void;
  onToggleMode: () => void;
  onExplore: (direction?: string) => void;
  onSearch: () => void;
  onEndTurn: () => void;
  hudOpen: boolean;
}) {
  const mount = useRef<HTMLDivElement>(null);
  const drag = useRef({ active: false, x: 0, y: 0, theta: 0, phi: 0.9 });
  const walk = useRef({ roomId: "", x: 0, z: 0 });
  const held = useRef(new Set<string>());
  const view = useRef({ mode: "explore", zoom: 8.4 });
  const knownRooms = useRef(new Set<string>());
  const knownSeed = useRef<number | null>(null);
  const step = useRef<(x: number, z: number) => void>(() => {});
  const cameraActions = useRef({ zoom: (delta: number) => {}, home: () => {} });
  const layoutKey = state.rooms
    .map(
      (r) =>
        `${r.id}:${r.template}:${r.x}:${r.y}:${r.floor}:${r.haunted || ""}:${r.links.join(",")}`,
    )
    .join("|");
  const currentPlayer = state.players[state.current];
  const currentRoomId = currentPlayer?.roomId || "";
  useEffect(() => {
    const el = mount.current;
    if (!el) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x151719);
    scene.fog = new THREE.Fog(0x151719, 28, 78);
    const tableSurface = new THREE.Mesh(
      new THREE.PlaneGeometry(220, 220),
      feltMaterial,
    );
    tableSurface.rotation.x = -Math.PI / 2;
    tableSurface.position.y = -0.54;
    tableSurface.receiveShadow = true;
    scene.add(tableSurface);
    const camera = new THREE.PerspectiveCamera(
      42,
      el.clientWidth / el.clientHeight,
      0.1,
      120,
    );
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    renderer.domElement.tabIndex = 0;
    renderer.domElement.setAttribute(
      "aria-label",
      "Haunted house room. Use WASD or arrow keys to walk, drag to look, and scroll to zoom.",
    );
    const coarsePointer =
      typeof matchMedia !== "undefined" &&
      matchMedia("(pointer: coarse)").matches;
    const deviceMemory =
      (navigator as Navigator & { deviceMemory?: number }).deviceMemory || 4;
    const qualityScale = deviceMemory <= 4 || coarsePointer ? 1.15 : 1.5;
    renderer.setPixelRatio(Math.min(devicePixelRatio, qualityScale));
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.shadowMap.enabled = deviceMemory > 2;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.appendChild(renderer.domElement);
    scene.add(new THREE.HemisphereLight(0xaab3b9, 0x251916, 1.12));
    const fill = new THREE.DirectionalLight(0x8da1b5, 0.48);
    fill.position.set(7, 8, -9);
    scene.add(fill);
    const key = new THREE.DirectionalLight(0xffd49a, 2.05);
    key.position.set(-8, 14, 8);
    key.castShadow = renderer.shadowMap.enabled;
    key.shadow.mapSize.set(
      coarsePointer ? 512 : 1024,
      coarsePointer ? 512 : 1024,
    );
    key.shadow.bias = -0.00018;
    key.shadow.normalBias = 0.025;
    key.shadow.radius = 3;
    scene.add(key);
    const mansion = new THREE.Group();
    scene.add(mansion);
    const roomsById = new Map<string, THREE.Group>();
    const cutawayMeshes: THREE.Mesh[] = [];
    const doorMeshes: THREE.Mesh[] = [];
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2(2, 2);
    let pointerDirty = false,
      pointerOnCanvas = false;
    let hoveredWall: THREE.Object3D | null = null;
    let hoveredDoor: THREE.Mesh | null = null;
    const gap = 5.3;
    const bounds = {
      minX: Math.min(...state.rooms.map((r) => r.x)),
      maxX: Math.max(...state.rooms.map((r) => r.x)),
      minZ: Math.min(...state.rooms.map((r) => r.y)),
      maxZ: Math.max(...state.rooms.map((r) => r.y)),
    };
    const boardW = (bounds.maxX - bounds.minX) * gap + 6.2;
    const boardD = (bounds.maxZ - bounds.minZ) * gap + 6.2;
    const boardX = ((bounds.maxX + bounds.minX) / 2) * gap;
    const boardZ = ((bounds.maxZ + bounds.minZ) / 2) * gap;
    const shadowExtent = Math.max(boardW, boardD) * 0.65;
    key.shadow.camera.left = -shadowExtent;
    key.shadow.camera.right = shadowExtent;
    key.shadow.camera.top = shadowExtent;
    key.shadow.camera.bottom = -shadowExtent;
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 48;
    key.shadow.camera.updateProjectionMatrix();
    key.position.set(boardX - 8, 14, boardZ + 8);
    key.target.position.set(boardX, 0, boardZ);
    scene.add(key.target);
    mansion.add(
      box(
        boardW,
        0.42,
        boardD,
        new THREE.MeshStandardMaterial({
          color: 0x221715,
          roughness: 0.72,
          metalness: 0.1,
        }),
        boardX,
        -0.28,
        boardZ,
      ),
    );
    mansion.add(
      box(boardW - 0.18, 0.035, boardD - 0.18, gold, boardX, -0.055, boardZ),
    );
    mansion.add(
      box(
        boardW - 0.32,
        0.045,
        boardD - 0.32,
        new THREE.MeshStandardMaterial({ color: 0x34231e, roughness: 0.8 }),
        boardX,
        -0.025,
        boardZ,
      ),
    );
    const railZ = boardD / 2 - 0.19;
    const railX = boardW / 2 - 0.19;
    mansion.add(
      box(boardW - 0.08, 0.14, 0.34, wood, boardX, 0.045, boardZ - railZ),
      box(boardW - 0.08, 0.14, 0.34, wood, boardX, 0.045, boardZ + railZ),
      box(0.34, 0.14, boardD - 0.72, wood, boardX - railX, 0.045, boardZ),
      box(0.34, 0.14, boardD - 0.72, wood, boardX + railX, 0.045, boardZ),
      box(boardW - 0.26, 0.025, 0.035, gold, boardX, 0.112, boardZ - railZ),
      box(boardW - 0.26, 0.025, 0.035, gold, boardX, 0.112, boardZ + railZ),
      box(0.035, 0.025, boardD - 0.9, gold, boardX - railX, 0.112, boardZ),
      box(0.035, 0.025, boardD - 0.9, gold, boardX + railX, 0.112, boardZ),
    );
    for (const x of [boardX - railX, boardX + railX])
      for (const z of [boardZ - railZ, boardZ + railZ]) {
        const rosette = new THREE.Mesh(
          new THREE.CylinderGeometry(0.17, 0.17, 0.055, 12),
          gold,
        );
        rosette.position.set(x, 0.135, z);
        rosette.castShadow = true;
        mansion.add(rosette);
      }
    const floorY = (f: number) => (f === 0 ? 0 : f === 1 ? 5 : -5);
    const coords = (r: any) =>
      new THREE.Vector3(r.x * gap, floorY(r.floor), r.y * gap);
    const activeRoomId = state.players[state.current].roomId;
    const freshExpedition = knownSeed.current !== state.seed;
    if (freshExpedition) {
      knownRooms.current.clear();
      knownSeed.current = state.seed;
    }
    for (const r of state.rooms) {
      const doorTargets: Record<string, string> = {};
      for (const id of r.links) {
        const linked = state.rooms.find((room) => room.id === id);
        if (!linked || linked.floor !== r.floor) continue;
        if (linked.x > r.x) doorTargets.east = linked.id;
        if (linked.x < r.x) doorTargets.west = linked.id;
        if (linked.y > r.y) doorTargets.south = linked.id;
        if (linked.y < r.y) doorTargets.north = linked.id;
      }
      const g = makeRoom(
        r,
        coords(r),
        mansion,
        doorTargets,
        r.id === activeRoomId,
        state.mode === "dollhouse",
      );
      if (!knownRooms.current.has(r.id) && !state.settings.reducedMotion) {
        g.scale.setScalar(0.015);
        g.userData.revealScale = 0.015;
        if (!freshExpedition)
          addDiscoveryBurst(g, r.haunted ? 0x8fd6d1 : 0xe3c27f);
      }
      knownRooms.current.add(r.id);
      roomsById.set(r.id, g);
      for (const part of g.children) {
        if (part.userData.cutaway) cutawayMeshes.push(part as THREE.Mesh);
        if (part.userData.doorHit) doorMeshes.push(part as THREE.Mesh);
      }
    }
    for (const r of state.rooms) {
      for (const id of r.links) {
        if (r.id > id) continue;
        const targetRoom = state.rooms.find((q) => q.id === id);
        if (!targetRoom) continue;
        const a = coords(r),
          b = coords(targetRoom),
          midX = (a.x + b.x) / 2,
          midZ = (a.z + b.z) / 2;
        const eastWest = a.x !== b.x;
        mansion.add(
          box(
            eastWest ? 0.92 : 1.52,
            0.12,
            eastWest ? 1.52 : 0.92,
            wood,
            midX,
            0.14,
            midZ,
          ),
        );
        for (const side of [-1, 1]) {
          if (eastWest) {
            mansion.add(
              box(0.14, 2.55, 0.14, wood, midX, 1.28, midZ + side * 0.72),
            );
            mansion.add(
              box(0.9, 0.17, 0.17, gold, midX, 2.55, midZ + side * 0.72),
            );
          } else {
            mansion.add(
              box(0.14, 2.55, 0.14, wood, midX + side * 0.72, 1.28, midZ),
            );
            mansion.add(
              box(0.17, 0.17, 0.9, gold, midX + side * 0.72, 2.55, midZ),
            );
          }
        }
      }
    }
    const p = state.players[state.current],
      current = state.rooms.find((r) => r.id === p.roomId) || state.rooms[0],
      cp = coords(current);
    if (walk.current.roomId !== current.id)
      walk.current = { roomId: current.id, x: 0, z: 0 };
    const avatar = new THREE.Group();
    const plinth = new THREE.Mesh(
      new THREE.CylinderGeometry(0.37, 0.37, FIGURE_BASE_HEIGHT, 16),
      new THREE.MeshStandardMaterial({
        color: 0x272322,
        metalness: 0.18,
        roughness: 0.72,
      }),
    );
    plinth.position.y = -FIGURE_BASE_HEIGHT / 2;
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    avatar.add(plinth);
    const plinthRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.335, 0.018, 6, 24),
      gold,
    );
    plinthRim.rotation.x = Math.PI / 2;
    plinthRim.position.y = -0.004;
    avatar.add(plinthRim);
    const outfitColor: Record<string, number> = {
      ada: 0x3d4a53,
      mara: 0x435755,
      eli: 0x6b4c35,
      iona: 0x543d42,
      silas: 0x272832,
      theo: 0x394239,
    };
    const outfit = new THREE.MeshStandardMaterial({
      color: outfitColor[p.id] || 0x4b3a32,
      roughness: 0.86,
    });
    const torsoShape =
      p.id === "mara"
        ? new THREE.ConeGeometry(0.39, 0.94, 8)
        : new THREE.CapsuleGeometry(0.27, 0.5, 4, 8);
    const body = new THREE.Mesh(torsoShape, outfit);
    body.position.y = 0.63;
    avatar.add(body);
    const arms: THREE.Mesh[] = [];
    const legs: THREE.Mesh[] = [];
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.075, 0.09, 0.38, 7),
        new THREE.MeshStandardMaterial({ color: 0x29262a, roughness: 0.9 }),
      );
      leg.position.set(side * 0.12, 0.2, 0.015);
      legs.push(leg);
      avatar.add(leg);
      const arm = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.075, 0.34, 3, 6),
        outfit,
      );
      arm.position.set(side * 0.29, 0.68, 0.02);
      arm.rotation.z = side * -0.18;
      arms.push(arm);
      avatar.add(arm);
      const boot = new THREE.Mesh(
        new THREE.BoxGeometry(0.17, 0.11, 0.28),
        wood,
      );
      boot.position.set(side * 0.12, 0.055, 0.07);
      avatar.add(boot);
    }
    const collar = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.25, 4), gold);
    collar.position.set(0, 0.98, 0.02);
    collar.rotation.y = Math.PI / 4;
    avatar.add(collar);
    const characterAccent: Record<string, number> = {
      ada: 0x93a7a2,
      mara: 0x9c6f72,
      eli: 0xb68c53,
      iona: 0x9a7374,
      silas: 0x9d8caf,
      theo: 0x87946d,
    };
    const scarf = new THREE.Mesh(
      new THREE.BoxGeometry(0.15, 0.48, 0.035),
      new THREE.MeshStandardMaterial({
        color: characterAccent[p.id] || 0xb08b5d,
        roughness: 0.72,
      }),
    );
    scarf.position.set(-0.09, 0.72, 0.255);
    scarf.rotation.z = -0.12;
    avatar.add(scarf);
    const buttonMaterial = new THREE.MeshStandardMaterial({
      color: 0xc5a45f,
      metalness: 0.55,
      roughness: 0.42,
    });
    for (const y of [0.52, 0.67, 0.82]) {
      const button = new THREE.Mesh(
        new THREE.SphereGeometry(0.026, 8, 6),
        buttonMaterial,
      );
      button.position.set(0.075, y, 0.265);
      avatar.add(button);
    }
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.21, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xe1cba8 }),
    );
    head.position.y = 1.18;
    avatar.add(head);
    const faceInk = new THREE.MeshStandardMaterial({
      color: 0x342725,
      roughness: 0.9,
    });
    for (const x of [-0.067, 0.067]) {
      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(0.022, 7, 5),
        faceInk,
      );
      eye.position.set(x, 1.21, 0.187);
      avatar.add(eye);
    }
    const nose = new THREE.Mesh(
      new THREE.SphereGeometry(0.032, 7, 5),
      new THREE.MeshStandardMaterial({ color: 0xc49f84, roughness: 0.92 }),
    );
    nose.position.set(0, 1.15, 0.205);
    avatar.add(nose);
    const hair = new THREE.MeshStandardMaterial({
      color: p.id === "silas" ? 0x18181c : 0x30231e,
      roughness: 0.9,
    });
    const headwear = new THREE.Group();
    if (p.id === "silas") {
      headwear.add(
        new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.08, 10), hair),
      );
      const crown = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.19, 0.32, 10),
        hair,
      );
      crown.position.y = 0.18;
      headwear.add(crown);
    } else if (p.id === "eli") {
      headwear.add(
        new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.045, 10), hair),
      );
      const crown = new THREE.Mesh(
        new THREE.CylinderGeometry(0.17, 0.2, 0.22, 8),
        hair,
      );
      crown.position.y = 0.12;
      headwear.add(crown);
    } else if (p.id === "mara") {
      const hood = new THREE.Mesh(
        new THREE.SphereGeometry(0.28, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0x293b3b, roughness: 0.95 }),
      );
      hood.position.y = 0.05;
      headwear.add(hood);
    } else if (p.id === "ada") {
      const bun = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), hair);
      bun.position.set(0, 0.2, -0.13);
      headwear.add(bun);
      const glasses = new THREE.Mesh(
        new THREE.TorusGeometry(0.075, 0.018, 5, 12),
        gold,
      );
      glasses.position.set(0, 0.02, 0.19);
      headwear.add(glasses);
    } else if (p.id === "iona") {
      const cap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.19, 0.21, 0.12, 8),
        new THREE.MeshStandardMaterial({ color: 0xddd2bc }),
      );
      cap.position.y = 0.12;
      headwear.add(cap);
    } else {
      const hairTop = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), hair);
      hairTop.position.y = 0.1;
      headwear.add(hairTop);
    }
    headwear.position.y = 1.34;
    avatar.add(headwear);
    const satchel = new THREE.Mesh(
      new THREE.BoxGeometry(0.29, 0.36, 0.2),
      new THREE.MeshStandardMaterial({ color: 0x593e2a, roughness: 0.9 }),
    );
    satchel.position.set(-0.28, 0.55, -0.12);
    avatar.add(satchel);
    let pendantMotion: THREE.Group | null = null;
    if (p.id === "ada") {
      const folio = box(0.17, 0.23, 0.065, red, -0.39, 0.48, 0.16);
      avatar.add(folio);
      avatar.add(box(0.018, 0.22, 0.075, gold, -0.39, 0.48, 0.196));
    } else if (p.id === "mara") {
      pendantMotion = new THREE.Group();
      pendantMotion.position.set(0.13, 0.88, 0.24);
      const chain = new THREE.Mesh(
        new THREE.CylinderGeometry(0.008, 0.008, 0.16, 6),
        gold,
      );
      chain.position.y = -0.08;
      pendantMotion.add(chain);
      const loop = new THREE.Mesh(
        new THREE.TorusGeometry(0.06, 0.012, 5, 12),
        gold,
      );
      loop.position.y = -0.17;
      pendantMotion.add(loop);
      const stone = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.045),
        new THREE.MeshStandardMaterial({
          color: 0x8fd6d5,
          emissive: 0x326768,
          emissiveIntensity: 0.45,
          roughness: 0.28,
          metalness: 0.18,
        }),
      );
      stone.position.y = -0.17;
      pendantMotion.add(stone);
      avatar.add(pendantMotion);
    } else if (p.id === "eli") {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.065, 0.012, 5, 12),
        gold,
      );
      ring.position.set(-0.34, 0.4, 0.12);
      avatar.add(ring);
      for (let i = 0; i < 2; i++) {
        const key = box(0.022, 0.16, 0.02, gold, -0.34 + i * 0.055, 0.29, 0.12);
        key.rotation.z = (i - 0.5) * 0.18;
        avatar.add(key);
        avatar.add(
          box(0.045, 0.02, 0.022, gold, -0.34 + i * 0.055, 0.23, 0.12),
        );
      }
    } else if (p.id === "iona") {
      const medical = new THREE.MeshStandardMaterial({
        color: 0xd9cdb8,
        roughness: 0.84,
      });
      avatar.add(
        box(0.12, 0.035, 0.025, medical, -0.28, 0.55, -0.005),
        box(0.035, 0.12, 0.025, medical, -0.28, 0.55, -0.005),
      );
    } else if (p.id === "silas") {
      const cane = new THREE.Mesh(
        new THREE.CylinderGeometry(0.024, 0.03, 0.92, 7),
        hair,
      );
      cane.position.set(-0.43, 0.48, 0.08);
      avatar.add(cane);
      const caneHead = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 8, 6),
        gold,
      );
      caneHead.position.set(-0.43, 0.96, 0.08);
      avatar.add(caneHead);
    } else {
      const crest = new THREE.Mesh(
        new THREE.TorusGeometry(0.075, 0.014, 5, 12),
        gold,
      );
      crest.position.set(0.14, 0.9, 0.26);
      avatar.add(crest);
      const signet = new THREE.Mesh(
        new THREE.SphereGeometry(0.032, 8, 6),
        gold,
      );
      signet.position.set(0.14, 0.9, 0.275);
      avatar.add(signet);
    }
    const lanternRig = new THREE.Group();
    lanternRig.position.set(0.34, 0.56, 0.16);
    avatar.add(lanternRig);
    const lanternBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.075, 0.085, 0.2, 10),
      gold,
    );
    lanternRig.add(lanternBody);
    const lanternGlass = new THREE.Mesh(
      new THREE.SphereGeometry(0.061, 10, 8),
      new THREE.MeshBasicMaterial({
        color: 0xffc668,
        transparent: true,
        opacity: 0.46,
      }),
    );
    lanternGlass.position.set(0, 0, 0.015);
    lanternRig.add(lanternGlass);
    const lanternFlame = new THREE.Mesh(
      new THREE.ConeGeometry(0.027, 0.09, 6),
      new THREE.MeshBasicMaterial({ color: 0xffe3a3 }),
    );
    lanternFlame.position.set(0, 0, 0.038);
    lanternRig.add(lanternFlame);
    for (const y of [-0.1, 0.1]) {
      const rim = new THREE.Mesh(
        new THREE.TorusGeometry(0.078, 0.012, 5, 12),
        gold,
      );
      rim.rotation.x = Math.PI / 2;
      rim.position.y = y;
      lanternRig.add(rim);
    }
    const handle = new THREE.Mesh(
      new THREE.TorusGeometry(0.064, 0.012, 5, 12, Math.PI),
      gold,
    );
    handle.rotation.x = Math.PI / 2;
    handle.position.y = 0.145;
    lanternRig.add(handle);
    const lantern = new THREE.PointLight(0xffbf65, 1.05, 4);
    lantern.position.set(0, 0.28, 0.08);
    lanternRig.add(lantern);
    avatar.position.set(
      cp.x + walk.current.x,
      cp.y + FIGURE_ROOT_Y,
      cp.z + walk.current.z,
    );
    mansion.add(avatar);
    // hover details and dust motes
    const dustGeo = new THREE.BufferGeometry();
    const dustCount = deviceMemory <= 2 ? 56 : 112;
    const pos = new Float32Array(dustCount * 3);
    const dustDrift = new Float32Array(dustCount);
    for (let i = 0; i < dustCount; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 24;
      pos[i * 3 + 1] = Math.random() * 8;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 24;
      dustDrift[i] = 0.035 + Math.random() * 0.07;
    }
    const dustPosition = new THREE.BufferAttribute(pos, 3);
    dustPosition.setUsage(THREE.DynamicDrawUsage);
    dustGeo.setAttribute("position", dustPosition);
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
    let target =
      state.mode === "dollhouse"
        ? new THREE.Vector3(boardX, 0, boardZ)
        : new THREE.Vector3(cp.x, 1, cp.z);
    let angle = drag.current.theta;
    let phi = drag.current.phi;
    const extentX =
      Math.max(...state.rooms.map((r) => r.x)) -
      Math.min(...state.rooms.map((r) => r.x));
    const extentZ =
      Math.max(...state.rooms.map((r) => r.y)) -
      Math.min(...state.rooms.map((r) => r.y));
    const fitZoom = Math.max(10, Math.max(extentX, extentZ) * gap * 1.15 + 5);
    const initialZoom = state.mode === "dollhouse" ? fitZoom : 8.4;
    let zoom =
      view.current.mode === state.mode ? view.current.zoom : initialZoom;
    const zoomBounds = () =>
      state.mode === "dollhouse" ? [8, Math.max(34, fitZoom * 2)] : [4.8, 15];
    const setZoom = (value: number) => {
      const [min, max] = zoomBounds();
      zoom = Math.max(min, Math.min(max, value));
      view.current = { mode: state.mode, zoom };
    };
    view.current = { mode: state.mode, zoom };
    camera.position.set(
      target.x + zoom * Math.sin(phi) * Math.sin(angle),
      target.y + zoom * Math.cos(phi),
      target.z + zoom * Math.sin(phi) * Math.cos(angle),
    );
    camera.lookAt(target);
    let alive = true;
    let raf = 0;
    const clock = new THREE.Clock();
    let velocityX = 0,
      velocityZ = 0;
    const obstacleMap: Record<string, [number, number, number, number][]> = {
      library: [
        [-1.3, -1.65, 0.43, 0.25],
        [0, 0.1, 0.75, 0.38],
        [1, -1.65, 0.42, 0.24],
      ],
      archive: [
        [-1.3, -1.65, 0.43, 0.25],
        [0, 0.1, 0.75, 0.38],
      ],
      study: [
        [-1.3, -1.65, 0.43, 0.25],
        [0, 0.1, 0.75, 0.38],
      ],
      nursery: [[-0.2, -0.9, 1.02, 0.72]],
      bedroom: [[-0.2, -0.9, 1.02, 0.72]],
      music: [[-0.4, -0.7, 0.88, 0.48]],
      dining: [[0, 0, 1.12, 0.62]],
      ballroom: [[0, 0, 1.12, 0.62]],
      gallery: [[0, 0.3, 0.75, 0.43]],
      chapel: [[0, 0.3, 0.75, 0.43]],
      parlor: [[0, 0.3, 0.75, 0.43]],
      cellar: [
        [-0.9, -1.1, 0.38, 0.4],
        [0, -1.1, 0.38, 0.4],
      ],
      boiler: [[-0.9, -1.1, 0.38, 0.4]],
    };
    const obstacles = obstacleMap[current.template] || [[0, 0.15, 0.58, 0.44]];
    const blocked = (x: number, z: number) =>
      obstacles.some(
        ([ox, oz, rx, rz]) =>
          Math.abs(x - ox) < rx + 0.23 && Math.abs(z - oz) < rz + 0.23,
      );
    const animate = () => {
      if (!alive) return;
      raf = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);
      if (state.mode === "explore") {
        let forward = 0,
          strafe = 0;
        if (held.current.has("w") || held.current.has("arrowup")) forward += 1;
        if (held.current.has("s") || held.current.has("arrowdown"))
          forward -= 1;
        if (held.current.has("d") || held.current.has("arrowright"))
          strafe += 1;
        if (held.current.has("a") || held.current.has("arrowleft")) strafe -= 1;
        const length = Math.hypot(forward, strafe) || 1;
        forward /= length;
        strafe /= length;
        const speed = held.current.has("shift") ? 1.65 : 0.95;
        const desiredVX =
          (-Math.sin(angle) * forward + Math.cos(angle) * strafe) * speed;
        const desiredVZ =
          (-Math.cos(angle) * forward - Math.sin(angle) * strafe) * speed;
        const ease = 1 - Math.exp(-14 * dt);
        velocityX += (desiredVX - velocityX) * ease;
        velocityZ += (desiredVZ - velocityZ) * ease;
        const nx = Math.max(
          -1.78,
          Math.min(1.78, walk.current.x + velocityX * dt),
        );
        const nz = Math.max(
          -1.78,
          Math.min(1.78, walk.current.z + velocityZ * dt),
        );
        if (
          !blocked(nx, walk.current.z) ||
          blocked(walk.current.x, walk.current.z)
        )
          walk.current.x = nx;
        else velocityX = 0;
        if (
          !blocked(walk.current.x, nz) ||
          blocked(walk.current.x, walk.current.z)
        )
          walk.current.z = nz;
        else velocityZ = 0;
        avatar.position.set(
          cp.x + walk.current.x,
          cp.y + FIGURE_ROOT_Y,
          cp.z + walk.current.z,
        );
        const pace = Math.hypot(velocityX, velocityZ);
        const gait = Math.min(1, pace / 1.25);
        const stride = state.settings.reducedMotion
          ? 0
          : Math.sin(clock.elapsedTime * 10.5) * gait;
        avatar.position.y =
          cp.y +
          FIGURE_ROOT_Y +
          (state.settings.reducedMotion
            ? 0
            : Math.sin(clock.elapsedTime * 21) * 0.014 * gait +
              Math.sin(clock.elapsedTime * 1.8) * 0.012);
        body.rotation.z = state.settings.reducedMotion
          ? 0
          : Math.sin(clock.elapsedTime * 5.2) * 0.018 * gait;
        arms[0].rotation.x = stride * 0.38;
        arms[1].rotation.x = -stride * 0.38;
        legs[0].rotation.x = -stride * 0.48;
        legs[1].rotation.x = stride * 0.48;
        if (pace > 0.08) {
          avatar.rotation.y = Math.atan2(velocityX, velocityZ);
          pointerDirty = true;
        }
      } else {
        velocityX = 0;
        velocityZ = 0;
        avatar.position.y =
          cp.y +
          FIGURE_ROOT_Y +
          (state.settings.reducedMotion
            ? 0
            : Math.sin(clock.elapsedTime * 1.8) * 0.012);
        body.rotation.z = 0;
        arms[0].rotation.x = state.settings.reducedMotion
          ? 0
          : Math.sin(clock.elapsedTime * 1.4) * 0.025;
        arms[1].rotation.x = state.settings.reducedMotion
          ? 0
          : -Math.sin(clock.elapsedTime * 1.4) * 0.025;
        legs[0].rotation.x = 0;
        legs[1].rotation.x = 0;
      }
      const walkingBlend = Math.min(1, Math.hypot(velocityX, velocityZ) / 1.25);
      const lanternSway = state.settings.reducedMotion
        ? 0
        : Math.sin(clock.elapsedTime * 10.5) * 0.075 * walkingBlend;
      lanternRig.rotation.z =
        lanternSway +
        (state.settings.reducedMotion
          ? 0
          : Math.sin(clock.elapsedTime * 2.1) * 0.025);
      if (pendantMotion)
        pendantMotion.rotation.z = state.settings.reducedMotion
          ? 0
          : Math.sin(clock.elapsedTime * (walkingBlend > 0.2 ? 6.2 : 2.2)) *
            (0.035 + walkingBlend * 0.09);
      const emberPulse = state.settings.reducedMotion
        ? 1
        : 1 + Math.sin(clock.elapsedTime * 8.5) * 0.045;
      lanternFlame.scale.set(
        emberPulse,
        emberPulse * (1 + Math.sin(clock.elapsedTime * 6) * 0.035),
        emberPulse,
      );
      (lanternFlame.material as THREE.MeshBasicMaterial).opacity =
        0.82 + (emberPulse - 1) * 0.6;
      lantern.intensity = 1.02 + (emberPulse - 1) * 0.7;
      if (state.mode === "explore") {
        const desired = new THREE.Vector3(
          cp.x + walk.current.x,
          1.15,
          cp.z + walk.current.z,
        );
        target.lerp(desired, 1 - Math.exp(-4.3 * dt));
      } else
        target.lerp(
          new THREE.Vector3(boardX, 0, boardZ),
          1 - Math.exp(-2.45 * dt),
        );
      const r = zoom;
      const desiredCam = new THREE.Vector3(
        target.x + r * Math.sin(phi) * Math.sin(angle),
        target.y + r * Math.cos(phi),
        target.z + r * Math.sin(phi) * Math.cos(angle),
      );
      camera.position.lerp(desiredCam, 1 - Math.exp(-2.75 * dt));
      camera.lookAt(target);
      if (pointerDirty || drag.current.active) {
        if (pointerOnCanvas) {
          camera.updateMatrixWorld(true);
          mansion.updateMatrixWorld(true);
          raycaster.setFromCamera(pointerNdc, camera);
          const hit = raycaster
            .intersectObjects(cutawayMeshes, false)
            .find((i) => i.object.visible && i.object.scale.y > 0.08);
          hoveredWall = hit?.object || null;
          const doorHit = raycaster
            .intersectObjects(doorMeshes, false)
            .find((i) => i.object.userData.roomId === activeRoomId);
          const nextDoor = (doorHit?.object as THREE.Mesh) || null;
          if (hoveredDoor && hoveredDoor !== nextDoor) {
            const previous = hoveredDoor.material as THREE.MeshBasicMaterial;
            previous.colorWrite = false;
            previous.opacity = 0;
          }
          if (nextDoor) {
            const material = nextDoor.material as THREE.MeshBasicMaterial;
            material.color.setHex(
              nextDoor.userData.doorTarget ? 0xe3c27f : 0x9ccfd0,
            );
            material.opacity = 0.16;
            material.colorWrite = true;
          }
          hoveredDoor = nextDoor;
          renderer.domElement.style.cursor = nextDoor ? "pointer" : "grab";
        } else {
          hoveredWall = null;
          if (hoveredDoor) {
            const previous = hoveredDoor.material as THREE.MeshBasicMaterial;
            previous.colorWrite = false;
            previous.opacity = 0;
          }
          hoveredDoor = null;
          renderer.domElement.style.cursor = "grab";
        }
        pointerDirty = false;
      }
      for (const roomGroup of roomsById.values()) {
        if (roomGroup.userData.revealScale) {
          const nextScale =
            roomGroup.userData.revealScale +
            (1 - roomGroup.userData.revealScale) * (1 - Math.exp(-4.7 * dt));
          roomGroup.userData.revealScale = nextScale > 0.985 ? 0 : nextScale;
          roomGroup.scale.setScalar(roomGroup.userData.revealScale || 1);
        }
        const fx = roomGroup.userData.discoveryBurst as
          | {
              ring: THREE.Mesh;
              sparks: THREE.Points;
              velocities: Float32Array;
              age: number;
            }
          | undefined;
        if (fx) {
          fx.age += dt;
          const life = Math.min(1, fx.age / 1.35);
          fx.ring.scale.setScalar(0.45 + life * 1.5);
          (fx.ring.material as THREE.MeshBasicMaterial).opacity =
            0.72 * (1 - life);
          const sparkMaterial = fx.sparks.material as THREE.PointsMaterial;
          sparkMaterial.opacity = 0.82 * (1 - life);
          const sparkPosition = fx.sparks.geometry.attributes
            .position as THREE.BufferAttribute;
          const values = sparkPosition.array as Float32Array;
          for (let i = 0; i < values.length; i += 3) {
            fx.velocities[i + 1] -= 0.85 * dt;
            values[i] += fx.velocities[i] * dt;
            values[i + 1] += fx.velocities[i + 1] * dt;
            values[i + 2] += fx.velocities[i + 2] * dt;
          }
          sparkPosition.needsUpdate = true;
          if (life >= 1) {
            roomGroup.remove(fx.ring, fx.sparks);
            fx.ring.geometry.dispose();
            (fx.ring.material as THREE.Material).dispose();
            fx.sparks.geometry.dispose();
            (fx.sparks.material as THREE.Material).dispose();
            roomGroup.userData.discoveryBurst = undefined;
          }
        }
        const dx = camera.position.x - roomGroup.position.x;
        const dz = camera.position.z - roomGroup.position.z;
        const frontSide =
          Math.abs(dx) > Math.abs(dz)
            ? dx > 0
              ? "east"
              : "west"
            : dz > 0
              ? "south"
              : "north";
        const roomFlames = roomGroup.userData.flames as
          THREE.Object3D[] | undefined;
        roomFlames?.forEach((flame, index) => {
          const shimmer = state.settings.reducedMotion
            ? 1
            : 1 + Math.sin(clock.elapsedTime * 8 + index * 2.1) * 0.05;
          flame.scale.set(shimmer * 0.92, shimmer, shimmer * 0.92);
        });
        for (const part of roomGroup.children) {
          if (part.userData.hauntGlow && part instanceof THREE.Sprite) {
            const pulse = state.settings.reducedMotion
              ? 1
              : 1 +
                Math.sin(clock.elapsedTime * 1.7 + roomGroup.position.x) *
                  0.055;
            part.scale.copy(part.userData.baseGlow).multiplyScalar(pulse);
            (part.material as THREE.SpriteMaterial).opacity = state.settings
              .reducedMotion
              ? 0.31
              : 0.31 +
                Math.sin(clock.elapsedTime * 2.2 + roomGroup.position.z) * 0.04;
          }
          if (part.userData.spiritLight && part instanceof THREE.PointLight)
            part.intensity = state.settings.reducedMotion
              ? 1.48
              : 1.48 +
                Math.sin(clock.elapsedTime * 2.8 + roomGroup.position.x) * 0.12;
          if (part.userData.waterSurface)
            part.position.y = state.settings.reducedMotion
              ? part.userData.baseY
              : part.userData.baseY +
                Math.sin(clock.elapsedTime * 1.25 + roomGroup.position.x) *
                  0.012;
          if (part.userData.spirit) {
            part.position.y = state.settings.reducedMotion
              ? part.userData.baseY
              : part.userData.baseY +
                Math.sin(clock.elapsedTime * 1.4 + roomGroup.position.x) * 0.12;
            if (!state.settings.reducedMotion) part.rotation.y += 0.36 * dt;
          }
          if (part.userData.roomLight && part instanceof THREE.PointLight)
            part.intensity = state.settings.reducedMotion
              ? 1.22
              : 1.22 +
                Math.sin(clock.elapsedTime * 3.6 + roomGroup.position.z) * 0.09;
          const cut = part.userData.cutaway as
            { side: string; baseY: number; height: number } | undefined;
          if (!cut) continue;
          const shouldFold =
            state.mode === "dollhouse" ||
            cut.side === frontSide ||
            part === hoveredWall;
          const foldedScale = shouldFold ? 0.025 : 1;
          const foldEase = state.settings.reducedMotion
            ? 1
            : 1 - Math.exp(-10.4 * dt);
          part.scale.y += (foldedScale - part.scale.y) * foldEase;
          part.position.y = cut.baseY - (cut.height * (1 - part.scale.y)) / 2;
          part.visible = part.scale.y > 0.035;
        }
      }
      if (!state.settings.reducedMotion) {
        for (let i = 0; i < dustCount; i++) {
          const k = i * 3;
          pos[k + 1] += dustDrift[i] * dt;
          pos[k] += Math.sin(clock.elapsedTime * 0.35 + i) * dt * 0.012;
          if (pos[k + 1] > 8) pos[k + 1] = 0;
        }
        dustGeo.attributes.position.needsUpdate = true;
      }
      renderer.render(scene, camera);
    };
    animate();
    step.current = (forward, strafe) => {
      if (state.mode !== "explore") return;
      const dx = -Math.sin(angle) * forward + Math.cos(angle) * strafe;
      const dz = -Math.cos(angle) * forward - Math.sin(angle) * strafe;
      const nx = Math.max(-1.72, Math.min(1.72, walk.current.x + dx * 0.42));
      const nz = Math.max(-1.72, Math.min(1.72, walk.current.z + dz * 0.42));
      if (!blocked(nx, nz) || blocked(walk.current.x, walk.current.z)) {
        walk.current.x = nx;
        walk.current.z = nz;
        avatar.position.set(cp.x + nx, cp.y + FIGURE_ROOT_Y, cp.z + nz);
      }
    };
    cameraActions.current.zoom = (delta) => setZoom(zoom + delta);
    cameraActions.current.home = () => {
      angle = 0;
      phi = 0.9;
      drag.current.theta = 0;
      drag.current.phi = phi;
      setZoom(state.mode === "dollhouse" ? fitZoom : 8.4);
    };
    const keydown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target?.matches("input,textarea,select,button,[contenteditable=true]")
      )
        return;
      const key = e.key.toLowerCase();
      if (key === "m") {
        e.preventDefault();
        onToggleMode();
        return;
      }
      if (key === "e" && state.phase === "play") {
        e.preventDefault();
        onExplore();
        return;
      }
      if (key === "q" && state.phase === "play") {
        e.preventDefault();
        onSearch();
        return;
      }
      if (/^[1-4]$/.test(key)) {
        const exits =
          state.rooms.find(
            (room) => room.id === state.players[state.current].roomId,
          )?.links || [];
        const destination = exits[Number(key) - 1];
        if (destination) {
          e.preventDefault();
          onMove(destination);
        }
        return;
      }
      if ((key === "enter" || key === " ") && !state.event) {
        e.preventDefault();
        onEndTurn();
        return;
      }
      if (key === "r") {
        cameraActions.current.home();
        return;
      }
      if (key === "+" || key === "=") {
        cameraActions.current.zoom(-0.9);
        return;
      }
      if (key === "-" || key === "_") {
        cameraActions.current.zoom(0.9);
        return;
      }
      if (state.mode !== "explore") return;
      if (
        [
          "w",
          "a",
          "s",
          "d",
          "arrowup",
          "arrowleft",
          "arrowdown",
          "arrowright",
          "shift",
        ].includes(key)
      ) {
        e.preventDefault();
        held.current.add(key);
      }
    };
    const keyup = (e: KeyboardEvent) =>
      held.current.delete(e.key.toLowerCase());
    const clearHeld = () => held.current.clear();
    window.addEventListener("keydown", keydown);
    window.addEventListener("keyup", keyup);
    window.addEventListener("blur", clearHeld);
    const resize = () => {
      if (!el) return;
      camera.aspect = el.clientWidth / el.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(el.clientWidth, el.clientHeight);
    };
    window.addEventListener("resize", resize);
    let pressX = 0,
      pressY = 0;
    const down = (e: PointerEvent) => {
      if (e.button !== 0) return;
      renderer.domElement.focus();
      pressX = e.clientX;
      pressY = e.clientY;
      const rect = renderer.domElement.getBoundingClientRect();
      pointerNdc.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      drag.current.active = true;
      drag.current.x = e.clientX;
      drag.current.y = e.clientY;
      renderer.domElement.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointerNdc.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      pointerOnCanvas =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;
      pointerDirty = true;
      if (!drag.current.active) return;
      const dx = e.clientX - drag.current.x,
        dy = e.clientY - drag.current.y;
      drag.current.x = e.clientX;
      drag.current.y = e.clientY;
      angle -= dx * 0.004;
      phi = Math.max(0.28, Math.min(1.35, phi + dy * 0.0035));
      drag.current.theta = angle;
      drag.current.phi = phi;
    };
    const leaveCanvas = () => {
      pointerOnCanvas = false;
      pointerDirty = true;
      hoveredWall = null;
    };
    const up = (e: PointerEvent) => {
      const wasClick =
        drag.current.active &&
        Math.hypot(e.clientX - pressX, e.clientY - pressY) < 6;
      drag.current.active = false;
      if (!wasClick) return;
      camera.updateMatrixWorld(true);
      mansion.updateMatrixWorld(true);
      raycaster.setFromCamera(pointerNdc, camera);
      const roomId = state.players[state.current].roomId;
      const door = raycaster
        .intersectObjects(doorMeshes, false)
        .find((hit) => hit.object.userData.roomId === roomId)?.object;
      if (!door) return;
      if (door.userData.doorTarget) onMove(door.userData.doorTarget);
      else onExplore(door.userData.doorSide);
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoom(zoom + e.deltaY * 0.012);
    };
    const pointerCancel = () => {
      drag.current.active = false;
      held.current.clear();
    };
    const doubleClick = () => cameraActions.current.home();
    renderer.domElement.addEventListener("pointerdown", down);
    renderer.domElement.addEventListener("pointermove", move);
    renderer.domElement.addEventListener("pointerleave", leaveCanvas);
    renderer.domElement.addEventListener("pointerup", up);
    renderer.domElement.addEventListener("pointercancel", pointerCancel);
    renderer.domElement.addEventListener("dblclick", doubleClick);
    renderer.domElement.addEventListener("wheel", wheel, { passive: false });
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("keyup", keyup);
      window.removeEventListener("blur", clearHeld);
      renderer.domElement.removeEventListener("pointerdown", down);
      renderer.domElement.removeEventListener("pointermove", move);
      renderer.domElement.removeEventListener("pointerleave", leaveCanvas);
      renderer.domElement.removeEventListener("pointerup", up);
      renderer.domElement.removeEventListener("pointercancel", pointerCancel);
      renderer.domElement.removeEventListener("dblclick", doubleClick);
      renderer.domElement.removeEventListener("wheel", wheel);
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>();
      const dynamicTextures = new Set<THREE.Texture>();
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.Points) {
          geometries.add(o.geometry);
          if (Array.isArray(o.material))
            o.material.forEach((m) => materials.add(m));
          else materials.add(o.material);
        } else if (o instanceof THREE.Sprite) {
          materials.add(o.material);
          if (o.userData.disposeTexture && o.material.map)
            dynamicTextures.add(o.material.map);
        }
      });
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      dynamicTextures.forEach((texture) => texture.dispose());
      renderer.dispose();
    };
  }, [
    layoutKey,
    currentRoomId,
    currentPlayer?.id,
    state.current,
    state.mode,
    state.phase,
    state.settings.reducedMotion,
  ]);
  const mapSpread = Math.max(
    1,
    ...state.rooms.map((r) => Math.max(Math.abs(r.x), Math.abs(r.y))),
  );
  const mapScale = 44 / mapSpread;
  const dpad = (key: string, forward: number, strafe: number) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      held.current.add(key);
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* optional on older touch browsers */
      }
    },
    onPointerUp: () => held.current.delete(key),
    onPointerCancel: () => held.current.delete(key),
    onPointerLeave: () => held.current.delete(key),
    onClick: () => step.current(forward, strafe),
  });
  return (
    <div className={`stage-wrap ${hudOpen ? "show-controls" : ""}`}>
      <div className="stage" ref={mount} />
      <div className="scene-caption">
        <span className="live-dot" />{" "}
        {state.mode === "dollhouse"
          ? "THE LIVING FLOOR PLAN"
          : "INSIDE THE HOUSE"}{" "}
        <span className="scene-hint">Drag to orbit · scroll to zoom</span>
      </div>
      <div className="camera-controls" aria-label="Camera controls">
        <button
          aria-label="Zoom out"
          title="Zoom out (−)"
          onClick={() => cameraActions.current.zoom(1)}
        >
          <Minus size={14} />
        </button>
        <button
          aria-label="Center camera"
          title="Center camera (R)"
          onClick={() => cameraActions.current.home()}
        >
          <Crosshair size={14} />
        </button>
        <button
          aria-label="Zoom in"
          title="Zoom in (+)"
          onClick={() => cameraActions.current.zoom(-1)}
        >
          <Plus size={14} />
        </button>
      </div>
      <div className="controls-hint">
        {state.mode === "explore" ? (
          <>
            WASD / ARROWS <b>·</b> SHIFT HURRY <b>·</b> E NEW DOOR <b>·</b> Q
            SEARCH <b>·</b> 1–4 EXIT <b>·</b> M MAP <b>·</b> R CENTER
          </>
        ) : (
          <>
            DRAG TO ORBIT <b>·</b> SCROLL TO ZOOM <b>·</b> CLICK A CONNECTED
            ROOM TO MOVE
          </>
        )}
      </div>
      {state.mode === "explore" && (
        <div className="walk-controls" aria-label="Move explorer">
          <button aria-label="Move forward" {...dpad("w", 1, 0)}>
            ↑
          </button>
          <div>
            <button aria-label="Move left" {...dpad("a", 0, -1)}>
              ←
            </button>
            <button aria-label="Move backward" {...dpad("s", -1, 0)}>
              ↓
            </button>
            <button aria-label="Move right" {...dpad("d", 0, 1)}>
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
