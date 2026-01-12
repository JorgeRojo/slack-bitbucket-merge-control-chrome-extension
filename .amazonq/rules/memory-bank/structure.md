# Project Structure

## Directory Organization

### Root Structure

```
slack-bitbucket-merge-control-chrome-extension/
├── src/                    # Source code
├── tests/                  # Test files (mirrors src structure)
├── documentation/          # Project documentation
├── .github/               # GitHub workflows and templates
├── .amazonq/              # Amazon Q configuration and rules
├── .husky/                # Git hooks configuration
├── coverage/              # Test coverage reports
└── temp/                  # Temporary files
```

### Source Code Architecture (`src/`)

```
src/
├── modules/
│   ├── background/        # Background service worker
│   ├── common/           # Shared components and utilities
│   ├── content/          # Content script for Bitbucket pages
│   ├── options/          # Extension options/settings pages
│   └── popup/            # Extension popup interface
└── manifest.json         # Chrome extension manifest
```

## Core Components

### Background Module (`src/modules/background/`)

**Purpose**: Service worker handling Slack integration and state management

**Key Components**:

- `background.ts` - Main service worker entry point
- `app-state/` - Application state management
- `slack/` - Slack API integration (WebSocket, Canvas, Messages)
- `bitbucket/` - Bitbucket integration logic
- `message-analysis/` - Message parsing and keyword detection
- `websocket/` - Real-time Slack connection management
- `countdown/` - Timer functionality for merge controls

### Common Module (`src/modules/common/`)

**Purpose**: Shared code across all extension contexts

**Key Components**:

- `components/` - Web Components (nav-links, toggle-switch)
- `types/` - TypeScript type definitions (app.ts, chrome.ts, slack.ts)
- `utils/` - Utility functions (Logger, errorHandler, type-helpers)
- `styles/` - CSS files (base.css, popup.css, variables.css)
- `images/` - Extension icons in various states and sizes
- `constants.ts` - Application constants
- `literals.ts` - String literals and messages

### Content Module (`src/modules/content/`)

**Purpose**: Injected script for Bitbucket page manipulation

**Key Components**:

- `content.ts` - Main content script for merge button control

### Options Module (`src/modules/options/`)

**Purpose**: Extension configuration interface

**Key Components**:

- `options.html/ts` - Main settings page
- `help.html/ts` - Comprehensive help documentation

### Popup Module (`src/modules/popup/`)

**Purpose**: Extension popup interface

**Key Components**:

- `popup.html/ts` - Main popup interface
- `popup-toggle-feature-status.ts` - Feature toggle functionality

## Architectural Patterns

### Chrome Extension Architecture

- **Service Worker Pattern**: Background script as service worker for Manifest V3
- **Content Script Injection**: Bitbucket page manipulation through content scripts
- **Message Passing**: Communication between background, content, and popup contexts
- **Storage API**: Persistent configuration and state management

### Component Architecture

- **Web Components**: Custom elements for reusable UI components
- **Module System**: ES6 modules with TypeScript for type safety
- **Separation of Concerns**: Clear boundaries between UI, business logic, and integration layers

### Integration Patterns

- **WebSocket Integration**: Real-time Slack message monitoring
- **REST API Integration**: Slack API for configuration and message retrieval
- **DOM Manipulation**: Content script for Bitbucket UI modification
- **Event-Driven Architecture**: Message-based communication between components

## Test Structure (`tests/`)

**Organization**: Mirrors source structure exactly for easy navigation

- Each source file has corresponding `.test.ts` file
- Comprehensive coverage including unit and integration tests
- Mock implementations for Chrome APIs and external services

## Documentation Structure (`documentation/`)

- `CONTRIBUTING.md` - Development workflow and contribution guidelines
- `CODE_STYLE.md` - Coding standards and style rules
- `RELEASE_PROCESS.md` - Release workflow and Git Flow
- `TESTING_GUIDELINES.md` - Testing strategies and patterns
- `BUILD_MODES.md` - Development vs production build configurations
- `ISSUES_TRACKING.md` - Bug and feature request tracking

## Build and Development Infrastructure

- **Vite**: Modern build system with TypeScript support
- **ESLint + Prettier**: Code quality and formatting
- **Husky**: Git hooks for pre-commit quality checks
- **Vitest**: Testing framework with coverage reporting
- **GitHub Actions**: CI/CD workflows for quality checks and releases
