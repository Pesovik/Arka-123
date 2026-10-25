import gsap from "gsap";

/**
 * Логотип АРКА 123 по ТЗ: арка-проём с цифрами 123 (ножка «1» стоит на пороге арки), справа — «АРКА 123»
 * и слоган «Встречаемся напротив Библиотеки.».
 *
 * Лоадер (тайминги из ТЗ):
 *  0–1 с       арка рисуется одной линией, как проём в стене;
 *  0,6–2,25 с  в арке, как в окне, прорисовывается Национальная библиотека, затем линии стираются;
 *  1,9–2,7 с   буквы названия по очереди въезжают в маски сбоку (первая — за 0,1 с с отскоком, шаг 0,07 с);
 *  2–2,85 с    вместо библиотеки внутри арки одна за другой появляются цифры 1, 2, 3;
 *  2,6–3,65 с  проявляется слоган.
 * Хедер: буквы названия въезжают в маски так же — после лоадера и при наведении.
 */

// геометрия знака в системе 120 × 136, толщина линий 9
export const MARK = {
  w: 120,
  h: 136,
  stroke: 9,
  // одна линия: от середины порога влево, вверх по арке, вниз и обратно по порогу
  arch: "M60 128H8V60A52 52 0 0 1 112 60V128Z",
  // внешний контур арки — маска для цифр
  outer: "M3.5 132.5V60A56.5 56.5 0 0 1 116.5 60V132.5Z",
  // внутренний проём — маска для рисунка библиотеки
  inner: "M12.5 123.5V60A47.5 47.5 0 0 1 107.5 60V123.5Z",
  one: "M17.5 64.4L26 54.4H37.9V128H28.7V64.4Z",
  two: "M45.7 71V67.4A9.85 9.85 0 1 1 63.2 73.7L45.7 100.6V106.1H67.1",
  three: "M72.9 58.1H97.5L82.4 80.4A12.5 12.5 0 1 1 72.8 93.3",
};

/** Знак на canvas (те же пути, что в SVG): левый верхний угол (x, y), высота h. */
export function drawMark(g: CanvasRenderingContext2D, x: number, y: number, h: number, color: string) {
  const k = h / MARK.h;
  g.save();
  g.translate(x, y); g.scale(k, k);
  g.strokeStyle = g.fillStyle = color;
  g.lineWidth = MARK.stroke; g.lineJoin = "miter"; g.miterLimit = 2.5;
  [MARK.arch, MARK.two, MARK.three].forEach((d) => g.stroke(new Path2D(d)));
  g.fill(new Path2D(MARK.one));
  g.restore();
}

/**
 * Полный логотип на canvas — как в ТЗ: знак, «АРКА 123», слоган в две строки. size — кегль названия в px,
 * (x, y) — левый нижний угол знака. Пропорции те же, что у HTML-версии (.lockup).
 */
