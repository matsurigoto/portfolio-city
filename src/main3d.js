import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { createSea, waveHeight } from "./ocean3d.js";
import { makeDock, makeBridge, makeBoat, createBoats, createGulls, createWalkers, makeBubble } from "./props3d.js";
import { makeLandmark } from "./landmarks3d.js";

const data = await (await fetch("content.json")).json();

// ?demo=N 會替每個區域額外塞 N 件假作品,用來預覽城市隨內容成長的樣子
const demoCount = Number(new URLSearchParams(location.search).get("demo")) || 0;
if (demoCount > 0) {
  const cats = ["blog", "youtube", "speech", "book"];
  const seed = rng(42);
  data.districts.forEach((d) => {
    for (let k = 0; k < demoCount; k++) {
      data.items.push({
        id: `demo-${d.id}-${k}`, title: `示範作品 ${d.name}-${k + 1}`, category: cats[Math.floor(seed() * 4)],
        district: d.id, date: "2024-01-01", metric: { views: Math.floor(seed() * 30000) }, description: "示範資料", link: "",
      });
    }
  });
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87b5e8);
scene.fog = new THREE.Fog(0x87b5e8, 90, 220);

const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 2000);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI / 2.1;
controls.minDistance = 10;
controls.target.set(0, 2, 0);

scene.add(new THREE.HemisphereLight(0xffffff, 0x3a5f8f, 0.8));
const sun = new THREE.DirectionalLight(0xfff1cc, 1.6);
sun.castShadow = true;
scene.add(sun);

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

// 達到此等級即以特製地標取代一般建築(部落格需 Lv.2,其餘 Lv.1)
const LANDMARK_LEVEL = { blog: 2, youtube: 1, speech: 1, book: 1 };
const VARIETY = ["building-a", "building-c", "building-d", "building-f", "building-h", "building-i"];

// 一般建築依項目 id 雜湊挑選外觀,避免整排房子一模一樣
function pickModel(style, item, level) {
  if (level > 0) return style.models[level];
  let h = 0;
  for (const ch of item.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return item.category === "blog" ? VARIETY[h % VARIETY.length] : style.models[0];
}

function getLevel(item) {
  if (item.level !== undefined) return item.level;
  const v = Object.values(item.metric || {})[0] || 0;
  return v >= 20000 ? 2 : v >= 5000 ? 1 : 0;
}

// 同一區同類別作品太多時,依年份合併成一幢地標建築,點擊後在面板列出該年全部作品
const GROUP_THRESHOLD = 24;
const CATEGORY_LABEL = { blog: "文章", youtube: "影片", speech: "演講", book: "著作" };
const allItems = data.items;
{
  const grouped = [];
  data.districts.forEach((d) => {
    const items = allItems.filter((it) => it.district === d.id);
    if (items.length <= GROUP_THRESHOLD) return grouped.push(...items);
    const byKey = new Map();
    items.forEach((it) => {
      const key = `${it.category}|${it.date.slice(0, 4)}`;
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key).push(it);
    });
    [...byKey.entries()].sort(([a], [b]) => a.split("|")[1].localeCompare(b.split("|")[1])).forEach(([key, list]) => {
      const [category, year] = key.split("|");
      list.sort((a, b) => b.date.localeCompare(a.date));
      grouped.push({
        id: `group-${d.id}-${key}`, district: d.id, category, date: year,
        title: `${year} 年${CATEGORY_LABEL[category] || "作品"}`,
        description: `共 ${list.length} 篇`, children: list,
        level: list.length >= 50 ? 2 : list.length >= 20 ? 1 : 0,
      });
    });
  });
  data.items = grouped;
}

// 固定種子的亂數,讓每次載入裝飾位置一致
function rng(seed) {
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
}

const clickable = [];
const islands = [];
const swayers = [];
const spinners = [];
const bobbers = [];

