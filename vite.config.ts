import { defineConfig } from "vitest/config";

export default defineConfig({
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      input: {
        main: "index.html",
        about: "about.html",
        privacy: "privacy.html",
        notFound: "404.html"
      }
    }
  },
  test: {
    environment: "node"
  }
});
