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

The build system includes a custom Vite plugin (`chromeExtensionContentScript`) that:

1. **Intercepts** the content script during Vite's bundle generation
2. **Removes** content.js from Vite's ES module bundle
3. **Rebuilds** content script separately using esbuild with IIFE format
4. **Ensures** Chrome Extension compatibility for content scripts

### Build Process Flow

```
npm run build
    ↓
Vite Build Process
    ↓
Plugin Intercepts content.ts
    ↓
Vite builds: background, popup, options, help (ES modules)
    ↓
Plugin builds: content.js (IIFE format with esbuild)
    ↓
Static files copied
    ↓
Build Complete
```

## Build Scripts

### `npm run build`

Main build command using Vite with custom Chrome Extension plugin:

- Uses **Vite** to bundle background, popup, options, help scripts with modern optimizations
- **Custom plugin** intercepts and rebuilds content script as IIFE using esbuild
- Copies all static files (HTML, CSS, images, manifest.json) to dist directory
- Generates optimized bundles with source maps and compression analysis
- Provides detailed build summary with file sizes and performance metrics
- **Single command** handles entire build process

### `npm run clean`
- May not be Chrome Extension compatible for content scripts (uses ES modules)
- Useful for development, testing, and analyzing bundle composition
- Generates detailed chunk analysis and dependency graphs

### `npm run clean`

Removes the `dist/` directory completely.

### `npm run type-check`

Runs TypeScript compiler in check-only mode (no output files):

- Useful for checking types without building
- Shows all TypeScript errors without stopping the build

### `npm run build:tsc`

Uses the standard TypeScript compiler directly:

- More strict than our custom build script
- Will fail if any TypeScript errors exist

## Build Output

The build process creates a `dist/` directory with the following structure:

```
dist/
├── background.js           # Main background script
├── content.js             # Content script for Bitbucket pages
├── popup.js               # Popup interface
├── options.js             # Options page
├── manifest.json          # Chrome extension manifest
├── components/            # UI components
├── utils/                 # Utility functions
├── types/                 # TypeScript type definitions (compiled)
├── styles/                # CSS files
└── images/                # Extension icons
```

## TypeScript Migration Status

The project is in active TypeScript migration. Current status:

### ✅ Fully Migrated

- Type definitions (`types/`)
- Utility functions (most of `utils/`)
- UI components (`components/`)
- Constants and literals

### 🔄 Partially Migrated

- Background script (TypeScript exists, but has type errors)
- Content script (TypeScript exists, but has type errors)
- Popup script (TypeScript exists, but has type errors)

### 📋 Using JavaScript Fallbacks

When TypeScript compilation fails, the build system automatically uses the JavaScript version as a fallback, ensuring the extension continues to work during the migration process.

## Development Workflow

1. **Start development mode:**

   ```bash
   npm run dev
   ```

   This compiles TypeScript and copies static files to the `dist/` directory.

2. **Make changes to TypeScript files:**
   - Edit `.ts` files in the `src/` directory
   - Run `npm run build` to rebuild after changes
   - Check the console for compilation status

3. **Test the extension:**
   - Load the `dist/` directory as an unpacked extension in Chrome
   - The extension will use compiled TypeScript where possible, JavaScript fallbacks otherwise

4. **Check types:**
   ```bash
   npm run type-check
   ```
   This shows TypeScript errors without affecting the build.

## Troubleshooting

### Build Fails Completely

- Check that Node.js and npm are installed
- Run `npm install` to ensure dependencies are installed
- Try `npm run clean && npm run build`

### TypeScript Compilation Errors

- The build system is designed to continue working even with TypeScript errors
- JavaScript fallbacks are used automatically
- Use `npm run type-check` to see all TypeScript issues
- Fix TypeScript errors gradually without breaking the extension

### Extension Not Loading

- Ensure the `dist/` directory exists and contains `manifest.json`
- Check Chrome's extension management page for error messages
- Verify that all required files are present in `dist/`

## Future Improvements

1. **Complete TypeScript Migration**: Fix remaining type errors to enable full TypeScript compilation
2. **Source Maps**: Enable source maps for better debugging
3. **Minification**: Add minification for production builds
4. **Bundle Analysis**: Add tools to analyze bundle size and dependencies
