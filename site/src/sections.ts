import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type Lenis from "lenis";

const PHOTOS: { src: string; alt: string }[] = [
  { src: "g01", alt: "Зал на закате: два арочных окна с видом на Национальную библиотеку" },
  { src: "g02", alt: "Открытый зал с колоннами и линейными светильниками" },
  { src: "g03", alt: "Арочное окно и вид на библиотеку днём" },
  { src: "g04", alt: "Зал с высоким потолком 4,5 м" },
  { src: "g05", alt: "Стена с часами и подвесные светильники" },
  { src: "g06", alt: "Вид из окна на площадь с фонтаном" },
  { src: "g07", alt: "Ресепшен и стеллаж с подсветкой" },
  { src: "g08", alt: "Арочные окна и светлый пол ёлочкой" },
  { src: "g09", alt: "Вход в пространство из коридора бизнес-центра" },
  { src: "g10", alt: "Окно с логотипом и видом на город" },
];

export function initHeader(lenis: Lenis) {
  const header = document.getElementById("header")!;
  const burger = document.getElementById("burger")!;
  let last = 0;
  lenis.on("scroll", ({ scroll }: { scroll: number }) => {
    header.classList.toggle("is-solid", scroll > 40);
    header.classList.toggle("is-hidden", scroll > last && scroll > 400 && !header.classList.contains("menu-open"));
    last = scroll;
  });
  burger.addEventListener("click", () => {
    const open = header.classList.toggle("menu-open");
    burger.setAttribute("aria-expanded", String(open));
  });
  document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach((a) =>
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href")!;
      const target = id === "#top" ? 0 : document.querySelector<HTMLElement>(id);
      if (target === null) return;
      e.preventDefault();
      header.classList.remove("menu-open");
      lenis.scrollTo(target as HTMLElement | number, { offset: id === "#top" ? 0 : -70, duration: 1.4 });
    }),
  );
}

export function initStoryScenes() {
  document.querySelectorAll<HTMLElement>(".scene").forEach((scene) => {
    const items = scene.querySelectorAll(":scope > *");
    // первый экран виден сразу после лоадера, остальные сцены проявляются по скроллу
    if (!scene.classList.contains("scene--hero")) {
      gsap.fromTo(items, { opacity: 0, y: 40 }, {
        opacity: 1, y: 0, stagger: 0.08, ease: "power2.out", immediateRender: false,
        scrollTrigger: { trigger: scene, start: "top 75%", end: "top 35%", scrub: true },
      });
      gsap.set(items, { opacity: 0 });
    }
    gsap.fromTo(items, { opacity: 1, y: 0 }, {
      opacity: 0, y: -30, ease: "power1.in", immediateRender: false,
      scrollTrigger: { trigger: scene, start: "bottom 65%", end: "bottom 25%", scrub: true },
    });
  });
}

/** Переключатель рассадки в сцене «Лекция»: прокручивает к 3D-залу и включает выбранную рассадку. */
export function initLayoutLinks(lenis: Lenis) {
  document.querySelectorAll<HTMLButtonElement>("[data-goto-layout]").forEach((b) => b.addEventListener("click", () => {
    const room = document.getElementById("room")!;
    lenis.scrollTo("#space", { offset: -10, duration: 1.6 });
    const t0 = performance.now();
    const apply = () => {
      if (room.dataset.ready) room.querySelector<HTMLButtonElement>(`[data-layout="${b.dataset.gotoLayout}"]`)?.click();
      else if (performance.now() - t0 < 8000) setTimeout(apply, 250);
    };
    setTimeout(apply, 1200);
  }));
}

/** Подсказка «Прокрутите, чтобы войти» исчезает после первого жеста. */
export function initScrollHint() {
  const hint = document.querySelector(".scroll-hint");
  if (!hint) return;
  const hide = () => { gsap.to(hint, { opacity: 0, y: 8, duration: 0.4 }); window.removeEventListener("scroll", hide); };
  window.addEventListener("scroll", hide, { passive: true });
}

export function initReveals() {
  const targets = document.querySelectorAll<HTMLElement>(
    ".section__head, .about__text > *, .about__host, .card, .plan, .extras, .review, .booking > *, .gallery button",
  );
  targets.forEach((el) => el.setAttribute("data-reveal", ""));
  ScrollTrigger.batch(targets, {
    start: "top 88%",
    once: true,
    onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, duration: 1, ease: "power3.out", stagger: 0.08 }),
  });
}

export function initGallery() {
  const grid = document.getElementById("gallery-grid")!;
  grid.innerHTML = PHOTOS.map((p, i) =>
    `<button data-i="${i}" aria-label="Открыть фото: ${p.alt}"><img src="/photos/${p.src}-s.webp" alt="${p.alt}" loading="lazy" /></button>`,
  ).join("");
  const box = document.getElementById("lightbox") as HTMLDialogElement;
  const img = box.querySelector("img")!;
  let idx = 0;
  const show = (i: number) => {
    idx = (i + PHOTOS.length) % PHOTOS.length;
    img.src = `/photos/${PHOTOS[idx].src}.webp`;
    img.alt = PHOTOS[idx].alt;
  };
  grid.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest("button");
    if (!b) return;
    show(Number(b.dataset.i));
    box.showModal();
  });
  box.querySelector(".lightbox__close")!.addEventListener("click", () => box.close());
  box.querySelector(".lightbox__nav--prev")!.addEventListener("click", () => show(idx - 1));
  box.querySelector(".lightbox__nav--next")!.addEventListener("click", () => show(idx + 1));
  box.addEventListener("click", (e) => { if (e.target === box) box.close(); });
  box.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") show(idx - 1);
    if (e.key === "ArrowRight") show(idx + 1);
  });
}

export function initReviews() {
  const track = document.getElementById("reviews-track")!;
  document.querySelectorAll<HTMLButtonElement>(".reviews__nav button").forEach((b) =>
    b.addEventListener("click", () => {
      const card = track.querySelector<HTMLElement>(".review")!;
      track.scrollBy({ left: Number(b.dataset.dir) * (card.offsetWidth + 18), behavior: "smooth" });
    }),
  );
}

export function initForm() {
  const form = document.getElementById("booking-form") as HTMLFormElement;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    form.querySelector<HTMLElement>(".form__ok")!.hidden = false;
    form.querySelector<HTMLButtonElement>("button")!.disabled = true;
  });
}
