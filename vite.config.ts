import { defineConfig, Plugin } from 'vite';
import { resolve } from 'path';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { build } from 'esbuild';

// Custom plugin to handle content script as IIFE
function chromeExtensionContentScript(): Plugin {
  return {
    name: 'chrome-extension-content-script',
    apply: 'build',
    async generateBundle(options, bundle) {
      // Find and remove content script from the bundle
      const contentChunkName = Object.keys(bundle).find(
        name =>
          name === 'content.js' ||
          (bundle[name].type === 'chunk' && bundle[name].name === 'content')
      );

      if (contentChunkName) {
        // Remove the content script from Vite's bundle
        delete bundle[contentChunkName];

        // Build content script separately with esbuild as IIFE
        console.log('🔧 Building content script with esbuild (IIFE format)...');
        try {
          await build({
            entryPoints: [resolve(__dirname, 'src/content.ts')],
            bundle: true,
            outfile: resolve(__dirname, 'dist/content.js'),
            format: 'iife',
            target: 'es2020',
            platform: 'browser',
            sourcemap: true,
            minify: false,
          });
          console.log('✅ Content script built successfully!');
        } catch (error) {
          console.error('❌ Content script build failed:', error);
          throw error;
        }
      }
    },
  };
}

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background.ts'),
        popup: resolve(__dirname, 'src/popup.ts'),
        options: resolve(__dirname, 'src/options.ts'),
        help: resolve(__dirname, 'src/help.ts'),
        content: resolve(__dirname, 'src/content.ts'), // Will be intercepted by plugin
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
    chromeExtensionContentScript(),
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
          dest: 'components/toggle-switch',
        },
      ],
    }),
  ],
  resolve: {
    extensions: ['.ts', '.js'],
  },
});
