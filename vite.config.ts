import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [solid(), tailwindcss()],
  server: {
    port: 1420,
    proxy: {
      "/api": "http://localhost:4200",
      "/ws": {
        target: "ws://localhost:4200",
        ws: true,
      },
    },
  },
  optimizeDeps: {
    exclude: ["ghostty-web"], // WASM package - don't pre-bundle
  },
  build: {
    target: "esnext",
  },
});