// ---------- 佈局:島嶼大小由作品數量決定 ----------
const CELL_X = 4.6; // 建築左右間距
const ROW_H = 6.2; // 道路之間的間距(每排建築夾在兩條道路中間)
const ROAD_W = 1.6;
const ROAD_Y = 0.73;

function layoutIsland(d) {
  const items = data.items.filter((it) => it.district === d.id);
  const n = items.length;
  const perRow = n <= 2 ? Math.max(n, 1) : Math.min(30, Math.ceil(Math.sqrt(n) * 1.2));
  const rows = Math.max(1, Math.ceil(n / perRow));
  const cells = [];
  items.forEach((item, idx) => {
    const k = Math.floor(idx / perRow);
    const inRow = Math.min(perRow, n - k * perRow);
    const side = k % 2 === 0 ? 1 : -1;
    const bz = side * (ROW_H / 2 + ROW_H * Math.floor(k / 2));
    cells.push({ item, bx: ((idx % perRow) - (inRow - 1) / 2) * CELL_X, bz });
  });
  const up = Math.ceil(rows / 2), down = Math.floor(rows / 2);
  const zmax = up * ROW_H, zmin = -down * ROW_H;
  const zs = [];
  for (let k = -down; k <= up; k++) zs.push(k * ROW_H);
  const rx = ((perRow - 1) * CELL_X) / 2 + 2.8;
  const zc = (zmax + zmin) / 2;
  const halfW = rx + 1.4, halfH = (zmax - zmin) / 2 + 2.2;
  const R = Math.max(8, Math.hypot(halfW, halfH) / 0.92 + 0.8);
  return { d, n, items, cells, zs, zmin, zmax, zc, rx, R, xe: Math.sqrt(R * R - zc * zc) * 0.93, dock2: n >= 6 };
}

const layouts = data.districts.map(layoutIsland);
const BRIDGE_GAP = 3.4;
const totalItems = data.items.length;
{
  const widths = layouts.reduce((s, L) => s + 2 * L.R, 0) + BRIDGE_GAP * (layouts.length - 1);
  let x = -widths / 2;
  layouts.forEach((L) => { L.cx = x + L.R; x += 2 * L.R + BRIDGE_GAP; });
}
const worldW = layouts.reduce((s, L) => s + 2 * L.R, 0) + BRIDGE_GAP * (layouts.length - 1);
const southEdge = Math.max(...layouts.map((L) => L.zc + L.R));
const northEdge = Math.max(...layouts.map((L) => L.R - L.zc));

// 依視窗寬高比調整距離,讓所有島嶼都入鏡
let camDist = 55;
function fitCamera() {
  const fitW = (worldW * 1.3 + 16) / 2 / (Math.tan(THREE.MathUtils.degToRad(22.5)) * camera.aspect);
  camDist = Math.max(55, fitW, (southEdge + northEdge) * 1.5);
  camera.position.set(0, camDist * 0.42, camDist);
  controls.maxDistance = camDist * 1.7;
}
fitCamera();
scene.fog.near = camDist * 1.5;
scene.fog.far = camDist * 3.6;

const shadowSpan = worldW / 2 + 12;
sun.position.set(25, 40, 20).multiplyScalar(Math.max(1, worldW / 70));
Object.assign(sun.shadow.camera, { left: -shadowSpan, right: shadowSpan, top: shadowSpan * 0.7, bottom: -shadowSpan * 0.7, far: 400 });
sun.shadow.mapSize.set(worldW > 90 ? 4096 : 2048, worldW > 90 ? 4096 : 2048);

