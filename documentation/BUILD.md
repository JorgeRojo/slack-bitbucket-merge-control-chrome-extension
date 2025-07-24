# Build Process Documentation

This document explains the modern Vite-based build process with custom Chrome Extension plugin.

## Overview

The project uses **Vite with a custom plugin** optimized for Chrome Extensions:

- **Vite** for main application files (background, popup, options, help) with modern bundling
- **Custom Plugin** that intercepts content script and builds it with esbuild in IIFE format
- **Static file copying** for HTML, CSS, images, and manifest.json
- **TypeScript compilation** with full type checking and source maps

## Build Architecture

### Custom Chrome Extension Plugin

The build system includes a custom Vite plugin (`generateIIFEFiles`) that:

1. **Intercepts** the content script during Vite's bundle generation
2. **Removes** unnecessary files from Vite's ES module bundle
3. **Rebuilds** scripts separately using esbuild with IIFE format
4. **Ensures** Chrome Extension compatibility for content scripts and web components

### Build Process Flow

```
npm run build
    ↓
Vite Build Process
    ↓
Plugin Intercepts scripts
    ↓
Vite builds main entries (ES modules)
    ↓
Plugin builds scripts as IIFE format with esbuild
    ↓
Static files copied
    ↓
Build Complete
```

## Build Scripts

### `npm run build`

Main build command using Vite with custom Chrome Extension plugin:

- Uses **Vite** to bundle scripts with modern optimizations
- **Custom plugin** intercepts and rebuilds scripts as IIFE using esbuild
- Copies all static files (HTML, CSS, images, manifest.json) to dist directory
- Generates optimized bundles with source maps

### `npm run type-check`

Runs TypeScript compiler in check-only mode (no output files):

- Useful for checking types without building
- Shows all TypeScript errors without stopping the build

### `npm run clean`

Removes the `dist/` directory completely.

## Build Output

The build process creates a `dist/` directory with the following structure:

```
dist/
├── background.js           # Main background script
├── content.js              # Content script for Bitbucket pages
├── popup.js                # Popup interface
├── options.js              # Options page
├── help.js                 # Help page
├── manifest.json           # Chrome extension manifest
├── popup.html              # Popup HTML
├── options.html            # Options page HTML
├── help.html               # Help page HTML
├── components/             # Web components
│   └── toggle-switch/      # Toggle switch component
│       ├── toggle-switch.js
│       └── toggle-switch.css
├── styles/                 # CSS files
│   ├── base.css
│   ├── pages.css
│   ├── popup.css
│   └── variables.css
└── images/                 # Extension icons
```

## TypeScript Configuration

The project uses TypeScript with the following configuration:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "strict": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": ".",
    "lib": ["DOM", "DOM.Iterable", "ESNext"],
    "allowJs": true,
    "checkJs": false,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "baseUrl": ".",
    "paths": {
      "@src/*": ["src/*"],
      "@tests/*": ["tests/*"]
    }
  },
  "include": ["src/**/*", "tests/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

## Import Aliases

The project uses import aliases for cleaner imports:

```typescript
// Instead of relative paths like:
import { Logger } from '../../../common/utils/Logger';

// We use aliases:
import { Logger } from '@src/modules/common/utils/Logger';
```

## Development Workflow

1. **Make changes to TypeScript files:**
   - Edit `.ts` files in the `src/` directory

2. **Build the extension:**

   ```bash
   npm run build
   ```

3. **Test the extension:**
   - Load the `dist/` directory as an unpacked extension in Chrome

4. **Check types:**
   ```bash
   npm run type-check
   ```

## Testing

Run tests with:

```bash
npm run test
```

Run tests with coverage:

```bash
npm run test:coverage
```

## Troubleshooting

### Build Fails

- Check that Node.js and npm are installed
- Run `npm install` to ensure dependencies are installed
- Try `npm run clean && npm run build`

### TypeScript Errors

- Use `npm run type-check` to see all TypeScript issues
- Fix TypeScript errors before building

### Extension Not Loading

- Ensure the `dist/` directory exists and contains `manifest.json`
- Check Chrome's extension management page for error messages
- Verify that all required files are present in `dist/`
