import { defineConfig, Plugin } from 'vite';
import { resolve } from 'path';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { build } from 'esbuild';
import fs from 'fs/promises';

const entries = {
  background: resolve(__dirname, 'src/modules/background/background.ts'),
  popup: resolve(__dirname, 'src/modules/popup/popup.ts'),
  options: resolve(__dirname, 'src/modules/options/options.ts'),
  help: resolve(__dirname, 'src/modules/options/help.ts'),
  content: resolve(__dirname, 'src/modules/content/content.ts'),
};

function generateIIFEFiles(): Plugin {
  return {
    name: 'generate-iife-files',
    apply: 'build',
    closeBundle: async () => {
      try {
        const files = await fs.readdir(resolve(__dirname, 'dist/assets'));
        for (const file of files) {
          if (file.startsWith('index-') && file.endsWith('.js')) {
            await fs.unlink(resolve(__dirname, 'dist/assets', file));
            console.log(`✅ Removed ${file}`);
          }
        }
      } catch (error) {
        console.error('❌ Error removing unnecessary files:', error);
      }

      for (const [name, entry] of Object.entries(entries)) {
        console.log(`Building ${name} as IIFE...`);

        try {
          await build({
            entryPoints: [entry],
            bundle: true,
            outfile: resolve(__dirname, `dist/${name}.js`),
            format: 'iife',
            target: 'es2020',
            platform: 'browser',
            sourcemap: true,
            minify: false,
          });
          console.log(`✅ ${name}.js built successfully!`);
        } catch (error) {
          console.error(`❌ Error building ${name}:`, error);
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
        index: resolve(__dirname, 'src/manifest.json'),
      },
      output: {
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
  plugins: [
    generateIIFEFiles(),
    viteStaticCopy({
      targets: [
        { src: 'src/manifest.json', dest: '.' },
        { src: 'src/modules/popup/popup.html', dest: '.' },
        { src: 'src/modules/options/options.html', dest: '.' },
        { src: 'src/modules/options/help.html', dest: '.' },
        { src: 'src/modules/common/styles', dest: '.' },
        { src: 'src/modules/common/images', dest: '.' },
        {
          src: 'src/modules/common/components/toggle-switch/toggle-switch.css',
          dest: 'components/toggle-switch',
        },
      ],
    }),
  ],
});