// ---------- 程序化小物件 ----------
const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, ...extra });
const M = {
  trunk: mat(0x7b5230), leaf: mat(0x3f9142), leaf2: mat(0x66bb6a), pine: mat(0x2e7d32),
  rock: mat(0x9e9e9e), pole: mat(0x37474f), lamp: mat(0xfff59d, { emissive: 0xffe082, emissiveIntensity: 0.9 }),
  petals: [0xf06292, 0xffd54f, 0xffffff, 0xba68c8].map((c) => mat(c)),
  road: mat(0x3b3f46, { roughness: 0.95 }), line: mat(0xf5f5f5), wood: mat(0x8d6e63), stone: mat(0xcfd8dc),
  water: mat(0x4fc3f7, { emissive: 0x0288d1, emissiveIntensity: 0.3 }), white: mat(0xf5f5f5), red: mat(0xd84315),
  gold: mat(0xffd54f, { emissive: 0xffa000, emissiveIntensity: 0.6 }),
  gondola: [0xef5350, 0x42a5f5, 0xffee58, 0x66bb6a].map((c) => mat(c)),
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

function makeBench() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(0.9, 0.08, 0.32), M.wood, 0, 0.38, 0));
  g.add(mesh(new THREE.BoxGeometry(0.9, 0.3, 0.06), M.wood, 0, 0.6, -0.15));
  [-0.38, 0.38].forEach((x) => g.add(mesh(new THREE.BoxGeometry(0.06, 0.38, 0.28), M.pole, x, 0.19, 0)));
  return g;
}

// ---------- 設施:作品越多越齊全 ----------
function makeFountain() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(1.4, 1.5, 0.45, 12), M.stone, 0, 0.22, 0));
  g.add(mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.08, 12), M.water, 0, 0.46, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.14, 0.2, 1.0, 8), M.stone, 0, 0.9, 0));
  g.add(mesh(new THREE.SphereGeometry(0.32, 8, 6), M.water, 0, 1.5, 0));
  return g;
}

function makeGazebo() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.18, 8), M.wood, 0, 0.09, 0));
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([x, z]) =>
    g.add(mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.8, 6), M.white, x * 1.0, 1.0, z * 1.0)));
  g.add(mesh(new THREE.ConeGeometry(1.95, 0.95, 8), M.red, 0, 2.4, 0));
  return g;
}

function makeLighthouse() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.75, 1.05, 1.8, 10), M.white, 0, 0.9, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.65, 0.75, 1.4, 10), M.red, 0, 2.5, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.55, 0.65, 1.4, 10), M.white, 0, 3.9, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.6, 10), M.lamp, 0, 4.9, 0));
  g.add(mesh(new THREE.ConeGeometry(0.7, 0.8, 10), M.red, 0, 5.6, 0));
  return g;
}

function makeFerrisWheel() {
  const g = new THREE.Group();
  const R = 2.8, hub = 3.6;
  [-0.5, 0.5].forEach((z) => {
    [-1, 1].forEach((s) => {
      const leg = mesh(new THREE.BoxGeometry(0.14, hub + 0.2, 0.14), M.pole, s * 0.9, hub / 2, z);
      leg.rotation.z = -s * 0.25;
      g.add(leg);
    });
  });
  const wheel = new THREE.Group();
  wheel.position.y = hub;
  wheel.add(mesh(new THREE.TorusGeometry(R, 0.07, 6, 24), M.white, 0, 0, 0));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const spoke = mesh(new THREE.BoxGeometry(R * 2, 0.04, 0.04), M.white, 0, 0, 0);
    spoke.rotation.z = a / 2;
    if (i < 4) wheel.add(spoke);
    const cab = mesh(new THREE.BoxGeometry(0.5, 0.4, 0.5), M.gondola[i % 4], Math.cos(a) * R, Math.sin(a) * R - 0.2, 0);
    wheel.add(cab);
  }
  spinners.push({ o: wheel, axis: "z", speed: 0.35 });
  g.add(wheel);
  return g;
}

// ---------- 道路 ----------
function addRoad(group, x1, z1, x2, z2) {
  const len = Math.hypot(x2 - x1, z2 - z1);
  const road = new THREE.Group();
  road.position.set((x1 + x2) / 2, ROAD_Y, (z1 + z2) / 2);
  road.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
  const body = new THREE.Mesh(new THREE.BoxGeometry(len, 0.06, ROAD_W), M.road);
  body.receiveShadow = true;
  road.add(body);
  for (let s = -len / 2 + 0.8; s < len / 2 - 0.4; s += 1.3) {
    const dash = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.02, 0.07), M.line);
    dash.position.set(s, 0.04, 0);
    road.add(dash);
  }
  group.add(road);
}

