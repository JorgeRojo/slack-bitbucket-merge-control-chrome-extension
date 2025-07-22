const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Ensure dist directory exists
if (!fs.existsSync('dist')) {
  fs.mkdirSync('dist');
}

// Compile TypeScript
console.log('Compiling TypeScript...');
try {
  execSync('npx tsc', { stdio: 'inherit' });
  console.log('TypeScript compilation successful!');
} catch (error) {
  console.error('TypeScript compilation failed:', error);
  process.exit(1);
}

// Copy static files
console.log('Copying static files...');
const staticFiles = [
  { from: 'src/manifest.json', to: 'dist/manifest.json' },
  { from: 'src/popup.html', to: 'dist/popup.html' },
  { from: 'src/options.html', to: 'dist/options.html' },
  { from: 'src/help.html', to: 'dist/help.html' },
  { from: 'src/images', to: 'dist/images' },
  { from: 'src/styles', to: 'dist/styles' },
  {
    from: 'src/components/toggle-switch/toggle-switch.css',
    to: 'dist/components/toggle-switch/toggle-switch.css',
  },
];

staticFiles.forEach(({ from, to }) => {
  const fromPath = path.resolve(from);
  const toPath = path.resolve(to);

  if (!fs.existsSync(fromPath)) {
    console.warn(`Warning: ${fromPath} does not exist, skipping...`);
    return;
  }

  if (fs.lstatSync(fromPath).isDirectory()) {
    // Copy directory
    if (!fs.existsSync(toPath)) {
      fs.mkdirSync(toPath, { recursive: true });
    }

    const files = fs.readdirSync(fromPath);
    files.forEach(file => {
      const srcFile = path.join(fromPath, file);
      const destFile = path.join(toPath, file);

      if (fs.lstatSync(srcFile).isDirectory()) {
        console.warn(`Warning: Nested directories not supported (${srcFile}), skipping...`);
      } else {
        fs.copyFileSync(srcFile, destFile);
      }
    });
  } else {
    // Copy file
    const toDir = path.dirname(toPath);
    if (!fs.existsSync(toDir)) {
      fs.mkdirSync(toDir, { recursive: true });
    }
    fs.copyFileSync(fromPath, toPath);
  }
});

console.log('Build completed successfully!');
