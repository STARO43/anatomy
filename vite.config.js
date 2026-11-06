import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Относительные пути к assets: сборка работает и в корне домена,
  // и в подпапке вида /имя-репозитория/.
  base: './',
});