function buildRoads(group, L) {
  L.zs.forEach((z) => addRoad(group, z === 0 ? -L.xe : -L.rx, z, z === 0 ? L.xe : L.rx, z));
  [-L.rx, L.rx].forEach((x) => addRoad(group, x, L.zmin, x, L.zmax));
  addRoad(group, 0, L.zmax, 0, L.zc + L.R - 1.2);
  if (L.dock2) addRoad(group, 0, L.zmin, 0, L.zc - L.R + 1.2);

  // 路燈沿路邊,長椅在另一側
  L.zs.forEach((z) => {
    for (let x = -L.rx + 0.9; x <= L.rx - 0.5; x += CELL_X) {
      const lamp = makeLamp();
      lamp.position.set(x, 0.7, z + 1.0);
      group.add(lamp);
      if (L.n >= 3) {
        const bench = makeBench();
        bench.position.set(x + CELL_X / 2, 0.7, z - 1.0);
        group.add(bench);
      }
    }
  });
}

// ---------- 裝飾與設施散佈 ----------
function decorateIsland(group, L, seed) {
  const r = rng(seed * 7919 + 13);
  const placed = [];
  const free = (x, z, rad, small) => {
    const inRing = Math.abs(x) < L.rx + 1.3 && z > L.zmin - 1.3 && z < L.zmax + 1.3;
    if (inRing && !small) return false;
    if (L.zs.some((rz) => Math.abs(z - rz) < 1.4 && Math.abs(x) < (rz === 0 ? L.xe : L.rx + 1.4))) return false;
    if (Math.abs(Math.abs(x) - L.rx) < 1.4 && z > L.zmin - 1.4 && z < L.zmax + 1.4) return false;
    if (L.cells.some((c) => Math.abs(x - c.bx) < 2.3 && Math.abs(z - c.bz) < 2.3)) return false;
    if (Math.abs(x) < 1.8 && (z > L.zmax - 1 || (L.dock2 && z < L.zmin + 1))) return false;
    return placed.every(([px, pz, pr]) => Math.hypot(px - x, pz - z) > pr + rad);
  };
  const put = (make, rad, small, minD, maxD, tries, sways) => {
    for (let t = 0; t < tries; t++) {
      const a = r() * Math.PI * 2;
      const d = minD + Math.sqrt(r()) * (maxD - minD);
      const x = Math.cos(a) * d, z = L.zc + Math.sin(a) * d;
      if (!free(x, z, rad, small)) continue;
      const o = make(r);
      o.position.set(x, 0.7, z);
      o.rotation.y = r() * 6.28;
      group.add(o);
      placed.push([x, z, rad]);
      if (sways) swayers.push({ o, phase: r() * 6 });
      return true;
    }
    return false;
  };

  // 大型設施先放,才搶得到空位
  const facilities = [
    [L.n >= 9, makeFerrisWheel, 3.4, 0.35, 0.78],
    [L.n >= 6, makeLighthouse, 1.3, 0.6, 0.84],
    [L.n >= 4, makeGazebo, 1.9, 0.4, 0.8],
    [L.n >= 3, makeFountain, 1.7, 0.35, 0.8],
  ];
  facilities.forEach(([on, make, rad, lo, hi]) => on && put(make, rad, false, L.R * lo, L.R * hi, 200, false));

  const area = Math.min((L.R / 8) ** 2, 6); // 超大島不再線性增加,避免物件過多
  const kinds = [
    [makePine, 5, true, 0.8, false], [makeRoundTree, 5, true, 0.9, false], [makeBush, 8, false, 0.5, true],
    [makeRock, 5, false, 0.5, false], [makeFlowers, 8, false, 0.4, true],
  ];
  kinds.forEach(([make, count, sways, rad, small]) => {
    for (let n = 0; n < Math.round(count * area); n++) put(make, rad, small, 1.5, L.R * 0.86, 40, sways);
  });
}

