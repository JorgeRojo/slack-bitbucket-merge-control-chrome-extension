import { resolve } from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import webExtension from 'vite-plugin-web-extension';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  resolve: {
    alias: {
      '@src': resolve(__dirname, './src'),
      '@tests': resolve(__dirname, './tests'),
    },
    extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json'],
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        content: resolve(__dirname, 'src/modules/content/content.ts'),
      },
      output: {
        entryFileNames: '[name].js',
      },
    },
  },
  plugins: [
    react(),
    webExtension({
      manifest: resolve(__dirname, 'manifest.json'),
    }),
    viteStaticCopy({
      targets: [
        { src: 'src/modules/common/images/icon128_disabled.png', dest: 'images' },
        { src: 'src/modules/common/images/icon128_enabled.png', dest: 'images' },
        { src: 'src/modules/common/images/icon128_error.png', dest: 'images' },
        { src: 'src/modules/common/images/icon128_exception.png', dest: 'images' },
        { src: 'src/modules/common/images/icon128.png', dest: 'images' },
        { src: 'src/modules/common/images/icon16_disabled.png', dest: 'images' },
        { src: 'src/modules/common/images/icon16_enabled.png', dest: 'images' },
        { src: 'src/modules/common/images/icon16_error.png', dest: 'images' },
        { src: 'src/modules/common/images/icon16_exception.png', dest: 'images' },
        { src: 'src/modules/common/images/icon16.png', dest: 'images' },
        { src: 'src/modules/common/images/icon48_disabled.png', dest: 'images' },
        { src: 'src/modules/common/images/icon48_enabled.png', dest: 'images' },
        { src: 'src/modules/common/images/icon48_error.png', dest: 'images' },
        { src: 'src/modules/common/images/icon48_exception.png', dest: 'images' },
        { src: 'src/modules/common/images/icon48.png', dest: 'images' },
        { src: 'src/modules/common/styles/base.css', dest: 'styles' },
        { src: 'src/modules/common/styles/pages.css', dest: 'styles' },
        { src: 'src/modules/common/styles/popup.css', dest: 'styles' },
        { src: 'src/modules/common/styles/variables.css', dest: 'styles' },
        {
          src: 'src/modules/common/components/toggle-switch/toggle-switch.css',
          dest: 'components/toggle-switch',
        },
      ],
    }),
  ],
});