# Slack-Bitbucket Merge Control Chrome Extension

This is a Chrome extension designed to read messages from specified Slack channels (both public and private) and control merge button availability on Bitbucket pull request pages. The extension popup displays the current merge status and the latest matching message that determined the merge control decision.

**🎉 Fully migrated to TypeScript!** This project has been successfully migrated from JavaScript to TypeScript, providing better type safety, improved development experience, and enhanced code maintainability.

## Features

- Reads messages from a configurable Slack channel.
- Supports both public and private channels.
- Receives messages in real-time via Slack Socket Mode.
- Displays the current merge status and latest matching message in the extension popup.
- **Bitbucket Integration:** Controls the merge button on Bitbucket pull request pages based on keywords in Slack messages.
- **TypeScript Support:** Full type safety and enhanced development experience.
- **Web Components:** Custom elements for UI components.
- **Comprehensive Testing:** High test coverage with Vitest.

## Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/JorgeRojo/slack-bitbucket-merge-control-chrome-extension.git
   cd slack-bitbucket-merge-control-chrome-extension
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Build the extension:**

   ```bash
   npm run build
   ```

4. **Load in Chrome:**
   - Open Chrome and navigate to `chrome://extensions`.
   - Enable **Developer mode** (toggle switch in the top right).
   - Click on **Load unpacked**.
   - Select the `dist` directory within the project folder.

## Usage

For detailed configuration instructions and usage information, please refer to the built-in help page in the extension:

1. After installing the extension, right-click on the extension icon in your Chrome toolbar
2. Select **Options** from the menu
3. Click on the **View Configuration & Usage Help** link at the top of the page

The help page provides comprehensive instructions for:

- Setting up your Slack App
- Configuring the Chrome Extension
- Using the extension with Bitbucket
- Understanding the different merge control statuses

## Development

### Key Technologies

- **TypeScript** - For type safety and better development experience
- **Web Components** - For encapsulated, reusable UI components
- **Vite** - For modern, fast bundling
- **Vitest** - For comprehensive testing
- **ESLint & Prettier** - For code quality and consistency
- **Chrome Extension APIs** - For browser integration
- **Slack API** - For real-time message monitoring

### Project Structure

```schema
src/
├── modules/
│   ├── background/         # Background script and utilities
│   ├── common/             # Shared code
│   │   ├── components/     # Web components
│   │   ├── images/         # Extension icons
│   │   ├── styles/         # CSS files
│   │   ├── types/          # TypeScript type definitions
│   │   └── utils/          # Utility functions
│   ├── content/            # Content script for Bitbucket pages
│   ├── options/            # Options and help pages
│   └── popup/              # Popup interface
└── manifest.json           # Extension manifest
```

### Development Guidelines

This project follows specific coding standards and development practices:

- See [CONTRIBUTING.md](./documentation/CONTRIBUTING.md) for contribution guidelines and development workflow
- See [CODE_STYLE.md](./documentation/CODE_STYLE.md) for detailed coding style rules and best practices
- See [RELEASE_PROCESS.md](./documentation/RELEASE_PROCESS.md) for release workflow and Git Flow guidelines

### Available Scripts

- **Building:**
  To build the extension:

  ```bash
  npm run build
  ```

  This uses Vite with a custom Chrome Extension plugin that handles content script compilation automatically.

  To check TypeScript types without compiling:

  ```bash
  npm run type-check
  ```

- **Formatting:**
  To format the code, run:

  ```bash
  npm run format
  ```

- **Linting:**
  To lint the code, run:

  ```bash
  npm run lint
  ```

  To automatically fix linting issues, run:

  ```bash
  npm run lint -- --fix
  ```

- **Testing:**
  To run tests:

  ```bash
  npm run test
  ```

  To run tests with coverage report:

  ```bash
  npm run test:coverage
  ```

- **Husky Setup:**
  To set up Git hooks with Husky (automatically run during install):

  ```bash
  npm run prepare
  ```

## Documentation

All project documentation is organized in the `documentation/` directory:

- **[CONTRIBUTING.md](./documentation/CONTRIBUTING.md)** - Contribution guidelines and development workflow
- **[CODE_STYLE.md](./documentation/CODE_STYLE.md)** - Detailed coding style rules and best practices
- **[RELEASE_PROCESS.md](./documentation/RELEASE_PROCESS.md)** - Complete release process and Git Flow documentation
- **[TESTING_GUIDELINES.md](./documentation/TESTING_GUIDELINES.md)** - Testing strategies and guidelines including mocking patterns
- **[ISSUES_TRACKING.md](./documentation/ISSUES_TRACKING.md)** - Index of open bugs and feature requests
