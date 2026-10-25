import * as THREE from "three";
import { waveHeight } from "./ocean3d.js";

const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8, ...extra });
const MAT = {
  wood: std(0x9a6b3f), woodDark: std(0x6d4a2b), hull: std(0xf5f0e6), hullStripe: std(0xd84343),
  sail: std(0xffffff, { side: THREE.DoubleSide }), sail2: std(0xffe082, { side: THREE.DoubleSide }),
  gull: std(0xffffff, { side: THREE.DoubleSide }), gullTip: std(0x37474f, { side: THREE.DoubleSide }),
  beak: std(0xffb300),
};

const part = (geo, m, x = 0, y = 0, z = 0) => {
  const o = new THREE.Mesh(geo, m);
  o.position.set(x, y, z);
  o.castShadow = o.receiveShadow = true;
  return o;
};

// 木棧橋,從島嶼 +z 方向往海面延伸
export function makeDock(length = 4.5) {
  const g = new THREE.Group();
  const planks = Math.round(length / 0.38);
  for (let i = 0; i < planks; i++) {
    g.add(part(new THREE.BoxGeometry(1.5, 0.1, 0.32), i % 2 ? MAT.wood : MAT.woodDark, 0, 0.15, i * 0.38));
  }
  for (let z = 0.4; z < length; z += 1.5) {
    [-0.72, 0.72].forEach((x) => g.add(part(new THREE.CylinderGeometry(0.09, 0.09, 1.3, 6), MAT.woodDark, x, -0.35, z)));
  }
  [-0.72, 0.72].forEach((x) => g.add(part(new THREE.CylinderGeometry(0.1, 0.1, 0.5, 6), MAT.woodDark, x, 0.45, length - 0.2)));
  return g;
}

// 拱形木橋:沿 +x 方向,長度 length
export function makeBridge(length) {
  const g = new THREE.Group();
  const n = Math.round(length / 0.4);
  const archH = 0.8;
  const y = (u) => 4 * archH * u * (1 - u);
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const plank = part(new THREE.BoxGeometry(0.42, 0.1, 1.5), i % 2 ? MAT.wood : MAT.woodDark, u * length, y(u), 0);
    plank.rotation.z = Math.atan2(4 * archH * (1 - 2 * u), length) ;
    g.add(plank);
    if (i % 3 === 0) {
      [-0.72, 0.72].forEach((z) => g.add(part(new THREE.CylinderGeometry(0.06, 0.06, 0.7, 6), MAT.woodDark, u * length, y(u) + 0.38, z)));
    }
  }
  [-0.72, 0.72].forEach((z) => {
    const pts = Array.from({ length: n + 1 }, (_, i) => new THREE.Vector3((i / n) * length, y(i / n) + 0.72, z));
    g.add(part(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n * 2, 0.045, 5), MAT.wood));
  });
  return g;
}

// 帆船,船頭朝 +x
export function makeBoat(sailMat = MAT.sail) {
  const g = new THREE.Group();
  const hullShape = new THREE.Shape();
  hullShape.moveTo(-1.1, 0.35).lineTo(-0.9, -0.1).lineTo(0.9, -0.1).lineTo(1.5, 0.35).lineTo(-1.1, 0.35);
  const hull = part(new THREE.ExtrudeGeometry(hullShape, { depth: 0.8, bevelEnabled: false }), MAT.hull, 0, 0, -0.4);
  g.add(hull);
  g.add(part(new THREE.BoxGeometry(2.55, 0.08, 0.84), MAT.hullStripe, 0.2, 0.3, 0));
  g.add(part(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 6), MAT.woodDark, 0.1, 1.6, 0));
  const sail = new THREE.Shape();
  sail.moveTo(0, 0).lineTo(1.2, 0).lineTo(0, 2.1).lineTo(0, 0);
  g.add(part(new THREE.ShapeGeometry(sail), sailMat, 0.15, 0.55, 0));
  const jib = new THREE.Shape();
  jib.moveTo(0, 0).lineTo(-0.9, 0).lineTo(0, 1.5).lineTo(0, 0);
  g.add(part(new THREE.ShapeGeometry(jib), sailMat, 0.05, 0.55, 0));
  return g;
}

