import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [],
  resolve: {
    alias: { '@': '/src' },
  },
  build: {
    target: 'es2020',
  },
  server: {
    port: 3000,
  },
});
