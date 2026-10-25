import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { createSea, waveHeight } from "./ocean3d.js";
import { makeDock, makeBridge, makeBoat, createBoats, createGulls, createWalkers, makeBubble } from "./props3d.js";

const data = await (await fetch("content.json")).json();

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87b5e8);
scene.fog = new THREE.Fog(0x87b5e8, 90, 220);

const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 300);
camera.position.set(0, 34, 70);

// 依視窗寬高比調整距離,讓所有島嶼都入鏡
function fitCamera() {
  const width = (data.districts.length - 1) * 19 + 22;
  const dist = Math.max(55, width / 2 / (Math.tan(THREE.MathUtils.degToRad(22.5)) * camera.aspect));
  camera.position.set(0, dist * 0.42, dist);
}
fitCamera();

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI / 2.1;
controls.minDistance = 10;
controls.maxDistance = 120;
controls.target.set(0, 2, 0);

scene.add(new THREE.HemisphereLight(0xffffff, 0x3a5f8f, 0.8));
const sun = new THREE.DirectionalLight(0xfff1cc, 1.6);
sun.position.set(25, 40, 20);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40 });
scene.add(sun);

// 海面在島嶼建立後才加入(shader 需要島嶼位置做泡沫與淺水色)
let sea;

// Kenney City Kit (Commercial), CC0。每個分類依等級 0~2 挑選不同模型
const MODEL_DIR = "assets/models/kenney-city/";
const CATEGORY = {
  blog: { models: ["building-d", "building-a", "building-c"], footprint: 2.4 },
  youtube: { models: ["building-skyscraper-e", "building-skyscraper-b", "building-skyscraper-a"], footprint: 2.6 },
  speech: { models: ["building-h", "building-i", "building-f"], footprint: 3.2 },
  book: { models: ["building-skyscraper-d", "building-skyscraper-c", "building-skyscraper-a"], footprint: 2.6 },
};

const loader = new GLTFLoader();
const modelCache = {};
await Promise.all(
  [...new Set(Object.values(CATEGORY).flatMap((c) => c.models))].map(
    (name) => loader.loadAsync(`${MODEL_DIR}${name}.glb`).then((g) => (modelCache[name] = g.scene))
  )
);

// 複製模型並縮放到指定底面寬度,底部對齊 y=0
function makeBuilding(name, footprint) {
  const m = modelCache[name].clone(true);
  const box = new THREE.Box3().setFromObject(m);
  const size = box.getSize(new THREE.Vector3());
  const k = Math.min(footprint / Math.max(size.x, size.z), 6 / size.y);
  m.scale.setScalar(k);
  m.position.y = -box.min.y * k;
  m.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
  const wrap = new THREE.Group();
  wrap.add(m);
  wrap.userData.height = size.y * k;
  return wrap;
}

function getLevel(item) {
  const v = Object.values(item.metric || {})[0] || 0;
  return v >= 20000 ? 2 : v >= 5000 ? 1 : 0;
}

const SPACING = 19;
const BUILDING_GAP = 4.6;
const ISLAND_R = 8;
const clickable = [];
const islands = [];
const swayers = [];
const offsetX = ((data.districts.length - 1) * SPACING) / 2;

// 固定種子的亂數,讓每次載入裝飾位置一致
function rng(seed) {
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
}

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, ...extra });
const M = {
  trunk: mat(0x7b5230), leaf: mat(0x3f9142), leaf2: mat(0x66bb6a), pine: mat(0x2e7d32),
  rock: mat(0x9e9e9e), pole: mat(0x37474f), lamp: mat(0xfff59d, { emissive: 0xffe082, emissiveIntensity: 0.9 }),
  petals: [0xf06292, 0xffd54f, 0xffffff, 0xba68c8].map((c) => mat(c)),
};
const mesh = (geo, m, x, y, z) => {
  const o = new THREE.Mesh(geo, m);
  o.position.set(x, y, z);
  o.castShadow = o.receiveShadow = true;
  return o;
};

function makePine(r) {
  const g = new THREE.Group();
  const s = 0.8 + r() * 0.7;
  g.add(mesh(new THREE.CylinderGeometry(0.12, 0.18, 0.6, 6), M.trunk, 0, 0.3, 0));
  [[0.9, 1.1, 0.8], [0.7, 1.0, 1.5], [0.5, 0.9, 2.1]].forEach(([rad, h, y]) =>
    g.add(mesh(new THREE.ConeGeometry(rad, h, 7), M.pine, 0, y, 0)));
  g.scale.setScalar(s);
  return g;
}

