import { defineConfig } from 'vite';

export default defineConfig({
  // VITE_CLIENT_BASE=/super-boundhaven/play/ when served under the Pages subpath; '/' for local dev.
  base: process.env.VITE_CLIENT_BASE ?? '/',
  // art PNG/JSON live in packages/art (inside the workspace root, which Vite allows by default)
  server: { port: 5173, strictPort: true },
  build: { assetsInlineLimit: 0 },
});
