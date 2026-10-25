import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import gsap from "gsap";
import { herringbone, magazines, panelWall, plaster } from "./textures";
import { BADGES, createFurniture, type LayoutId } from "./layouts";

/**
 * Зал АРКА 123 в реальных пропорциях (метры): 10.4 × 11.8 м ≈ 123 м², потолок 4.5 м.
 *  - короткая стена (z = −5.9): два арочных окна 3.5 × 3.5 м, правое почти в углу, за ними — вид на Национальную библиотеку;
 *  - посреди зала, напротив простенка между окнами, — графитовая колонна до потолка;
 *  - длинная правая стена (x = +5.2): часы; за графитовой угловой колонной стена уступом отходит наружу — в этой нише
 *    (по плану заказчика) ресепшен: графитовые стенки со шкафами и подсвеченной полкой буквой Г, дальше белые панели,
 *    из них в зал выступает стойка, у угла со стеклянной стеной — прозрачная стеклянная дверь;
 *  - длинная левая стена (x = −5.2): штукатурка, графитовый выступ до потолка, в сценарии «Лекция» — экран;
 *  - короткая стена у входа (z = +5.9): стеклянные перегородки с матовыми полосами и два белых пилона.
 * Камера: FOV 52° (без «широкоугольного» искажения), орбита с ограничениями — нельзя выйти за стены.
 */

const W = 10.4, D = 11.8, H = 4.5; // окна — на короткой стене, часы и ресепшен — на длинной
const HX = W / 2, HZ = D / 2;
const PIER_X = 1.2;                // простенок между окнами
export const COLUMN = [PIER_X, -2.4]; // колонна (x, z) в ~3,5 м от окон — мебель её обходит
const STEP_Z = 0.8;                // здесь стена с часами уступом отходит наружу — ниша ресепшена до стеклянной стены
const AX = HX + 1.4;               // дальняя стенка ниши
const DOOR_Z = HZ - 0.95;          // стеклянная дверь в дальней стенке ниши, у угла

type View = { pos: [number, number, number]; target: [number, number, number] };
const VIEWS: Record<string, View> = {
  overview: { pos: [-4.6, 2.0, 5.4], target: [2.0, 1.4, -2.6] }, // из угла у входа на уровне глаз — как на фото зала
  entrance: { pos: [-0.6, 1.9, 5.3], target: [0.2, 1.6, -5] },
  windows: { pos: [-0.8, 1.65, 0.5], target: [0.2, 2.3, -6] },
  reception: { pos: [-1.8, 1.75, -0.6], target: [6.0, 1.3, 2.9] },
  speaker: { pos: [-4.6, 1.8, -3.9], target: [2.5, 1.1, 1.0] },
  audience: { pos: [2.6, 2.3, 4.2], target: [-5.2, 1.7, -0.3] },
};

