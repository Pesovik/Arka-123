import { defineConfig } from "vite";

export default defineConfig({
  // GitHub Pages: сайт живёт по адресу pesovik.github.io/Arka-123/
  base: "/Arka-123/",
  // 3D-зал (three.js) — отдельный чанк, грузится лениво при подходе к секции
  build: { chunkSizeWarningLimit: 900 },
});
