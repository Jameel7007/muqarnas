import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig(({ command }) => ({
  // the site deploys at jameel7007.github.io/muqarnas/
  base: command === 'build' ? '/muqarnas/' : '/',
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        inspect: fileURLToPath(new URL('./inspect.html', import.meta.url)),
        render: fileURLToPath(new URL('./render.html', import.meta.url)),
        about: fileURLToPath(new URL('./about.html', import.meta.url)),
      },
    },
  },
}));
