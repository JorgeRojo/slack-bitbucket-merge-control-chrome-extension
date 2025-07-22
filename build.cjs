const { execSync } = require('child_process');

console.log('Building with Vite...');
try {
  // Build main files with Vite
  execSync('npx vite build', { stdio: 'inherit' });
  console.log('Vite build successful!');
} catch (error) {
  console.error('Vite build failed:', error);
  process.exit(1);
}

console.log('Bundling content script with esbuild...');
try {
  // Bundle content script separately with esbuild (IIFE format for Chrome Extension compatibility)
  execSync(
    'npx esbuild src/content.ts --bundle --outfile=dist/content.js --format=iife --target=es2020 --platform=browser',
    { stdio: 'inherit' }
  );
  console.log('Content script bundled successfully!');
} catch (error) {
  console.error('Content script bundling failed:', error);
  process.exit(1);
}

console.log('Hybrid Vite + esbuild build completed successfully!');
