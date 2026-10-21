import { defineConfig } from "vite";
export default defineConfig({
  base: "./",
  build: {
    chunkSizeWarningLimit: 750,
    rollupOptions: {
      input: {
        main: "index.html",
        artLab: "art-lab.html",
        artLabV1: "art-lab-v1.html",
      },
      output: { manualChunks: { three: ["three"] } },
    },
  },
});