export function drawLockup(g: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
  const markH = size * 2.5;
  drawMark(g, x, y - markH, markH, color);
  const tx = x + markH * (MARK.w / MARK.h) + size * 0.34;
  const s = size * 0.36;
  g.save();
  g.fillStyle = color;
  g.textAlign = "left";
  g.textBaseline = "alphabetic";
  g.font = `500 ${s}px Manrope, sans-serif`;
  g.fillText("Библиотеки.", tx, y - s * 0.22);
  g.fillText("Встречаемся напротив", tx, y - s * 0.22 - s * 1.18);
  g.font = `800 ${size}px Manrope, sans-serif`;
  if ("letterSpacing" in g) (g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${-size * 0.015}px`;
  g.fillText("АРКА 123", tx, y - s * 2.36 - size * 0.42);
  g.restore();
}

/** Ширина полного логотипа на canvas (для центрирования). */
export function lockupWidth(g: CanvasRenderingContext2D, size: number) {
  g.save();
  g.font = `800 ${size}px Manrope, sans-serif`;
  const w = size * 2.5 * (MARK.w / MARK.h) + size * 0.34 + g.measureText("АРКА 123").width;
  g.restore();
  return w;
}

// вид из окна зала: башня, «алмаз» Национальной библиотеки, площадь
const LIBRARY = [
  "M21.5 95.3L21.5 36.6L36.6 34.6L35.8 95.3",
  "M21.5 49.7L36.6 49.7", "M21.5 63.6L36.6 63.6", "M21.5 75.5L36.6 75.5", "M21.5 87.4L36.6 87.4",
  "M12.8 100.5L15.5 100.5L15.5 96.5L52.5 96.5",
  "M36.6 57.6L55.2 41L79.1 41L98.1 55.6",
  "M36.6 57.6L98.1 54.8", "M36.6 82.2L98.1 81.4",
  "M36.6 57.6L36.6 82.2L51.3 96.5", "M98.1 55.6L98.1 81.4L87.4 96.5",
  "M55.2 41L52.5 96.5", "M79.1 41L79.1 96.5",
  "M87.4 96.5L110 96.5",
  "M14.7 119.2L24.7 100.5L34.6 119.2Z",
  "M56.4 98.5H69.1V106.5H56.4Z",
  "M72.3 105.3L96.1 100.5L86.2 118",
  "M38.6 120H60.4", "M63.6 120H82.2", "M85.4 120H110",
];

let uid = 0;

export function markSVG(opts: { library?: boolean } = {}): string {
  const id = `m${uid++}`;
  const lib = opts.library
    ? `<g class="mark__lib" clip-path="url(#${id}-in)">${LIBRARY.map((d) => `<path d="${d}" pathLength="1"/>`).join("")}</g>`
    : "";
  return `
<svg class="mark" viewBox="0 0 ${MARK.w} ${MARK.h}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <clipPath id="${id}-out"><path d="${MARK.outer}"/></clipPath>
    <clipPath id="${id}-in"><path d="${MARK.inner}"/></clipPath>
  </defs>
  ${lib}
  <g class="mark__digits" clip-path="url(#${id}-out)">
    <path class="mark__d mark__d--fill" d="${MARK.one}"/>
    <path class="mark__d" d="${MARK.two}"/>
    <path class="mark__d" d="${MARK.three}"/>
  </g>
  <path class="mark__arch" d="${MARK.arch}" pathLength="1"/>
</svg>`;
}

const WORD = "АРКА 123";

function wordHTML(clones = false): string {
  return [...WORD].map((c) => (c === " "
    ? `<span class="ch ch--space"> </span>`
    : `<span class="ch"><span class="ch__in">${c}</span>${clones ? `<span class="ch__clone" aria-hidden="true">${c}</span>` : ""}</span>`)).join("");
}

/** Полный логотип: знак + название (+ слоган). */
export function lockupHTML(opts: { slogan?: boolean; library?: boolean; clones?: boolean } = {}): string {
  return `
<span class="lockup" role="img" aria-label="АРКА 123 — Встречаемся напротив Библиотеки">
  ${markSVG({ library: opts.library })}
  <span class="lockup__text">
    <span class="lockup__word">${wordHTML(opts.clones)}</span>
    ${opts.slogan ? `<span class="lockup__slogan"><span>Встречаемся напротив</span><span>Библиотеки.</span></span>` : ""}
  </span>
</span>`;
}

// движение буквы — одно на лоадер и ховер: долетает до места за 0,1 с и отпружинивает
const ARRIVE = { duration: 0.1, ease: "power2.in" };
const BOUNCE = 16; // % ширины буквы
function arrive(tl: gsap.core.Timeline, el: Element, from: number, at: gsap.Position) {
  tl.fromTo(el, { xPercent: from }, { xPercent: 0, ...ARRIVE, immediateRender: false }, at)
    .to(el, { xPercent: Math.sign(from) * BOUNCE, duration: 0.12, ease: "power2.out" }, ">")
    .to(el, { xPercent: 0, duration: 0.2, ease: "power2.in" }, ">");
  return tl;
}

/** Буквы по очереди въезжают в маски сбоку: первая долетает за 0,1 с и отпружинивает, остальные — с шагом 0,07 с. */
export function lettersIn(root: Element, at = 0, tl: gsap.core.Timeline = gsap.timeline()) {
  root.querySelectorAll(".ch__in").forEach((el, i) => {
    gsap.set(el, { xPercent: -115 });
    arrive(tl, el, -115, at + i * 0.07);
  });
  return tl;
}

/**
 * Ховер по названию в хедере: каждая буква срабатывает, когда курсор на неё заходит. Такая же буква въезжает
 * в маску с той стороны, откуда пришёл курсор, и отпружинивает, а прежняя уезжает в противоположную сторону.
 * На телефоне — по нажатию на букву (сторона — по месту касания).
 */
function letterSwap(ch: HTMLElement) {
  let cur = ch.querySelector<HTMLElement>(".ch__in")!;
  let next = ch.querySelector<HTMLElement>(".ch__clone")!;
  let busy = false;
  gsap.set(next, { xPercent: -115 });
  const play = (clientX: number) => {
    if (busy) return;
    busy = true;
    const r = ch.getBoundingClientRect();
    const side = clientX < r.left + r.width / 2 ? -1 : 1; // -1: курсор пришёл слева
    gsap.killTweensOf(cur);
    gsap.set(cur, { xPercent: 0 });
    const tl = gsap.timeline({
      onComplete: () => { [cur, next] = [next, cur]; busy = false; },
    }).to(cur, { xPercent: -side * 115, ...ARRIVE }, 0);
    arrive(tl, next, side * 115, 0);
  };
  ch.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") play(e.clientX); });
  ch.addEventListener("pointerdown", (e) => { if (e.pointerType !== "mouse") play(e.clientX); });
}

/** Вставляет логотипы во все [data-logo]. */
export function mountLogos() {
  document.querySelectorAll<HTMLElement>("[data-logo]").forEach((el) => {
    const kind = el.dataset.logo;
    el.innerHTML = lockupHTML({ slogan: kind !== "header", library: kind === "loader", clones: kind === "header" });
    if (kind === "header") {
      gsap.set(el.querySelectorAll(".ch__in"), { xPercent: -115 }); // спрятаны до конца лоадера
      el.querySelectorAll<HTMLElement>(".ch:not(.ch--space)").forEach(letterSwap);
    }
  });
}

/** Въезд букв в хедере после лоадера, когда сам хедер уже проявился. */
export function headerIntro(delay = 0) {
  const el = document.querySelector('[data-logo="header"]');
  if (el) lettersIn(el, delay);
}

/** Анимация лоадера. setProgress(0..1) — тонкая полоса загрузки; finish() ждёт конца ролика и убирает лоадер. */
export function loaderAnimation(root: HTMLElement) {
  const arch = root.querySelector<SVGPathElement>(".mark__arch")!;
  const lib = root.querySelectorAll(".mark__lib path");
  const digits = root.querySelectorAll(".mark__d");
  const slogan = root.querySelectorAll(".lockup__slogan > span");
  const bar = root.querySelector<HTMLElement>(".loader__bar i");

  gsap.set(root.querySelectorAll(".ch__in"), { xPercent: -115 });
  gsap.set(digits, { y: 84 }); // ниже порога арки — скрыты маской
  gsap.set(slogan, { opacity: 0, y: 10, filter: "blur(6px)" });
  gsap.set([arch, ...lib], { strokeDasharray: 1, strokeDashoffset: 1 });

  const tl = gsap.timeline()
    // 0–1 с: арка одной линией
    .to(arch, { strokeDashoffset: 0, duration: 1, ease: "power2.inOut" }, 0)
    // 0,6–2,25 с: библиотека рисуется (до 1,75 с), затем линии стираются
    .to(lib, { strokeDashoffset: 0, duration: 0.55, ease: "power1.inOut", stagger: 0.03 }, 0.6)
    .to(lib, { strokeDashoffset: -1, duration: 0.4, ease: "power1.in", stagger: 0.005 }, 1.75)
    // 2–2,85 с: цифры 1, 2, 3 поднимаются в проём
    .to(digits, { y: 0, duration: 0.35, ease: "power3.out", stagger: 0.25 }, 2)
    // 2,6–3,65 с: слоган
    .to(slogan, { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.9, ease: "power2.out", stagger: 0.15 }, 2.6);
  // 1,9–2,7 с: буквы
  lettersIn(root.querySelector(".lockup__word")!, 1.9, tl);

  const played = new Promise<void>((r) => tl.eventCallback("onComplete", () => r()));
  let shown = 0;

  return {
    setProgress(p: number) {
      if (!bar || p <= shown) return;
      shown = p;
      gsap.to(bar, { scaleX: p, duration: 0.4, ease: "power1.out", overwrite: true });
    },
    async finish(): Promise<void> {
      await played;
      await gsap.timeline()
        .to(root.querySelector(".loader__bar"), { opacity: 0, duration: 0.3 }, 0.2)
        .to(root.querySelector(".lockup"), { y: -24, opacity: 0, duration: 0.7, ease: "power3.in" }, 0.35)
        .to(root, { opacity: 0, duration: 0.6, ease: "power1.out" }, 0.8)
        .then();
    },
  };
}