function makeRoundTree(r) {
  const g = new THREE.Group();
  const s = 0.8 + r() * 0.6;
  g.add(mesh(new THREE.CylinderGeometry(0.14, 0.2, 1, 6), M.trunk, 0, 0.5, 0));
  g.add(mesh(new THREE.IcosahedronGeometry(0.85, 0), r() > 0.5 ? M.leaf : M.leaf2, 0, 1.5, 0));
  g.add(mesh(new THREE.IcosahedronGeometry(0.55, 0), M.leaf2, 0.45, 1.2, 0.2));
  g.scale.setScalar(s);
  return g;
}

function makeBush(r) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.IcosahedronGeometry(0.4 + r() * 0.2, 0), M.leaf, 0, 0.3, 0));
  g.add(mesh(new THREE.IcosahedronGeometry(0.3, 0), M.leaf2, 0.35, 0.22, 0.1));
  return g;
}

function makeRock(r) {
  const o = mesh(new THREE.DodecahedronGeometry(0.3 + r() * 0.35, 0), M.rock, 0, 0.2, 0);
  o.scale.set(1, 0.7, 1.1);
  o.rotation.y = r() * 6;
  return o;
}

function makeFlowers(r) {
  const g = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const a = r() * 6.28, d = r() * 0.5;
    g.add(mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.25, 4), M.leaf, Math.cos(a) * d, 0.12, Math.sin(a) * d));
    g.add(mesh(new THREE.IcosahedronGeometry(0.09, 0), M.petals[Math.floor(r() * 4)], Math.cos(a) * d, 0.28, Math.sin(a) * d));
  }
  return g;
}

function makeLamp() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.8, 6), M.pole, 0, 0.9, 0));
  g.add(mesh(new THREE.SphereGeometry(0.17, 8, 6), M.lamp, 0, 1.9, 0));
  return g;
}

function decorateIsland(group, seed, span) {
  const r = rng(seed * 7919 + 13);
  const kinds = [
    [makePine, 5, true], [makeRoundTree, 5, true], [makeBush, 8, false],
    [makeRock, 5, false], [makeFlowers, 8, false],
  ];
  const placed = [];
  const free = (x, z, gap) =>
    !(Math.abs(z) < 2.6 && Math.abs(x) < span + 2.2) &&
    !(Math.abs(z) < 1.8) && // 橋梁通道
    !(Math.abs(z - 3.4) < 1 && Math.abs(x) < 6.5) && // 行人步道
    !(Math.abs(x) < 1.6 && z > 4.5) && // 碼頭入口
    placed.every(([px, pz]) => Math.hypot(px - x, pz - z) > gap);

  kinds.forEach(([make, count, sways]) => {
    for (let n = 0, tries = 0; n < count && tries < 200; tries++) {
      const a = r() * Math.PI * 2;
      const dist = 2 + Math.sqrt(r()) * (ISLAND_R * 0.82 - 2);
      const x = Math.cos(a) * dist, z = Math.sin(a) * dist;
      if (!free(x, z, 1.1)) continue;
      const o = make(r);
      o.position.set(x, 0.7, z);
      o.rotation.y = r() * 6.28;
      group.add(o);
      placed.push([x, z]);
      n++;
      if (sways) swayers.push({ o, phase: r() * 6 });
    }
  });

  // 路燈沿著建築排兩側
  [-1, 1].forEach((side) => {
    for (let k = 0; k < 2; k++) {
      const lamp = makeLamp();
      lamp.position.set((k === 0 ? -1 : 1) * (span + 1.4), 0.7, side * 2.2);
      group.add(lamp);
    }
  });
}

