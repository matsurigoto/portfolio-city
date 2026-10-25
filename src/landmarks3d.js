import * as THREE from "three";

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, ...extra });

function mesh(geo, material, x, y, z) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  return m;
}

// 鐘塔:磚紅塔身、四面時鐘、金字塔屋頂
function clockTower() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(2.4, 0.5, 2.4), mat(0x8d6e63), 0, 0.25, 0));
  g.add(mesh(new THREE.BoxGeometry(1.6, 4.2, 1.6), mat(0xd7b98e), 0, 2.6, 0));
  g.add(mesh(new THREE.BoxGeometry(2, 0.3, 2), mat(0x8d6e63), 0, 4.85, 0));
  g.add(mesh(new THREE.BoxGeometry(1.5, 1.3, 1.5), mat(0xd7b98e), 0, 5.65, 0));
  const face = new THREE.CylinderGeometry(0.5, 0.5, 0.08, 20);
  const hand = new THREE.BoxGeometry(0.06, 0.34, 0.03);
  [0, Math.PI / 2, Math.PI, -Math.PI / 2].forEach((a) => {
    const c = new THREE.Group();
    const f = mesh(face, mat(0xfff8e1), 0, 0, 0.78);
    f.rotation.x = Math.PI / 2;
    c.add(f);
    const h = mesh(hand, mat(0x3e2723), 0, 0.12, 0.84);
    c.add(h);
    c.position.y = 5.65;
    c.rotation.y = a;
    g.add(c);
  });
  g.add(mesh(new THREE.ConeGeometry(1.25, 1.6, 4), mat(0xc0392b), 0, 7.1, 0));
  g.children[g.children.length - 1].rotation.y = Math.PI / 4;
  g.add(mesh(new THREE.SphereGeometry(0.14, 8, 8), mat(0xffd54f, { emissive: 0xffa000 }), 0, 8.0, 0));
  return g;
}

// 影音塔:深色塔身頂端掛著紅色播放鍵看板
function playTower() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(1.3, 1.5, 0.4, 8), mat(0x37474f), 0, 0.2, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.35, 0.6, 4.6, 8), mat(0x546e7a), 0, 2.7, 0));
  [1, 2, 3].forEach((i) => {
    const ring = mesh(new THREE.TorusGeometry(0.55 - i * 0.04, 0.05, 6, 16), mat(0xb0bec5), 0, 1 + i, 0);
    ring.rotation.x = Math.PI / 2;
    g.add(ring);
  });
  const sign = new THREE.Group();
  const board = mesh(new THREE.BoxGeometry(3.2, 2.1, 0.35), mat(0xe53935, { emissive: 0x7f0000, emissiveIntensity: 0.4 }), 0, 0, 0);
  sign.add(board);
  const tri = mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.1, 3), mat(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.3 }), 0.1, 0, 0.22);
  tri.rotation.set(Math.PI / 2, 0, -Math.PI / 2);
  sign.add(tri);
  sign.position.y = 6.3;
  sign.userData.sway = true;
  g.add(sign);
  g.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.4, 6), mat(0xb0bec5), 0, 5.6, 0));
  g.add(mesh(new THREE.SphereGeometry(0.12, 8, 8), mat(0xff5252, { emissive: 0xff1744 }), 0, 7.6, 0));
  g.userData.spin = sign;
  return g;
}

// 演講廳:圓形舞台、扇形階梯座位、講台與聚光燈
function amphitheater() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(1.7, 1.8, 0.3, 24), mat(0x8d6e63), 0, 0.15, 0));
  const seats = [0xef9a9a, 0xffcc80, 0xfff59d];
  // 外圈較高,座位半圈朝向舞台(開口朝 +z)
  seats.forEach((c, i) => {
    const r = 1.1 + i * 0.4, h = 0.4 + i * 0.3;
    const ring = mesh(new THREE.CylinderGeometry(r, r, h, 24, 1, false, Math.PI * 0.6, Math.PI * 1.8), mat(c), 0, 0.3 + h / 2, -0.2);
    g.add(ring);
  });
  g.add(mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.55, 24), mat(0x6d4c41), 0, 0.575, 0.2));
  g.add(mesh(new THREE.BoxGeometry(0.3, 0.55, 0.3), mat(0x4e342e), 0, 1.1, 0.35));
  const post = (x) => {
    g.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.4, 6), mat(0x90a4ae), x, 2, -1.2));
    const lamp = mesh(new THREE.ConeGeometry(0.22, 0.4, 8), mat(0xfff176, { emissive: 0xffeb3b, emissiveIntensity: 0.7 }), x, 3.8, -1.1);
    lamp.rotation.x = Math.PI * 0.75;
    g.add(lamp);
  };
  post(-1.2);
  post(1.2);
  g.add(mesh(new THREE.BoxGeometry(2.6, 0.08, 0.08), mat(0x90a4ae), 0, 3.7, -1.2));
  return g;
}

// 書塔:層層堆疊的彩色書本,頂端立著一本翻開的書
function bookTower() {
  const g = new THREE.Group();
  const colors = [0xc62828, 0x1565c0, 0x2e7d32, 0xf9a825, 0x6a1b9a, 0x00838f, 0xd84315];
  let y = 0;
  colors.forEach((c, i) => {
    const h = 0.55 + (i % 3) * 0.1;
    const w = 2.4 - i * 0.18;
    const b = mesh(new THREE.BoxGeometry(w, h, w * 0.72), mat(c), 0, y + h / 2, 0);
    b.rotation.y = (i % 2 ? 1 : -1) * 0.12 * (i % 3);
    g.add(b);
    g.add(mesh(new THREE.BoxGeometry(w * 0.96, h * 0.7, w * 0.72 * 0.9), mat(0xfff8e1), 0.02, y + h / 2, 0.08).rotateY(b.rotation.y));
    y += h;
  });
  const page = new THREE.BoxGeometry(0.75, 0.06, 0.95);
  const l = mesh(page, mat(0xfffde7), -0.38, y + 0.35, 0);
  l.rotation.z = 0.5;
  const r = mesh(page, mat(0xfffde7), 0.38, y + 0.35, 0);
  r.rotation.z = -0.5;
  g.add(l, r);
  g.userData.top = y + 0.6;
  return g;
}

const BUILDERS = { blog: clockTower, youtube: playTower, speech: amphitheater, book: bookTower };

// 回傳 { group, height } 或 null(該分類沒有地標)
export function makeLandmark(category, footprint) {
  const build = BUILDERS[category];
  if (!build) return null;
  const inner = build();
  const box = new THREE.Box3().setFromObject(inner);
  const size = box.getSize(new THREE.Vector3());
  const k = Math.min(footprint / Math.max(size.x, size.z), 7.5 / size.y);
  inner.scale.setScalar(k);
  inner.position.y = -box.min.y * k;
  const group = new THREE.Group();
  group.add(inner);
  group.userData.height = size.y * k;
  group.userData.spin = inner.userData.spin;
  return group;
}
