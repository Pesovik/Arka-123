import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import gsap from "gsap";
import { slide } from "./textures";

/**
 * Мебель и сценарии рассадки. Стулья — один пул InstancedMesh: при смене сценария каждый стул
 * «переезжает» на новое место (лишние уходят вниз, недостающие поднимаются из пола) — зал
 * пересобирается на глазах. Столы, экран и кафедра появляются/исчезают масштабом.
 */

export type LayoutId = "empty" | "lecture" | "table" | "islands";
type Spot = { x: number; z: number; ry: number };

export const BADGES: Record<LayoutId, [string, string]> = {
  empty: ["123 м²", "свободная планировка"],
  lecture: ["до 30 гостей", "проектор, экран 3 м, звук"],
  table: ["до 18 гостей", "один большой стол"],
  islands: ["до 36 гостей", "6 столов-островов"],
};

const MAX_CHAIRS = 60;
const SCREEN_Z = -0.29; // центр рядов, экран на длинной левой стене
const HIDDEN = new THREE.Matrix4().makeScale(0.0001, 0.0001, 0.0001);

function chairGeometry() {
  const parts: THREE.BufferGeometry[] = [];
  const seat = new THREE.BoxGeometry(0.46, 0.05, 0.44); seat.translate(0, 0.46, 0); parts.push(seat);
  const back = new THREE.BoxGeometry(0.44, 0.38, 0.04); back.translate(0, 0.7, -0.2); back.rotateX(-0.08); parts.push(back);
  for (const [x, z] of [[-0.2, -0.18], [0.2, -0.18], [-0.2, 0.18], [0.2, 0.18]]) {
    const leg = new THREE.CylinderGeometry(0.014, 0.014, 0.46, 6); leg.translate(x, 0.23, z); parts.push(leg);
  }
  return mergeGeometries(parts.map((p) => p.toNonIndexed()));
}

function lectureSpots(): Spot[] {
  // 3 ряда по 10 лицом к экрану на левой стене (x = −5.1), проход по центру; первый ряд — прямо перед экраном
  const s: Spot[] = [];
  for (let row = 0; row < 3; row++) {
    for (let k = 0; k < 10; k++) {
      const z = -3.35 + k * 0.62 + (k >= 5 ? 0.5 : 0);
      s.push({ x: -3.6 + row * 0.95, z, ry: -Math.PI / 2 });
    }
  }
  return s;
}

const TABLE = [-1.0, 1.0]; // центр большого стола: стол вдоль длинных стен, южнее колонны и западнее ресепшена
function tableSpots(): Spot[] {
  const s: Spot[] = [];
  for (let k = 0; k < 8; k++) {
    const z = TABLE[1] - 3.15 + k * 0.9;
    s.push({ x: TABLE[0] - 0.95, z, ry: Math.PI / 2 }, { x: TABLE[0] + 0.95, z, ry: -Math.PI / 2 });
  }
  s.push({ x: TABLE[0], z: TABLE[1] - 4.3, ry: 0 }, { x: TABLE[0], z: TABLE[1] + 4.3, ry: Math.PI });
  return s;
}

const ISLANDS = [[-2.6, -4.0], [1.9, -4.0], [-2.6, -0.4], [1.9, -0.4], [-2.6, 3.2], [1.9, 3.2]]; // в обход колонны (1.2, −2.4) и стойки ресепшена
function islandSpots(): Spot[] {
  const s: Spot[] = [];
  for (const [cx, cz] of ISLANDS) {
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      s.push({ x: cx + Math.sin(a) * 1.05, z: cz + Math.cos(a) * 1.05, ry: a + Math.PI });
    }
  }
  return s;
}

const SPOTS: Record<LayoutId, Spot[]> = {
  empty: [],
  lecture: lectureSpots(),
  table: tableSpots(),
  islands: islandSpots(),
};

