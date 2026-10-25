import "./styles.css";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { headerIntro, loaderAnimation, mountLogos } from "./logo";
import { initFilm } from "./scroll-film";
import { initForm, initGallery, initHeader, initLayoutLinks, initReveals, initReviews, initScrollHint, initStoryScenes } from "./sections";

gsap.registerPlugin(ScrollTrigger);
document.body.classList.add("is-loading");
window.history.scrollRestoration = "manual";
window.scrollTo(0, 0);

mountLogos();

const loaderEl = document.getElementById("loader")!;
const loader = loaderAnimation(loaderEl);

// прогресс загрузки (тонкая полоса под логотипом): шрифты 10% + первые кадры фильма 90%
let fontP = 0, filmP = 0;
const t0 = performance.now();
const report = () => {
  const real = fontP * 0.1 + filmP * 0.9;
  loader.setProgress(Math.min(real, (performance.now() - t0) / 1500));
};
const tick = () => { report(); if (document.body.classList.contains("is-loading")) requestAnimationFrame(tick); };
requestAnimationFrame(tick);

const lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 0.9 });
lenis.stop();
lenis.on("scroll", ScrollTrigger.update);
gsap.ticker.add((t) => lenis.raf(t * 1000));
gsap.ticker.lagSmoothing(0);

initHeader(lenis);
initGallery();
initReviews();
initForm();
initLayoutLinks(lenis);

const fonts = document.fonts.ready.then(() => { fontP = 1; report(); });
const film = initFilm(
  document.getElementById("film") as HTMLCanvasElement,
  document.getElementById("story")!,
  (p) => { filmP = p; report(); },
).catch((e) => { console.warn("film failed", e); filmP = 1; report(); });

Promise.all([fonts, film]).then(async () => {
  initStoryScenes();
  initScrollHint();
  initReveals();
  ScrollTrigger.refresh();
  await loader.finish();
  loaderEl.remove();
  document.body.classList.remove("is-loading");
  lenis.start();
  gsap.from(".scene--hero > *", { opacity: 0, y: 30, duration: 1.1, stagger: 0.1, ease: "power3.out" });
  gsap.from(".header", { opacity: 0, y: -20, duration: 0.9, ease: "power3.out" });
  headerIntro(0.5);

  // 3D-зал грузим лениво, когда секция подходит к экрану
  const roomEl = document.getElementById("room")!;
  const io = new IntersectionObserver(async ([e]) => {
    if (!e.isIntersecting) return;
    io.disconnect();
    const { initRoom } = await import("./room/scene");
    initRoom(roomEl);
  }, { rootMargin: "600px" });
  io.observe(roomEl);
});