export function makeGull() {
  const g = new THREE.Group();
  const body = part(new THREE.SphereGeometry(0.22, 6, 5), MAT.gull);
  body.scale.set(1.6, 0.7, 0.8);
  g.add(body);
  g.add(part(new THREE.ConeGeometry(0.05, 0.15, 5), MAT.beak, 0.38, 0, 0));
  g.children[1].rotation.z = -Math.PI / 2;
  const wingGeo = new THREE.PlaneGeometry(0.75, 0.28);
  wingGeo.translate(0.375, 0, 0);
  const left = part(wingGeo, MAT.gull);
  const right = part(wingGeo, MAT.gull);
  left.rotation.x = right.rotation.x = -Math.PI / 2;
  right.rotation.y = Math.PI;
  g.add(left, right);
  g.userData.wings = [left, right];
  return g;
}

// 小船沿著直線來回航行,抵達端點後轉身
export function createBoats(specs) {
  const boats = specs.map((s) => {
    const mesh = makeBoat(s.sail);
    mesh.scale.setScalar(s.scale || 1);
    return { mesh, ...s };
  });
  return {
    meshes: boats.map((b) => b.mesh),
    update(t) {
      boats.forEach((b) => {
        const range = b.x1 - b.x0;
        const phase = ((t * b.speed + b.offset) / range) % 2;
        const u = phase < 1 ? phase : 2 - phase;
        const dir = phase < 1 ? 1 : -1;
        const x = b.x0 + u * range;
        const y = waveHeight(x, b.z, t) - 0.3;
        b.mesh.position.set(x, y + 0.1, b.z);
        // 轉向時用平滑角度,避免瞬間翻面
        const targetY = dir > 0 ? 0 : Math.PI;
        b.mesh.rotation.y += (targetY - b.mesh.rotation.y) * 0.05;
        b.mesh.rotation.z = Math.sin(t * 1.2 + b.offset) * 0.06;
        b.mesh.rotation.x = Math.cos(t * 0.9 + b.offset) * 0.04;
      });
    },
  };
}

// 海鷗繞著各自的圓心盤旋
export function createGulls(count, centers) {
  const gulls = Array.from({ length: count }, (_, i) => {
    const mesh = makeGull();
    const c = centers[i % centers.length];
    return {
      mesh,
      cx: c.x, cz: c.z,
      radius: 7 + (i % 4) * 2.5,
      height: 9 + (i % 5) * 1.6,
      speed: (0.35 + (i % 3) * 0.08) * (i % 2 ? 1 : -1),
      phase: i * 1.7,
    };
  });
  return {
    meshes: gulls.map((g) => g.mesh),
    update(t) {
      gulls.forEach((g) => {
        const a = t * g.speed + g.phase;
        const x = g.cx + Math.cos(a) * g.radius;
        const z = g.cz + Math.sin(a) * g.radius;
        g.mesh.position.set(x, g.height + Math.sin(t * 1.1 + g.phase) * 0.6, z);
        // 朝向切線方向,並稍微傾身
        const dir = g.speed > 0 ? 1 : -1;
        g.mesh.rotation.y = -a + (dir > 0 ? -Math.PI / 2 : Math.PI / 2);
        g.mesh.rotation.x = -dir * 0.25;
        const flap = Math.sin(t * 7 + g.phase * 3) * 0.55;
        g.mesh.userData.wings[0].rotation.z = flap;
        g.mesh.userData.wings[1].rotation.z = -flap;
      });
    },
  };
}

// 對話氣泡:以 Canvas 繪製成 Sprite,掛在人物頭上
export function makeBubble(text) {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 160;
  const g = c.getContext("2d");
  g.fillStyle = "#fff";
  g.strokeStyle = "#455a64";
  g.lineWidth = 6;
  g.beginPath();
  g.roundRect(8, 8, 496, 108, 28);
  g.moveTo(236, 116); g.lineTo(256, 152); g.lineTo(276, 116);
  g.fill(); g.stroke();
  g.fillStyle = "#263238";
  g.font = "bold 34px 'Microsoft JhengHei', sans-serif";
  g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(text.length > 16 ? text.slice(0, 15) + "…" : text, 256, 62);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true }));
  sp.scale.set(3.6, 1.125, 1);
  sp.renderOrder = 10;
  return sp;
}