export function initRoom(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>("#room-canvas")!;
  const mobile = window.matchMedia("(max-width: 760px)").matches;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.5 : 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x121214);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.35;

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 80);
  camera.position.set(...VIEWS.overview.pos);

  // ---------- материалы ----------
  const floorTex = herringbone();
  floorTex.rotation = Math.PI / 4;
  floorTex.repeat.set(AX + HX, D);
  const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.42, metalness: 0 });
  const plasterTex = plaster("#f1dcc5"); // светлые персиково-бежевые обои, как в зале
  plasterTex.repeat.set(4, 1.5);
  const wallMat = new THREE.MeshStandardMaterial({ map: plasterTex, color: 0xffffff, roughness: 0.92 });
  const graphite = new THREE.MeshStandardMaterial({ color: 0x2c2d31, roughness: 0.7 });
  const ceilingMat = new THREE.MeshStandardMaterial({ color: 0x232427, roughness: 0.95 });
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x16171a, roughness: 0.4, metalness: 0.5 });
  const plinth = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 });

  // ---------- пол, потолок ----------
  // пол и потолок сразу с нишей ресепшена (лишний кусок за стеной с часами не виден)
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(AX + HX, D), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.position.x = (AX - HX) / 2; floor.receiveShadow = true;
  scene.add(floor);
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(AX + HX, D), ceilingMat);
  ceiling.rotation.x = Math.PI / 2; ceiling.position.set((AX - HX) / 2, H, 0);
  scene.add(ceiling);
  // балки и воздуховоды (открытый потолок «лофт»)
  for (const x of [-3.5, 0, 3.5]) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.5, D), ceilingMat);
    beam.position.set(x, H - 0.25, 0); scene.add(beam);
  }
  for (const [z, r] of [[0.2, 0.2], [1.6, 0.16], [3.0, 0.1]] as const) {
    const duct = new THREE.Mesh(new THREE.CylinderGeometry(r, r, W, 20), new THREE.MeshStandardMaterial({ color: 0x3a3b3f, roughness: 0.5, metalness: 0.6 }));
    duct.rotation.z = Math.PI / 2; duct.position.set(0, H - 0.65, z); scene.add(duct);
  }

  // ---------- задняя стена с арочными окнами ----------
  const sill = 0.85, rectTop = 2.75, rise = 1.6, half = 1.75; // окно 3.5 × 3.5 м
  const archR = (half * half + rise * rise) / (2 * rise);     // сегментная арка
  const windowXs = [PIER_X - 0.4 - half, PIER_X + 0.4 + half]; // правое окно почти в углу у стены с часами
  const archPath = (p: THREE.Path | THREE.Shape, cx: number, inset = 0) => {
    const hw = half - inset, top = rectTop, cy = rectTop + rise - archR;
    const a0 = Math.acos(hw / (archR - inset));
    p.moveTo(cx - hw, sill + inset);
    p.lineTo(cx + hw, sill + inset);
    p.lineTo(cx + hw, top);
    p.absarc(cx, cy, archR - inset, a0, Math.PI - a0, false);
    p.lineTo(cx - hw, sill + inset);
  };
  const wallShape = new THREE.Shape();
  wallShape.moveTo(-HX, 0); wallShape.lineTo(HX, 0); wallShape.lineTo(HX, H); wallShape.lineTo(-HX, H); wallShape.lineTo(-HX, 0);
  windowXs.forEach((x) => { const hole = new THREE.Path(); archPath(hole, x); wallShape.holes.push(hole); });
  const backWall = new THREE.Mesh(new THREE.ExtrudeGeometry(wallShape, { depth: 0.4, bevelEnabled: false, curveSegments: 32 }), wallMat);
  backWall.position.z = -HZ - 0.4; backWall.receiveShadow = true;
  scene.add(backWall);

  // рамы: контур + импосты + подоконник
  windowXs.forEach((x) => {
    const outer = new THREE.Shape(); archPath(outer, x);
    const inner = new THREE.Path(); archPath(inner, x, 0.08); outer.holes.push(inner);
    const fr = new THREE.Mesh(new THREE.ExtrudeGeometry(outer, { depth: 0.1, bevelEnabled: false, curveSegments: 32 }), frameMat);
    fr.position.z = -HZ - 0.3; scene.add(fr);
    const bars: [number, number, number, number][] = [
      [x - half / 3, (sill + rectTop + rise) / 2, 0.06, rectTop + rise - sill],
      [x + half / 3, (sill + rectTop + rise) / 2, 0.06, rectTop + rise - sill],
    ];
    bars.forEach(([bx, by, bw, bh]) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.08), frameMat);
      m.position.set(bx, by, -HZ - 0.25); scene.add(m);
    });
    for (const y of [1.9, rectTop]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(half * 2, 0.06, 0.08), frameMat);
      m.position.set(x, y, -HZ - 0.25); scene.add(m);
    }
    const sillM = new THREE.Mesh(new THREE.BoxGeometry(half * 2 + 0.2, 0.05, 0.42), frameMat);
    sillM.position.set(x, sill - 0.02, -HZ - 0.05); scene.add(sillM);
    // радиатор
    const rad = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 0.1), new THREE.MeshStandardMaterial({ color: 0x2b2c30, roughness: 0.5, metalness: 0.4 }));
    rad.position.set(x, 0.45, -HZ + 0.08); scene.add(rad);
  });
  // пилястра между окнами
  const pil = new THREE.Mesh(new THREE.BoxGeometry(0.7, H, 0.25), wallMat);
  pil.position.set(PIER_X, H / 2, -HZ + 0.1); scene.add(pil);
  // колонна посреди зала, обшита графитом
  const column = new THREE.Mesh(new THREE.BoxGeometry(0.6, H, 0.6), graphite);
  column.position.set(COLUMN[0], H / 2, COLUMN[1]); column.castShadow = column.receiveShadow = true;
  scene.add(column);

  // вид из окна: фото на плоскости в нескольких метрах за стеклом
  const loader = new THREE.TextureLoader();
  const viewTex: Record<string, THREE.Texture> = {
    day: loader.load("/room/view-day.webp"),
    sunset: loader.load("/room/view-sunset.webp"),
  };
  Object.values(viewTex).forEach((t) => (t.colorSpace = THREE.SRGBColorSpace));
  const viewMat = new THREE.MeshBasicMaterial({ map: viewTex.day, toneMapped: false });
  const view = new THREE.Mesh(new THREE.PlaneGeometry(26, 13), viewMat);
  view.position.set(0, 3.2, -HZ - 7);
  scene.add(view);
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.06, roughness: 0.05, metalness: 0 });
  windowXs.forEach((x) => {
    const s = new THREE.Shape(); archPath(s, x);
    const g = new THREE.Mesh(new THREE.ShapeGeometry(s, 32), glass);
    g.position.z = -HZ - 0.26; scene.add(g);
  });

  // ---------- правая стена: штукатурка + часы ----------
  const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(STEP_Z + HZ, H), wallMat); // до уступа
  rightWall.position.set(HX, H / 2, (STEP_Z - HZ) / 2); rightWall.rotation.y = -Math.PI / 2; rightWall.receiveShadow = true;
  scene.add(rightWall);
  const clock = new THREE.Group();
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.02, k % 3 === 0 ? 0.22 : 0.14, 0.05), plinth);
    t.position.set(0, Math.cos(a) * 1.1, Math.sin(a) * 1.1); t.rotation.x = -a; clock.add(t);
  }
  const hand1 = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.8, 0.04), plinth); hand1.position.y = 0.35; hand1.rotation.x = 0.4;
  const hand2 = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.6, 0.05), plinth); hand2.rotation.x = 2.1; hand2.position.set(0, -0.15, 0.25);
  clock.add(hand1, hand2);
  clock.position.set(HX - 0.02, 2.4, -3.8);
  scene.add(clock);

  // ---------- левая стена: штукатурка ----------
  const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(D, H), wallMat);
  leftWall.position.set(-HX, H / 2, 0); leftWall.rotation.y = Math.PI / 2; leftWall.receiveShadow = true;
  scene.add(leftWall);
  // графитовый выступ до потолка напротив колонны (по фото с высотой потолка)
  const jut = new THREE.Mesh(new THREE.BoxGeometry(0.5, H, 1.4), graphite);
  jut.position.set(-HX + 0.25, H / 2, COLUMN[1]); jut.castShadow = jut.receiveShadow = true;
  scene.add(jut);

  // ---------- ресепшен: ниша за уступом стены с часами (по плану заказчика) ----------
  // угловая графитовая колонна → графитовый уступ и графитовая дальняя стенка со шкафами и подсвеченной полкой
  // буквой Г → белые панели, из них в зал выступает графитовая стойка с врезанной белой столешницей →
  // у угла со стеклянной стеной прозрачная стеклянная дверь
  const white = new THREE.MeshStandardMaterial({ color: 0xf4f4f2, roughness: 0.75 }); // матовый — без бликов
  const clearGlass = new THREE.MeshPhysicalMaterial({ color: 0xe6ecef, transparent: true, opacity: 0.16, roughness: 0.05 });
  {
    const cz = 3.05;                   // стойка
    const gZ1 = cz - 0.3;              // до сюда графит с полкой, дальше белые панели
    // уступ (смотрит в нишу, на юг) и графитовая часть дальней стенки
    const step = new THREE.Mesh(new THREE.BoxGeometry(AX - HX, H, 0.06), graphite);
    step.position.set((HX + AX) / 2, H / 2, STEP_Z - 0.03); step.receiveShadow = true; scene.add(step);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.06, H, gZ1 - STEP_Z), graphite);
    back.position.set(AX + 0.03, H / 2, (STEP_Z + gZ1) / 2); back.receiveShadow = true; scene.add(back);
    const corner = new THREE.Mesh(new THREE.BoxGeometry(0.6, H, 0.6), graphite); // угловая колонна на изломе стены
    corner.position.set(HX, H / 2, STEP_Z); corner.castShadow = corner.receiveShadow = true; scene.add(corner);
    // нижние шкафы и полка с журналами вдоль уступа и дальней стенки
    const shelfMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.75 });
    const magMat = new THREE.MeshBasicMaterial({ map: magazines(), toneMapped: false });
    const ledMat = new THREE.MeshBasicMaterial({ color: 0xbcd3e0 }); // мягче: ниже порога bloom, без бликов
    const runs: [number, number, number, number][] = [ // cx, cz, длина, поворот (локальная +x — к стене)
      [(HX + 0.3 + AX) / 2, STEP_Z + 0.2, AX - HX - 0.3, Math.PI / 2],
      [AX - 0.2, (STEP_Z + 0.4 + gZ1) / 2, gZ1 - STEP_Z - 0.4, 0],
    ];
    for (const [cx, rz, len, ry] of runs) {
      const g = new THREE.Group(); g.position.set(cx, 0, rz); g.rotation.y = ry; scene.add(g);
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.1, len), graphite); base.position.set(0, 0.55, 0); g.add(base);
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.03, len), shelfMat); shelf.position.set(0, 1.12, 0); g.add(shelf);
      const mags = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.3), magMat);
      mags.position.set(0.12, 1.29, 0); mags.rotation.y = -Math.PI / 2; g.add(mags);
      const led = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, len), ledMat); led.position.set(-0.1, 1.5, 0); g.add(led);
    }
    // белые панели дальней стенки — до двери
    const faceTex = panelWall(); faceTex.repeat.x = (DOOR_Z - gZ1) / 3; // раскладка панелей по фото повторяется каждые 3 м
    const faceMat = new THREE.MeshStandardMaterial({ map: faceTex, color: 0xd6d6d3, roughness: 0.85 });
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(DOOR_Z - gZ1, H), faceMat);
    panel.position.set(AX, H / 2, (gZ1 + DOOR_Z) / 2); panel.rotation.y = -Math.PI / 2; panel.receiveShadow = true; scene.add(panel);
    for (const [dy, dz] of [[0, 0], [0, 0.2], [-0.16, 0], [-0.16, 0.2]]) { // выключатели у двери
      const sw = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.07, 0.16), plinth);
      sw.position.set(AX - 0.005, 1.25 + dy, DOOR_Z - 0.55 + dz); scene.add(sw);
    }
    // прозрачная стеклянная дверь в конце белых панелей, в той же плоскости, у угла со стеклянной стеной
    const door = new THREE.Mesh(new THREE.PlaneGeometry(HZ - DOOR_Z, H - 0.3), clearGlass);
    door.position.set(AX, (H - 0.3) / 2, (DOOR_Z + HZ) / 2); door.rotation.y = -Math.PI / 2; scene.add(door);
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, HZ - DOOR_Z), white);
    top.position.set(AX, H - 0.15, (DOOR_Z + HZ) / 2); scene.add(top);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, HZ - DOOR_Z), plinth);
    rail.position.set(AX, 2.6, (DOOR_Z + HZ) / 2); scene.add(rail);
    // стойка выступает из дальней стенки в зал; белая часть врезается в графитовую: столешница заходит в короб,
    // под ней — тумба с вырезом снизу, как на фото
    const cl = 1.6;
    const counter = new THREE.Mesh(new THREE.BoxGeometry(cl, 1.1, 0.42), graphite);
    counter.position.set(AX - cl / 2, 0.55, cz); counter.castShadow = counter.receiveShadow = true; scene.add(counter);
    const deskTop = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.3, 0.85), white); // заходит в графитовый короб на 0,2 м
    deskTop.position.set(AX - cl + 0.55, 0.63, cz - 0.01 - 0.425 + 0.2); deskTop.castShadow = deskTop.receiveShadow = true; scene.add(deskTop);
    const pedestal = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.48, 0.6), white); // тумба под дальним концом, у стойки — вырез
    pedestal.position.set(AX - cl + 0.25, 0.24, cz - 0.55); pedestal.castShadow = true; scene.add(pedestal);
    // свет в нише
    const nicheLight = new THREE.PointLight(0xfff1dd, 2.2, 5, 1.8);
    nicheLight.position.set(HX + 0.6, 3.3, 2.6); scene.add(nicheLight);
  }

  // ---------- передняя стена: стеклянные перегородки с матовыми полосами, два белых пилона ----------
  const frostMat = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, transparent: true, opacity: 0.7 });
  {
    const glassWall = new THREE.Mesh(new THREE.PlaneGeometry(AX + HX, H), clearGlass);
    glassWall.position.set((AX - HX) / 2, H / 2, HZ); glassWall.rotation.y = Math.PI; scene.add(glassWall);
    for (const y of [1.0, 1.15, 1.6, 1.75]) { // матовые полосы
      const b = new THREE.Mesh(new THREE.PlaneGeometry(AX + HX, 0.08), frostMat);
      b.position.set((AX - HX) / 2, y, HZ - 0.01); b.rotation.y = Math.PI; scene.add(b);
    }
    for (const x of [-0.1, 3.8]) { // «колонна 2» посередине и «колонна 1» ближе к ресепшену, у левой стены — нет
      const col = new THREE.Mesh(new THREE.BoxGeometry(0.55, H, 0.55), white); // белые пилоны с чёрными швами
      col.position.set(x, H / 2, HZ - 0.28); col.castShadow = true; scene.add(col);
      for (const y of [1.45, 2.6]) {
        const seam = new THREE.Mesh(new THREE.BoxGeometry(0.57, 0.02, 0.57), plinth);
        seam.position.set(x, y, HZ - 0.28); scene.add(seam);
      }
    }
  }
  // плинтусы
  for (const [x, z, w, ry] of [[0, -HZ + 0.01, W, 0], [HX - 0.01, (STEP_Z - HZ) / 2, STEP_Z + HZ, -Math.PI / 2],
    [-HX + 0.01, 0, D, Math.PI / 2], [AX - 0.01, (STEP_Z + DOOR_Z) / 2, DOOR_Z - STEP_Z, -Math.PI / 2]] as const) {
    const pl = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, 0.015), plinth);
    pl.position.set(x, 0.04, z); pl.rotation.y = ry; scene.add(pl);
  }

  // ---------- 33 линейных светильника под разными углами ----------
  const lampGeo = new THREE.BoxGeometry(1.25, 0.05, 0.07);
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff6e6, toneMapped: false });
  const lamps = new THREE.InstancedMesh(lampGeo, lampMat, 33);
  const wirePts: number[] = [];
  const rnd = (() => { let s = 42; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (let i = 0; i < 33; i++) {
    const col = i % 3, row = Math.floor(i / 3); // 3 ряда по 11 вдоль длинных стен
    const x = -3.4 + col * 3.4 + (rnd() - 0.5) * 0.7;
    const z = -HZ + 0.9 + row * ((D - 1.8) / 10) + (rnd() - 0.5) * 0.5;
    const y = 3.35 + rnd() * 0.35;
    e.set(0, rnd() * Math.PI, (rnd() - 0.5) * 0.25);
    q.setFromEuler(e);
    m4.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(1, 1, 1));
    lamps.setMatrixAt(i, m4);
    const dx = Math.cos(e.y) * 0.5, dz = -Math.sin(e.y) * 0.5;
    wirePts.push(x - dx, y, z - dz, x - dx, H, z - dz, x + dx, y, z + dz, x + dx, H, z + dz);
  }
  scene.add(lamps);
  const wires = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(wirePts, 3)), new THREE.LineBasicMaterial({ color: 0x0c0c0c }));
  scene.add(wires);

  // ---------- свет ----------
  const hemi = new THREE.HemisphereLight(0xfff4e2, 0x6b5a45, 0.6);
  scene.add(hemi);
  const ceilingLights: THREE.PointLight[] = [];
  for (const [x, z] of [[-2.6, -3.8], [2.6, -3.8], [-2.6, 0], [2.6, 0], [-2.6, 3.8], [2.6, 3.8]]) {
    const l = new THREE.PointLight(0xfff1dd, 4, 8, 1.8);
    l.position.set(x, 3.3, z); scene.add(l); ceilingLights.push(l);
  }
  const sun = new THREE.DirectionalLight(0xfff2dc, 2.4);
  sun.position.set(-3, 6, -14); sun.target.position.set(1, 0, 1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 7, bottom: -7, near: 1, far: 30 });
  sun.shadow.bias = -0.0005;
  scene.add(sun, sun.target);

  const furniture = createFurniture(scene, mobile);

  // ---------- рендер ----------
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.14, 0.3, 0.98) // слабое свечение: только лампы, без бликов на мебели;
  if (!mobile) composer.addPass(bloom);
  composer.addPass(new OutputPass());

  const controls = new OrbitControls(camera, canvas);
  controls.target.set(...VIEWS.overview.target);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.enablePan = false;
  controls.enableZoom = mobile; // колесо мыши крутит страницу (плавный скролл), масштаб — кнопками − / +; на телефоне — щипком
  controls.minDistance = 1.5;
  controls.maxDistance = 16; // зал 11,8 м в длину — камера из угла должна видеть его целиком
  controls.minPolarAngle = 0.5;
  controls.maxPolarAngle = 1.62;
  controls.rotateSpeed = 0.6;
  controls.zoomSpeed = 0.7;
  // не выпускаем камеру за стены
  controls.addEventListener("change", () => {
    camera.position.z = THREE.MathUtils.clamp(camera.position.z, -HZ + 0.3, HZ - 0.3);
    const z = camera.position.z; // в нишу ресепшена можно заглянуть
    const maxX = z > STEP_Z + 0.3 ? AX - 0.3 : HX - 0.3;
    camera.position.x = THREE.MathUtils.clamp(camera.position.x, -HX + 0.3, maxX);
    camera.position.y = THREE.MathUtils.clamp(camera.position.y, 0.5, H - 0.4);
  });

  let fovBoost = 0; // «отдалить» у стены: камере некуда отъехать, поэтому расширяем угол обзора
  const baseFov = () => (root.clientWidth / root.clientHeight < 1 ? 62 : 52);
  const resize = () => {
    const w = root.clientWidth, h = root.clientHeight;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.fov = baseFov() + fovBoost; // на вертикальном экране чуть шире, иначе зал не помещается
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(root);
  resize();

  let visible = true;
  new IntersectionObserver(([en]) => (visible = en.isIntersecting)).observe(root);
  renderer.setAnimationLoop(() => {
    if (!visible) return;
    controls.update();
    composer.render();
  });

  // ---------- UI ----------
  const flyTo = (name: string) => {
    const v = VIEWS[name];
    gsap.to(camera.position, { x: v.pos[0], y: v.pos[1], z: v.pos[2], duration: 1.6, ease: "power3.inOut" });
    gsap.to(controls.target, { x: v.target[0], y: v.target[1], z: v.target[2], duration: 1.6, ease: "power3.inOut" });
  };

 // кнопки − / +: наезд вдоль взгляда вместе с точкой взгляда — работает и в углу, где колесо упирается в стену
  const clampPos = (v: THREE.Vector3) => v.set(
    THREE.MathUtils.clamp(v.x, -HX + 0.3, HX - 0.3), THREE.MathUtils.clamp(v.y, 0.5, H - 0.4), THREE.MathUtils.clamp(v.z, -HZ + 0.3, HZ - 0.3));
  const zoom = (dir: 1 | -1) => {
    const fwd = new THREE.Vector3().subVectors(controls.target, camera.position).normalize();
    if (dir > 0 && fovBoost > 0) fovBoost = Math.max(0, fovBoost - 8); // сначала возвращаем обычный угол
    else {
      const pos = clampPos(camera.position.clone().addScaledVector(fwd, dir * 1.4));
      const moved = pos.distanceTo(camera.position);
      if (dir < 0 && moved < 0.3) fovBoost = Math.min(24, fovBoost + 8); // упёрлись в стену — шире кадр
      const tgt = controls.target.clone().addScaledVector(fwd, dir > 0 ? moved : 0);
      gsap.to(camera.position, { x: pos.x, y: pos.y, z: pos.z, duration: 0.6, ease: "power2.out" });
      gsap.to(controls.target, { x: tgt.x, y: tgt.y, z: tgt.z, duration: 0.6, ease: "power2.out" });
    }
    gsap.to(camera, { fov: baseFov() + fovBoost, duration: 0.6, ease: "power2.out", onUpdate: () => camera.updateProjectionMatrix() });
  };

  const setTime = (t: "day" | "sunset") => {
    const sunset = t === "sunset";
    viewMat.map = viewTex[t]; viewMat.needsUpdate = true;
    gsap.to(sun.color, { r: 1, g: sunset ? 0.62 : 0.95, b: sunset ? 0.32 : 0.86, duration: 1.2 });
    gsap.to(sun, { intensity: sunset ? 3.2 : 2.4, duration: 1.2 });
    gsap.to(sun.position, { x: sunset ? -9 : -3, y: sunset ? 2.6 : 6, duration: 1.2 });
    gsap.to(hemi, { intensity: sunset ? 0.35 : 0.6, duration: 1.2 });
    gsap.to(hemi.color, { r: 1, g: sunset ? 0.82 : 0.96, b: sunset ? 0.66 : 0.89, duration: 1.2 });
    ceilingLights.forEach((l) => gsap.to(l, { intensity: sunset ? 6 : 4, duration: 1.2 }));
    gsap.to(renderer, { toneMappingExposure: sunset ? 0.95 : 1.0, duration: 1.2 });
  };

  const badge = document.getElementById("room-badge")!;
  const setBadge = (id: LayoutId) => {
    gsap.to(badge, {
      opacity: 0, y: 8, duration: 0.25, onComplete: () => {
        badge.innerHTML = `<b>${BADGES[id][0]}</b><span>${BADGES[id][1]}</span>`;
        gsap.to(badge, { opacity: 1, y: 0, duration: 0.35 });
      },
    });
  };

  const bind = (sel: string, attr: string, fn: (v: string) => void) => {
    const btns = root.querySelectorAll<HTMLButtonElement>(sel);
    btns.forEach((b) => b.addEventListener("click", () => {
      btns.forEach((x) => x.classList.toggle("is-active", x === b));
      fn(b.dataset[attr]!);
    }));
  };
  bind("[data-layout]", "layout", (v) => {
    furniture.setLayout(v as LayoutId);
    setBadge(v as LayoutId);
    if (v === "lecture") flyTo("audience");
    else if (v !== "empty") flyTo("overview");
  });
  bind("[data-time]", "time", (v) => setTime(v as "day" | "sunset"));
  root.querySelectorAll<HTMLButtonElement>("[data-view]").forEach((b) => b.addEventListener("click", () => {
    fovBoost = 0;
    gsap.to(camera, { fov: baseFov(), duration: 1.2, onUpdate: () => camera.updateProjectionMatrix() });
    flyTo(b.dataset.view!);
  }));
  root.querySelectorAll<HTMLButtonElement>("[data-zoom]").forEach((b) => b.addEventListener("click", () => zoom(b.dataset.zoom === "in" ? 1 : -1)));

  document.getElementById("room-loading")!.classList.add("is-hidden");
  if (import.meta.env.DEV) { // отладка: поставить камеру в точку, чтобы сверить ракурс с фото зала
    (window as unknown as { __cam: (p?: number[], t?: number[]) => number[] }).__cam = (p, t) => {
      if (p && t) { gsap.killTweensOf(camera.position); gsap.killTweensOf(controls.target); camera.position.set(p[0], p[1], p[2]); controls.target.set(t[0], t[1], t[2]); controls.update(); }
      return [...camera.position.toArray(), camera.fov];
    };
  }
  root.dataset.ready = "1"; // кнопки рассадки в hero ждут этот флаг
  // лёгкий облёт при первом показе
  camera.position.set(-4.9, 3.9, 5.6);
  flyTo("overview");
}
