const { execSync } = require('child_process');

console.log('🚀 Building Chrome Extension with Vite + esbuild...');

try {
  // Build main files with Vite (background, popup, options, help)
  console.log('📦 Building main scripts with Vite...');
  execSync('npx vite build', { stdio: 'inherit' });

  // Build content script with esbuild (IIFE format for Chrome Extension)
  console.log('🔧 Building content script with esbuild...');
  execSync(
    'npx esbuild src/content.ts --bundle --outfile=dist/content.js --format=iife --target=es2020 --platform=browser --sourcemap',
    { stdio: 'inherit' }
  );

  console.log('✅ Build completed successfully!');
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}
