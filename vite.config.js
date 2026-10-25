import { defineConfig } from "vite";

// base 用相對路徑,部署在 GitHub Pages 子路徑 (/repo-name/) 或網域根目錄都能運作
export default defineConfig({
  base: "./",
  server: { port: 5173 },
  build: {
    target: "es2022", // main3d.js 使用 top-level await
    chunkSizeWarningLimit: 900,
  },
});
