import { defineConfig } from 'vite';
import { resolve } from 'path';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background.ts'),
        popup: resolve(__dirname, 'src/popup.ts'),
        options: resolve(__dirname, 'src/options.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name].js',
        assetFileNames: 'assets/[name].[ext]',
        format: 'es',
        manualChunks: undefined,
      },
      external: [],
    },
    target: 'es2020',
    minify: false,
    sourcemap: true,
  },
  plugins: [
    viteStaticCopy({
      targets: [
        { src: 'src/manifest.json', dest: '.' },
        { src: 'src/popup.html', dest: '.' },
        { src: 'src/options.html', dest: '.' },
        { src: 'src/help.html', dest: '.' },
        { src: 'src/styles', dest: '.' },
        { src: 'src/images', dest: '.' },
        { 
          src: 'src/components/toggle-switch/toggle-switch.css', 
          dest: 'components/toggle-switch' 
        },
      ],
    }),
  ],
  resolve: {
    extensions: ['.ts', '.js'],
  },
});