export function createFurniture(scene: THREE.Scene, mobile: boolean) {
  const black = new THREE.MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.55, metalness: 0.2 });
  const wood = new THREE.MeshStandardMaterial({ color: 0xb98a58, roughness: 0.6 });
  const white = new THREE.MeshStandardMaterial({ color: 0xf2f0ec, roughness: 0.5 });

  const chairs = new THREE.InstancedMesh(chairGeometry(), black, MAX_CHAIRS);
  chairs.castShadow = !mobile;
  chairs.frustumCulled = false; // границы пула считаются, пока все стулья спрятаны в (0,0,0), — иначе ряды пропадают из кадра
  chairs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  for (let i = 0; i < MAX_CHAIRS; i++) chairs.setMatrixAt(i, HIDDEN);
  scene.add(chairs);

  // состояние каждого стула для анимации
  const st = Array.from({ length: MAX_CHAIRS }, () => ({ x: 0, y: -1, z: 0, ry: 0, s: 0 }));
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3();
  const writeChairs = () => {
    for (let i = 0; i < MAX_CHAIRS; i++) {
      const c = st[i];
      if (c.s < 0.001) { chairs.setMatrixAt(i, HIDDEN); continue; }
      q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, c.ry);
      m.compose(p.set(c.x, c.y, c.z), q, sc.setScalar(c.s));
      chairs.setMatrixAt(i, m);
    }
    chairs.instanceMatrix.needsUpdate = true;
  };

  // --- группы предметов под сценарии ---
  const groups: Record<LayoutId, THREE.Group> = { empty: new THREE.Group(), lecture: new THREE.Group(), table: new THREE.Group(), islands: new THREE.Group() };

  // лекция: экран, проектор с лучом
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.8), new THREE.MeshBasicMaterial({ map: slide(), toneMapped: false }));
  screen.position.set(-5.12, 2.3, SCREEN_Z); screen.rotation.y = Math.PI / 2;
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.9, 3.3), black);
  frame.position.set(-5.15, 2.3, SCREEN_Z);
  const projector = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.15, 0.35), white);
  projector.position.set(1.0, 3.9, SCREEN_Z);
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 1.1, 6.2, 24, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff1cf, transparent: true, opacity: 0.05, depthWrite: false, side: THREE.DoubleSide }),
  );
  beam.position.set(-2.05, 3.1, SCREEN_Z); beam.rotation.z = -(Math.PI / 2 - 0.26);
  groups.lecture.add(screen, frame, projector, beam);

  // большой стол
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.05, 7.6), wood); // вдоль длинных стен
  top.position.set(TABLE[0], 0.75, TABLE[1]); top.castShadow = top.receiveShadow = true;
  groups.table.add(top);
  for (const x of [-3.5, 3.5]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.72, 0.08), black);
    leg.position.set(TABLE[0], 0.37, TABLE[1] + x); groups.table.add(leg);
  }
  for (let k = 0; k < 7; k++) {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.14, 12), white);
    pot.position.set(TABLE[0], 0.85, TABLE[1] - 3 + k);
    const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.11, 0), new THREE.MeshStandardMaterial({ color: 0x4d7a45, roughness: 0.8 }));
    leaf.position.set(TABLE[0], 1.0, TABLE[1] - 3 + k);
    groups.table.add(pot, leaf);
  }

  // столы-острова
  for (const [x, z] of ISLANDS) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.05, 40), wood);
    t.position.set(x, 0.75, z); t.castShadow = t.receiveShadow = true;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.3, 0.72, 16), black);
    leg.position.set(x, 0.37, z);
    groups.islands.add(t, leg);
  }

  Object.values(groups).forEach((g) => { g.scale.setScalar(0.0001); g.visible = false; scene.add(g); });

  let current: LayoutId = "empty";

  function setLayout(id: LayoutId) {
    if (id === current) return;
    const prev = groups[current], next = groups[id];
    gsap.to(prev.scale, { x: 0.0001, y: 0.0001, z: 0.0001, duration: 0.5, ease: "power2.in", onComplete: () => { prev.visible = false; } });
    next.visible = true;
    gsap.fromTo(next.scale, { x: 1, y: 0.0001, z: 1 }, { x: 1, y: 1, z: 1, duration: 0.9, delay: 0.35, ease: "back.out(1.6)" });

    const spots = SPOTS[id];
    st.forEach((c, i) => {
      const s = spots[i];
      gsap.killTweensOf(c);
      if (s) {
        if (c.s < 0.01) Object.assign(c, { x: s.x, z: s.z, ry: s.ry, y: -0.6 });
        gsap.to(c, {
          x: s.x, z: s.z, ry: s.ry, y: 0, s: 1, duration: 1.1, delay: 0.2 + i * 0.012,
          ease: "power3.inOut", onUpdate: writeChairs,
        });
      } else if (c.s > 0) {
        gsap.to(c, { y: -0.6, s: 0, duration: 0.5, delay: i * 0.006, ease: "power2.in", onUpdate: writeChairs });
      }
    });
    current = id;
  }

  return { setLayout };
}