data.districts.forEach((d, i) => {
  const cx = i * SPACING - offsetX;
  const group = new THREE.Group();
  group.position.set(cx, 0, 0);
  scene.add(group);

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(ISLAND_R, ISLAND_R * 1.16, 1.2, 8),
    new THREE.MeshStandardMaterial({ color: new THREE.Color(d.color), roughness: 0.8, flatShading: true })
  );
  base.position.y = 0.1;
  base.castShadow = base.receiveShadow = true;
  group.add(base);

  const sand = new THREE.Mesh(
    new THREE.CylinderGeometry(ISLAND_R * 1.12, ISLAND_R * 1.24, 0.5, 8),
    new THREE.MeshStandardMaterial({ color: 0xe6d3a3, flatShading: true })
  );
  sand.position.y = -0.2;
  group.add(sand);

  group.add(makeLabel(d.name, 0, 11));
  islands.push({ group, phase: i });

  const items = data.items.filter((it) => it.district === d.id);
  decorateIsland(group, i + 1, ((items.length - 1) * BUILDING_GAP) / 2);
  items.forEach((item, idx) => {
    const style = CATEGORY[item.category] || CATEGORY.blog;
    const level = getLevel(item);
    const bx = (idx - (items.length - 1) / 2) * BUILDING_GAP;

    const b = makeBuilding(style.models[level], style.footprint);
    b.position.set(bx, 0.7, 0);
    const bodyHeight = b.userData.height;
    b.userData.item = item;

    // 等級星星
    for (let s = 0; s <= level; s++) {
      const star = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.28),
        new THREE.MeshStandardMaterial({ color: 0xffd54f, emissive: 0xffa000, emissiveIntensity: 0.6 })
      );
      star.position.set((s - level / 2) * 0.7, bodyHeight + 0.8, 0);
      star.userData.spin = true;
      b.add(star);
    }

    clickable.push(b);
    group.add(b);
  });
});

function makeLabel(text, x, y) {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 96;
  const g = c.getContext("2d");
  g.fillStyle = "rgba(0,0,0,0.55)";
  g.roundRect(8, 8, 240, 80, 16); g.fill();
  g.fillStyle = "#fff";
  g.font = "bold 44px 'Microsoft JhengHei', sans-serif";
  g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(text, 128, 50);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false }));
  sp.scale.set(4.5, 1.7, 1);
  sp.position.set(x, y, 0);
  return sp;
}

// 海面、碼頭、橋梁、小船、海鷗
const centers = islands.map(({ group }) => ({ x: group.position.x, z: 0 }));
sea = createSea(centers, ISLAND_R * 1.2, 0x87b5e8, sun.position);
scene.add(sea);

const bobbers = [];
centers.forEach((c, i) => {
  const dock = makeDock(4.5);
  dock.position.set(c.x, 0.7, ISLAND_R - 1.6);
  scene.add(dock);

  const moored = makeBoat();
  moored.scale.setScalar(0.8);
  moored.rotation.y = -Math.PI / 2;
  moored.userData.base = new THREE.Vector3(c.x + 1.8, 0, ISLAND_R + 1.6);
  scene.add(moored);
  bobbers.push(moored);

  if (i < centers.length - 1) {
    const x0 = c.x + ISLAND_R - 1;
    const len = centers[i + 1].x - ISLAND_R + 1 - x0;
    const bridge = makeBridge(len);
    bridge.position.set(x0, 0.7, 0);
    scene.add(bridge);
  }
});

const boats = createBoats([
  { x0: -48, x1: 48, z: 22, speed: 2.2, offset: 0, scale: 1.3 },
  { x0: -48, x1: 48, z: 30, speed: 1.6, offset: 60, scale: 1.1 },
  { x0: -48, x1: 48, z: -16, speed: 1.9, offset: 25, scale: 1 },
]);
boats.meshes.forEach((m) => scene.add(m));

const gulls = createGulls(10, centers);
gulls.meshes.forEach((m) => scene.add(m));

// 行人路線:島上沿建築前方步道走,過橋到下一座島
const WALK_Z = 3.4;
const walkPath = [];
centers.forEach((c, i) => {
  walkPath.push({ x: c.x - 5.5, z: WALK_Z }, { x: c.x + 5.5, z: WALK_Z });
  if (i < centers.length - 1) {
    walkPath.push({ x: c.x + ISLAND_R - 1, z: 0 }, { x: centers[i + 1].x - ISLAND_R + 1, z: 0 });
  }
});

function groundY(x, z, t) {
  for (let i = 0; i < centers.length - 1; i++) {
    const x0 = centers[i].x + ISLAND_R - 1, x1 = centers[i + 1].x - ISLAND_R + 1;
    if (x > x0 && x < x1) {
      const u = (x - x0) / (x1 - x0);
      return 0.7 + 4 * 0.8 * u * (1 - u) + 0.05;
    }
  }
  const idx = centers.reduce((best, c, i) => (Math.abs(x - c.x) < Math.abs(x - centers[best].x) ? i : best), 0);
  return 0.75 + Math.sin(t * 0.9 + islands[idx].phase) * 0.12;
}