const SKIN = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524];
const SHIRT = [0xe53935, 0x1e88e5, 0x43a047, 0xfdd835, 0x8e24aa, 0xfb8c00, 0x00acc1];

// 低多邊形小人,面向 +z;腿與手臂以樞軸旋轉做走路擺動
export function makePerson(shirt, skin, hair) {
  const g = new THREE.Group();
  const limb = (w, h, d, m, x, y) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    pivot.add(part(new THREE.BoxGeometry(w, h, d), m, 0, -h / 2, 0));
    return pivot;
  };
  const shirtM = std(shirt), skinM = std(skin), pantsM = std(0x37474f), hairM = std(hair);
  g.add(part(new THREE.BoxGeometry(0.36, 0.42, 0.2), shirtM, 0, 0.66, 0));
  const head = part(new THREE.IcosahedronGeometry(0.17, 0), skinM, 0, 1.08, 0);
  g.add(head);
  g.add(part(new THREE.SphereGeometry(0.18, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2), hairM, 0, 1.1, -0.01));
  const legL = limb(0.14, 0.45, 0.16, pantsM, -0.1, 0.45);
  const legR = limb(0.14, 0.45, 0.16, pantsM, 0.1, 0.45);
  const armL = limb(0.1, 0.4, 0.12, skinM, -0.25, 0.85);
  const armR = limb(0.1, 0.4, 0.12, skinM, 0.25, 0.85);
  g.add(legL, legR, armL, armR);
  g.userData.limbs = { legL, legR, armL, armR };
  return g;
}

// 行人沿著折線路徑來回行走。groundY(x, z, t) 回傳該處地面高度(含橋面拱起與島嶼起伏)
export function createWalkers(path, groundY, count, scale = 1) {
  const segs = [];
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const dx = path[i + 1].x - path[i].x, dz = path[i + 1].z - path[i].z;
    const len = Math.hypot(dx, dz);
    segs.push({ from: path[i], dx: dx / len, dz: dz / len, len, start: total });
    total += len;
  }

  const walkers = Array.from({ length: count }, (_, i) => ({
    mesh: makePerson(SHIRT[i % SHIRT.length], SKIN[i % SKIN.length], i % 3 ? 0x3e2723 : 0xffd54f),
    speed: 0.9 + (i % 4) * 0.18,
    dist: (total * 2 * i) / count + i * 3,
    lane: ((i % 3) - 1) * 0.28,
    heading: 0,
    pausedUntil: 0,
  }));
  walkers.forEach((w) => {
    w.mesh.scale.setScalar(scale);
    w.mesh.userData.walker = w;
  });

  let last = 0;
  return {
    meshes: walkers.map((w) => w.mesh),
    update(t) {
      const dt = Math.min(t - last, 0.1);
      last = t;
      walkers.forEach((w) => {
        const paused = t < w.pausedUntil;
        if (!paused) w.dist += dt * w.speed;
        const d = w.dist % (total * 2);
        const forward = d < total;
        const s = forward ? d : total * 2 - d;
        const seg = segs.find((sg) => s <= sg.start + sg.len) || segs[segs.length - 1];
        const u = s - seg.start;
        // 以路徑法線方向偏移,避免多人重疊
        const x = seg.from.x + seg.dx * u - seg.dz * w.lane;
        const z = seg.from.z + seg.dz * u + seg.dx * w.lane;
        const sign = forward ? 1 : -1;

        const target = Math.atan2(seg.dx * sign, seg.dz * sign);
        let diff = target - w.heading;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        w.heading += diff * 0.12;

        const phase = w.dist * 5.5;
        const swing = paused ? 0 : Math.sin(phase) * 0.7;
        const L = w.mesh.userData.limbs;
        L.legL.rotation.x = swing;
        L.legR.rotation.x = -swing;
        L.armL.rotation.x = -swing * 0.8;
        L.armR.rotation.x = swing * 0.8;

        w.mesh.position.set(x, groundY(x, z, t) + (paused ? 0 : Math.abs(Math.sin(phase)) * 0.04), z);
        w.mesh.rotation.y = w.heading;
      });
    },
  };
}

