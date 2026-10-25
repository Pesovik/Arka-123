import { defineConfig } from "vite";

export default defineConfig({
  // 3D-зал (three.js) — отдельный чанк, грузится лениво при подходе к секции
  build: { chunkSizeWarningLimit: 900 },
});