const walkers = createWalkers(walkPath, groundY, 10, 1.1);
walkers.meshes.forEach((m) => scene.add(m));

// 互動:hover / 點擊
const ray = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const tip = document.getElementById("tip");
let hovered = null;
let downPos = null;

function pick(e) {
  mouse.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(mouse, camera);
  const hit = ray.intersectObjects([...clickable, ...walkers.meshes], true)[0];
  if (!hit) return null;
  let o = hit.object;
  while (o && !o.userData.item && !o.userData.walker) o = o.parent;
  return o;
}

const GREETINGS = [
  "今天天氣真好~",
  "這座城市又長大了!",
  "要不要去逛逛?",
  "歡迎來到履歷城市!",
  "我正要去看展覽~",
];

function talk(person, t) {
  const old = person.getObjectByName("bubble");
  if (old) person.remove(old);
  const titles = data.items.map((i) => i.title);
  const lines = [...GREETINGS, ...titles.map((s) => `推薦看看《${s}》!`)];
  const bubble = makeBubble(lines[Math.floor(Math.random() * lines.length)]);
  bubble.name = "bubble";
  bubble.position.set(0, 1.9, 0);
  person.add(bubble);
  person.userData.walker.pausedUntil = t + 3.5;
  person.userData.bubbleUntil = t + 3.5;
}

addEventListener("pointermove", (e) => {
  hovered = pick(e);
  document.body.style.cursor = hovered ? "pointer" : "default";
  if (hovered && hovered.userData.item) {
    tip.style.display = "block";
    tip.style.left = e.clientX + 12 + "px";
    tip.style.top = e.clientY + 12 + "px";
    tip.textContent = hovered.userData.item.title;
  } else tip.style.display = "none";
});
addEventListener("pointerdown", (e) => (downPos = [e.clientX, e.clientY]));
addEventListener("pointerup", (e) => {
  if (!downPos || Math.hypot(e.clientX - downPos[0], e.clientY - downPos[1]) > 5) return;
  const obj = pick(e);
  if (!obj) return;
  if (obj.userData.item) showPanel(obj.userData.item);
  else talk(obj, clock.getElapsedTime());
});

function showPanel(item) {
  document.getElementById("panel-title").innerText = item.title;
  const m = Object.entries(item.metric || {}).map(([k, v]) => `${k}: ${v.toLocaleString()}`).join(" ・ ");
  document.getElementById("panel-meta").innerText = `${item.date} ・ ${m}`;
  document.getElementById("panel-desc").innerText = item.description || "";
  const a = document.getElementById("panel-link");
  a.style.display = item.link ? "inline-block" : "none";
  if (item.link) a.href = item.link;
  document.getElementById("ui-panel").classList.add("open");
}
document.getElementById("close-btn").onclick = () => document.getElementById("ui-panel").classList.remove("open");

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  fitCamera();
  renderer.setSize(innerWidth, innerHeight);
});

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const t = clock.getElapsedTime();

  sea.material.uniforms.uTime.value = t;
  boats.update(t);
  gulls.update(t);
  walkers.update(t);
  walkers.meshes.forEach((p) => {
    const b = p.getObjectByName("bubble");
    if (b && t > p.userData.bubbleUntil) p.remove(b);
  });
  bobbers.forEach((b) => {
    const p = b.userData.base;
    b.position.set(p.x, waveHeight(p.x, p.z, t) - 0.2, p.z);
    b.rotation.z = Math.sin(t * 1.1 + p.x) * 0.05;
  });

  islands.forEach(({ group, phase }) => (group.position.y = Math.sin(t * 0.9 + phase) * 0.12));
  swayers.forEach(({ o, phase }) => (o.rotation.z = Math.sin(t * 1.3 + phase) * 0.04));
  scene.traverse((o) => { if (o.userData.spin) o.rotation.y = t * 1.5; });

  clickable.forEach((root) => {
    const target = root === hovered ? 1.1 : 1;
    root.scale.lerp(new THREE.Vector3(target, target, target), 0.2);
  });

  controls.update();
  renderer.render(scene, camera);
});
