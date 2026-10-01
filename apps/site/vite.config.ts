import { defineConfig } from 'vite';

export default defineConfig({
  // VITE_BASE=/super-boundhaven/ for GitHub project Pages; default '/' for local dev.
  base: process.env.VITE_BASE ?? '/',
  server: { port: 5174, strictPort: true },
  preview: { port: 5174, strictPort: true },
  // PNG art is small and cached separately; keep it as real files instead of inlining into JS.
  build: { target: 'es2022', assetsInlineLimit: 0 },
});
