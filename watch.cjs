#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const srcDir = path.join(__dirname, 'src');

console.log('👀 Watching for changes in src/ directory...');
console.log('Press Ctrl+C to stop watching\n');

// Initial build
console.log('🔨 Initial build...');
try {
  execSync('npm run build', { stdio: 'inherit' });
  console.log('✅ Initial build completed\n');
} catch (error) {
  console.log('❌ Initial build failed\n');
}

// Watch for changes
function watchDirectory(dir) {
  fs.watch(dir, { recursive: true }, (eventType, filename) => {
    if (filename && (filename.endsWith('.ts') || filename.endsWith('.js') || filename.endsWith('.html') || filename.endsWith('.css') || filename.endsWith('.json'))) {
      console.log(`📝 File changed: ${filename}`);
      console.log('🔨 Rebuilding...');
      
      try {
        execSync('npm run build', { stdio: 'pipe' });
        console.log('✅ Build completed');
      } catch (error) {
        console.log('❌ Build failed');
        console.error(error.stdout?.toString() || error.message);
      }
      console.log('');
    }
  });
}

watchDirectory(srcDir);

// Keep the process running
process.on('SIGINT', () => {
  console.log('\n👋 Stopping watch mode...');
  process.exit(0);
});
