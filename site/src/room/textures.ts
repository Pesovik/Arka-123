import * as THREE from "three";
import { drawLockup, lockupWidth } from "../logo";

/** Процедурные текстуры: пол ёлочкой (кварцвинил под дуб), декоративная штукатурка, слайд проектора. */

function rand(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/**
 * Ёлочка: «лесенки» из горизонтальной (4W×W) и вертикальной (W×4W) досок с шагом (W, W),
 * лесенки повторяются со сдвигом (4W, −4W). Узор периодичен по квадрату 8W — тайл бесшовный.
 * На полу текстура поворачивается на 45°.
 */
export function herringbone(): THREE.CanvasTexture {
  const W = 64, L = 4 * W, T = 8 * W;
  const c = document.createElement("canvas");
  c.width = c.height = T;
  const g = c.getContext("2d")!;
  const r = rand(7);
  const tones = ["#c99a62", "#c39058", "#cfa36c", "#bf8c55", "#d2a874", "#c6955d"];
  const plank = (x: number, y: number, w: number, h: number) => {
    g.fillStyle = tones[Math.floor(r() * tones.length)];
    g.fillRect(x, y, w, h);
    // волокна
    g.globalAlpha = 0.16;
    g.strokeStyle = "#7a5530";
    g.lineWidth = 1;
    const along = w > h;
    for (let k = 0; k < 7; k++) {
      g.beginPath();
      const o = 4 + r() * ((along ? h : w) - 8);
      const wob = (r() - 0.5) * 6;
      if (along) { g.moveTo(x, y + o); g.bezierCurveTo(x + w / 3, y + o + wob, x + (2 * w) / 3, y + o - wob, x + w, y + o); }
      else { g.moveTo(x + o, y); g.bezierCurveTo(x + o + wob, y + h / 3, x + o - wob, y + (2 * h) / 3, x + o, y + h); }
      g.stroke();
    }
    g.globalAlpha = 1;
    // фаска-шов
    g.strokeStyle = "rgba(70,45,20,0.55)";
    g.lineWidth = 1.5;
    g.strokeRect(x + 0.75, y + 0.75, w - 1.5, h - 1.5);
  };
  for (let m = -3; m <= 3; m++) {
    for (let n = -14; n <= 14; n++) {
      const ox = n * W + m * L, oy = n * W - m * L;
      for (const [dx, dy] of [[0, 0], [T, 0], [0, T], [-T, 0], [0, -T]]) {
        plank(ox + dx, oy + dy, L, W);
        plank(ox + dx, oy + W + dy, W, L);
      }
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export function plaster(base = "#e9dfcf"): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const g = c.getContext("2d")!;
  g.fillStyle = base;
  g.fillRect(0, 0, 512, 512);
  const r = rand(3);
  for (let i = 0; i < 2600; i++) {
    const x = r() * 512, y = r() * 512, s = 6 + r() * 40;
    g.fillStyle = r() > 0.5 ? "rgba(255,255,255,0.03)" : "rgba(120,100,70,0.025)"; // обои: фактура едва заметна
    g.beginPath();
    g.ellipse(x, y, s, s * (0.3 + r() * 0.6), r() * Math.PI, 0, Math.PI * 2);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Белые стеновые панели с чёрными швами (как на фото у входа). */
/** Белая панельная стена ресепшена — раскладка крупных панелей с тонкими чёрными швами, как на фото (3 × 4.2 м). */
export function panelWall(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 1024; c.height = 1434;
  const g = c.getContext("2d")!;
  g.fillStyle = "#efefed";
  g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = "#141414";
  g.lineWidth = 5;
  // [x0, y0, x1, y1] в долях ширины/высоты, сверху вниз
  const rects = [
    [0, 0, 0.17, 0.68], [0.17, 0, 0.34, 0.43], [0.17, 0.43, 0.34, 0.68], [0, 0.68, 0.34, 1],
    [0.34, 0, 0.67, 0.33], [0.34, 0.33, 0.5, 1], [0.5, 0.33, 0.67, 0.57], [0.5, 0.57, 0.67, 1],
    [0.67, 0, 0.83, 0.68], [0.67, 0.68, 0.83, 1], [0.83, 0, 1, 0.32], [0.83, 0.32, 1, 1],
  ];
  for (const [x0, y0, x1, y1] of rects) g.strokeRect(x0 * c.width, y0 * c.height, (x1 - x0) * c.width, (y1 - y0) * c.height);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

export function slide(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 1024; c.height = 576;
  const g = c.getContext("2d")!;
  const grd = g.createLinearGradient(0, 0, 1024, 576);
  grd.addColorStop(0, "#1d1d20");
  grd.addColorStop(1, "#3a2c12");
  g.fillStyle = grd;
  g.fillRect(0, 0, 1024, 576);
  // логотип из ТЗ (белая версия на тёмном), по центру слайда
  const size = 92;
  drawLockup(g, (1024 - lockupWidth(g, size)) / 2, 288 + size * 1.25, size, "#f5f0e6");
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Ряд журналов на полке ресепшена: разноцветные обложки, обращённые в зал. */
export function magazines(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 1024; c.height = 140;
  const g = c.getContext("2d")!;
  const covers = ["#d9534f", "#f0ad4e", "#5bc0de", "#e8e4dc", "#337ab7", "#9b59b6", "#f7f3ea", "#2e8b57", "#e67e22", "#c0392b"];
  let x = 6, i = 0;
  while (x < c.width - 40) {
    const w = 52 + ((i * 37) % 30);
    g.fillStyle = covers[i % covers.length];
    g.fillRect(x, 18 + (i % 3) * 4, w, 118);
    g.fillStyle = "rgba(255,255,255,0.75)";
    g.fillRect(x + 6, 30 + (i % 3) * 4, w - 12, 10);
    x += w + 8; i++;
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
