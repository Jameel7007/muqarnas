import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        render: fileURLToPath(new URL('./render.html', import.meta.url)),
        scroll: fileURLToPath(new URL('./scroll.html', import.meta.url)),
      },
    },
  },
});
