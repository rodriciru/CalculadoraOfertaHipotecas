import { defineConfig } from 'vite';

export default defineConfig({
  root: './',
  publicDir: 'public', // Si tuvieras assets estáticos fuera de index.html
  build: {
    outDir: 'dist', // Directorio de salida para la build
    emptyOutDir: true, // Limpiar el directorio de salida antes de cada build
  },
  server: {
    open: true,
    port: 5173, // Cambiado para evitar conflicto con el servidor de la API
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
