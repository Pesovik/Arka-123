import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/**
 * Скролл-фильм: последовательность WebP-кадров на canvas, номер кадра = прогресс скролла секции.
 * Манифест public/film/manifest.json: { desktop: {count, w, h}, mobile: {count, w, h} }
 * Кадры: public/film/<variant>/0001.webp …
 * Загрузка прогрессивная: сначала каждый 8-й кадр (фильм сразу «живой»), затем добор остальных.
 */

type Variant = { count: number; w: number; h: number };
type Manifest = { desktop: Variant; mobile?: Variant };

export async function initFilm(canvas: HTMLCanvasElement, section: HTMLElement, onProgress: (p: number) => void) {
  const manifest: Manifest = await fetch(`${import.meta.env.BASE_URL}film/manifest.json`).then((r) => r.json());
  const isMobile = window.matchMedia("(max-aspect-ratio: 4/5)").matches && !!manifest.mobile;
  const variant = isMobile ? "mobile" : "desktop";
  const v = (isMobile ? manifest.mobile : manifest.desktop)!;
  const frames: (HTMLImageElement | null)[] = new Array(v.count).fill(null);
  const ctx = canvas.getContext("2d")!;
  const src = (i: number) => `${import.meta.env.BASE_URL}film/${variant}/${String(i + 1).padStart(4, "0")}.webp`;

  let current = 0;
  const draw = (i: number) => {
    // ближайший загруженный кадр, если нужный ещё не пришёл
    let img = frames[i];
    for (let d = 1; !img && d < v.count; d++) img = frames[i - d] || frames[i + d];
    if (!img) return;
    const cw = canvas.width, ch = canvas.height;
    const s = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
    const w = img.naturalWidth * s, h = img.naturalHeight * s;
    ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
  };

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(canvas.clientWidth * dpr);
    canvas.height = Math.round(canvas.clientHeight * dpr);
    draw(current);
  };
  window.addEventListener("resize", resize);

  const load = (i: number) =>
    new Promise<void>((res) => {
      if (frames[i]) return res();
      const img = new Image();
      img.decoding = "async";
      img.onload = () => { frames[i] = img; if (i === current) draw(current); res(); };
      img.onerror = () => res();
      img.src = src(i);
    });

  // первый проход: каждый 8-й кадр — он и определяет прогресс лоадера
  const coarse = [...Array(v.count).keys()].filter((i) => i % 8 === 0 || i === v.count - 1);
  let done = 0;
  await Promise.all(coarse.map((i) => load(i).then(() => onProgress(++done / coarse.length))));
  resize();

  // добор остальных кадров пачками, не блокируя страницу
  (async () => {
    const rest = [...Array(v.count).keys()].filter((i) => !frames[i]);
    for (let k = 0; k < rest.length; k += 12) await Promise.all(rest.slice(k, k + 12).map(load));
  })();

  const state = { f: 0 };
  ScrollTrigger.create({
    trigger: section,
    start: "top top",
    end: "bottom bottom",
    scrub: true,
    onUpdate: (st) => {
      gsap.to(state, {
        f: st.progress * (v.count - 1), duration: 0.25, ease: "power1.out", overwrite: true,
        onUpdate: () => {
          const i = Math.round(state.f);
          if (i !== current) { current = i; draw(i); }
        },
      });
    },
  });
}