function makeLabel(text, x, y, k = 1) {
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
  sp.scale.set(4.5 * k, 1.7 * k, 1);
  sp.position.set(x, y, 0);
  return sp;
}

// ---------- 建造島嶼 ----------
layouts.forEach((L, i) => {
  const group = new THREE.Group();
  group.position.set(L.cx, 0, 0);
  scene.add(group);

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(L.R, L.R * 1.16, 1.2, 8),
    new THREE.MeshStandardMaterial({ color: new THREE.Color(L.d.color), roughness: 0.8, flatShading: true })
  );
  base.position.set(0, 0.1, L.zc);
  base.castShadow = base.receiveShadow = true;
  group.add(base);

  const sand = new THREE.Mesh(
    new THREE.CylinderGeometry(L.R * 1.12, L.R * 1.24, 0.5, 8),
    new THREE.MeshStandardMaterial({ color: 0xe6d3a3, flatShading: true })
  );
  sand.position.set(0, -0.2, L.zc);
  group.add(sand);

  const labelK = Math.max(1, L.R / 10);
  group.add(makeLabel(L.d.name, 0, 11 * labelK, labelK));
  islands.push({ group, phase: i });

  buildRoads(group, L);
  decorateIsland(group, L, i + 1);

  L.cells.forEach(({ item, bx, bz }) => {
    const style = CATEGORY[item.category] || CATEGORY.blog;
    const level = getLevel(item);
    const lm = level >= (LANDMARK_LEVEL[item.category] ?? 2) ? makeLandmark(item.category, style.footprint * 1.25) : null;
    const b = lm || makeBuilding(pickModel(style, item, level), style.footprint);
    b.position.set(bx, 0.7, bz);
    b.userData.item = item;

    for (let s = 0; s <= level; s++) {
      const star = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.28),
        new THREE.MeshStandardMaterial({ color: 0xffd54f, emissive: 0xffa000, emissiveIntensity: 0.6 })
      );
      star.position.set((s - level / 2) * 0.7, b.userData.height + 0.8, 0);
      spinners.push({ o: star, axis: "y", speed: 1.5 });
      b.add(star);
    }
    clickable.push(b);
    group.add(b);
  });
});

// ---------- 海面、碼頭、橋梁、小船、海鷗 ----------
const centers = layouts.map((L) => ({ x: L.cx, z: L.zc, r: L.R }));
const seaSize = Math.max(500, worldW * 3.5);
const sea = createSea(
  centers.map((c) => ({ x: c.x, z: c.z, r: c.r * 1.15 })),
  0x87b5e8, sun.position, seaSize, [camDist * 2, camDist * 4.2]
);
scene.add(sea);

function addMooring(x, z, flip) {
  const dock = makeDock(4.5);
  dock.position.set(x, 0.7, z);
  if (flip) dock.rotation.y = Math.PI;
  scene.add(dock);

  const boat = makeBoat();
  boat.scale.setScalar(0.8);
  boat.rotation.y = -Math.PI / 2;
  boat.userData.base = new THREE.Vector3(x + 1.8, 0, z + (flip ? -1 : 1) * 3.2);
  scene.add(boat);
  bobbers.push(boat);
}

const bridgeSpans = [];
layouts.forEach((L, i) => {
  addMooring(L.cx, L.zc + L.R - 1.6, false);
  if (L.dock2) addMooring(L.cx, L.zc - L.R + 1.6, true);

  if (i < layouts.length - 1) {
    const N = layouts[i + 1];
    const x0 = L.cx + L.xe - 0.8, x1 = N.cx - N.xe + 0.8;
    const bridge = makeBridge(x1 - x0);
    bridge.position.set(x0, 0.7, 0);
    scene.add(bridge);
    bridgeSpans.push([x0, x1]);
  }
});

