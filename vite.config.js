import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  appType: 'mpa',
  server: {
    host: '0.0.0.0',
    port: 8090,
    strictPort: true,
    watch: {
      ignored: ['**/*.mp4'],
    },
  },
});
