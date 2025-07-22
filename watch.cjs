const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');

// Start TypeScript compiler in watch mode
const tsc = spawn('npx', ['tsc', '--watch'], { stdio: 'inherit' });

// Watch for changes in static files
const staticPaths = [
  'src/manifest.json',
  'src/popup.html',
  'src/options.html',
  'src/images/**/*',
  'src/styles/**/*',
];

const copyFile = (source, target) => {
  const targetDir = path.dirname(target);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  fs.copyFileSync(source, target);
  console.log(`Copied: ${source} -> ${target}`);
};

const watcher = chokidar.watch(staticPaths, {
  persistent: true,
  ignoreInitial: false,
});

watcher
  .on('add', filePath => {
    const relativePath = filePath.replace(/^src\//, '');
    const targetPath = path.join('dist', relativePath);
    copyFile(filePath, targetPath);
  })
  .on('change', filePath => {
    const relativePath = filePath.replace(/^src\//, '');
    const targetPath = path.join('dist', relativePath);
    copyFile(filePath, targetPath);
  });

console.log('Watching for changes...');

// Handle process termination
process.on('SIGINT', () => {
  tsc.kill();
  watcher.close();
  process.exit();
});

process.on('SIGTERM', () => {
  tsc.kill();
  watcher.close();
  process.exit();
});
