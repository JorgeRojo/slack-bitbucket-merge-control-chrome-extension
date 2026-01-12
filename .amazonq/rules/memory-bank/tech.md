# Technology Stack

## Programming Languages

- **TypeScript 5.4.5**: Primary language for type safety and enhanced development experience
- **JavaScript**: Legacy support and build scripts
- **HTML5**: Extension pages and popup interfaces
- **CSS3**: Styling with custom properties and modern features

## Core Technologies

### Chrome Extension Platform

- **Manifest V3**: Latest Chrome extension specification
- **Service Workers**: Background script execution model
- **Content Scripts**: Page injection and DOM manipulation
- **Chrome APIs**: Storage, alarms, scripting permissions

### Frontend Technologies

- **Web Components**: Custom elements for reusable UI components
- **DOM APIs**: Native browser APIs for UI manipulation
- **CSS Custom Properties**: Modern styling with CSS variables
- **ES6 Modules**: Modern JavaScript module system

### Integration APIs

- **Slack API**: REST API for channel and message management
- **Slack Socket Mode**: Real-time WebSocket connection for live messages
- **Bitbucket DOM**: Content script integration for merge button control

## Build System and Tooling

### Build Tools

- **Vite 7.0.5**: Modern build system and development server
- **esbuild 0.25.8**: Fast JavaScript/TypeScript bundler
- **TypeScript Compiler**: Type checking and compilation
- **vite-plugin-static-copy**: Asset copying for Chrome extension structure

### Development Tools

- **ESLint 9.31.0**: Code linting with TypeScript support
- **Prettier 3.6.2**: Code formatting
- **Husky 9.1.7**: Git hooks for pre-commit quality checks
- **jsdom 26.1.0**: DOM testing environment

### Testing Framework

- **Vitest 3.2.4**: Fast unit testing framework
- **@vitest/coverage-v8**: Code coverage reporting
- **@types/chrome**: TypeScript definitions for Chrome APIs
- **@types/node**: Node.js type definitions

## Development Commands

### Building

```bash
npm run build          # Development build
npm run build:prod     # Production build with optimizations
npm run build:tsc      # TypeScript compilation only
npm run type-check     # Type checking without compilation
npm run clean          # Clean build artifacts
```

### Code Quality

```bash
npm run lint           # ESLint code analysis
npm run lint -- --fix  # Auto-fix linting issues
npm run format         # Prettier code formatting
```

### Testing

```bash
npm run test           # Run all tests
npm run test:coverage  # Run tests with coverage report
```

### Development Workflow

```bash
npm install            # Install dependencies
npm run prepare        # Setup Husky git hooks
```

## Configuration Files

### TypeScript Configuration

- `tsconfig.json` - Main TypeScript configuration
- `tsconfig.eslint.json` - ESLint-specific TypeScript settings
- `jsconfig.json` - JavaScript project configuration

### Build Configuration

- `vite.config.ts` - Vite build configuration with Chrome extension plugin
- `vitest.config.js` - Test runner configuration
- `eslint.config.js` - ESLint rules and parser configuration

### Development Configuration

- `.prettierrc` - Code formatting rules
- `.prettierignore` - Files excluded from formatting
- `.npmrc` - npm configuration
- `.gitignore` - Git ignore patterns

## Dependencies

### Runtime Dependencies

- **None**: Extension runs entirely in browser environment with no external runtime dependencies

### Development Dependencies

- **@typescript-eslint/\***: TypeScript ESLint integration
- **eslint-plugin-\***: ESLint plugins for imports and Prettier integration
- **@types/\***: TypeScript type definitions
- **glob**: File pattern matching for build scripts

## Browser Compatibility

- **Chrome**: Primary target (Manifest V3 support required)
- **Chromium-based browsers**: Edge, Brave, Opera (compatible)
- **Minimum Chrome version**: 88+ (Service Worker support)

## API Integrations

### Slack API Requirements

- **Bot Token**: `xoxb-` prefixed token for API access
- **App Token**: `xapp-` prefixed token for Socket Mode
- **Permissions**: `channels:read`, `groups:read`, `im:read`, `mpim:read`, `files:read`
- **Socket Mode**: Real-time event subscription

### Bitbucket Integration

- **Domain matching**: `*://*.bitbucket.org/*`
- **DOM manipulation**: Content script injection
- **Page detection**: Pull request page identification
- **Button control**: Merge button enable/disable functionality

## Build Modes

### Development Mode

- Source maps enabled
- Verbose logging
- Hot reload support
- Unminified code

### Production Mode

- Code minification
- Tree shaking
- Optimized assets
- Reduced bundle size