const laneX = worldW / 2 + 14;
const boatSpecs = Array.from({ length: Math.min(12, 2 + Math.ceil(totalItems / 3)) }, (_, k) => {
  const south = k % 2 === 0;
  const lane = Math.floor(k / 2);
  const dist = (south ? southEdge : northEdge) + 6 + lane * 5;
  return {
    x0: -laneX, x1: laneX, z: south ? dist : -dist,
    speed: 1.5 + (k % 3) * 0.4, offset: k * 37, scale: 1 + (k % 3) * 0.15,
  };
});
const boats = createBoats(boatSpecs);
boats.meshes.forEach((m) => scene.add(m));

const gulls = createGulls(Math.min(6 + totalItems, 40), centers);
gulls.meshes.forEach((m) => scene.add(m));

// ---------- 行人 ----------
function groundY(x, z, t) {
  for (const [x0, x1] of bridgeSpans) {
    if (x > x0 && x < x1) {
      const u = (x - x0) / (x1 - x0);
      return 0.7 + 4 * 0.8 * u * (1 - u) + 0.05;
    }
  }
  const idx = centers.reduce((best, c, i) => (Math.abs(x - c.x) < Math.abs(x - centers[best].x) ? i : best), 0);
  return 0.75 + Math.sin(t * 0.9 + islands[idx].phase) * 0.12;
}

// 沿主幹道跨島的行人,以及每座島環繞環狀道路的居民
const walkerSets = [];
walkerSets.push(
  createWalkers(
    layouts.flatMap((L) => [{ x: L.cx - L.xe + 0.8, z: 0 }, { x: L.cx + L.xe - 0.8, z: 0 }]),
    groundY, Math.min(2 + totalItems, 40), 1.1
  )
);
layouts.forEach((L) => {
  const p = [[-L.rx, 0], [L.rx, 0], [L.rx, L.zmax], [-L.rx, L.zmax]];
  if (L.zmin < 0) p.push([-L.rx, L.zmin], [L.rx, L.zmin], [L.rx, 0]);
  else p.push([-L.rx, 0]);
  walkerSets.push(createWalkers(p.map(([x, z]) => ({ x: L.cx + x, z })), groundY, Math.min(1 + L.n, 40), 1.1));
});
const walkerMeshes = walkerSets.flatMap((w) => w.meshes);
walkerMeshes.forEach((m) => scene.add(m));

// ---------- 互動 ----------
const ray = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const tip = document.getElementById("tip");
let hovered = null;
let downPos = null;

function pick(e) {
  mouse.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(mouse, camera);
  const hit = ray.intersectObjects([...clickable, ...walkerMeshes], true)[0];
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
  const titles = allItems.map((i) => i.title);
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
  document.getElementById("panel-meta").innerText = [item.date, m].filter(Boolean).join(" ・ ");
  document.getElementById("panel-desc").innerText = item.description || "";
  const list = document.getElementById("panel-list");
  list.replaceChildren(...(item.children || []).map((c) => {
    const li = document.createElement("li");
    const d = document.createElement("span");
    d.className = "d";
    d.textContent = c.date.slice(5);
    const a = document.createElement("a");
    a.textContent = c.title;
    a.target = "_blank";
    a.rel = "noopener";
    if (c.link) a.href = c.link;
    li.append(d, a);
    return li;
  }));
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
const unit = new THREE.Vector3();
renderer.setAnimationLoop(() => {
  const t = clock.getElapsedTime();

  sea.material.uniforms.uTime.value = t;
  boats.update(t);
  gulls.update(t);
  walkerSets.forEach((w) => w.update(t));
  walkerMeshes.forEach((p) => {
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
  spinners.forEach(({ o, axis, speed }) => (o.rotation[axis] = t * speed));

  clickable.forEach((root) => {
    const target = root === hovered ? 1.1 : 1;
    root.scale.lerp(unit.set(target, target, target), 0.2);
  });

  controls.update();
  renderer.render(scene, camera);
});
