# Slack-Bitbucket Merge Control Chrome Extension

This is a Chrome extension designed to read messages from specified Slack channels (both public and private) and control merge button availability on Bitbucket pull request pages. The extension popup displays the current merge status and the latest matching message that determined the merge control decision.

**🎉 Now fully migrated to TypeScript!** This project has been successfully migrated from JavaScript to TypeScript, providing better type safety, improved development experience, and enhanced code maintainability.

## Features

- Reads messages from a configurable Slack channel.
- Supports both public and private channels.
- Receives messages in real-time via Slack Socket Mode.
- Displays the current merge status and latest matching message in the extension popup.
- **Bitbucket Integration:** Controls the merge button on Bitbucket pull request pages based on keywords in Slack messages.
- **TypeScript Support:** Full type safety and enhanced development experience.

## Code Quality

This project uses [Prettier](https://prettier.io/) for code formatting and [ESLint](https://eslint.org/) for static code analysis.

### Available Scripts

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

## Development Guidelines

This project follows specific coding standards and development practices:

- See [CONTRIBUTING.md](./documentation/CONTRIBUTING.md) for contribution guidelines and development workflow
- See [CODE_STYLE.md](./documentation/CODE_STYLE.md) for detailed coding style rules and best practices

## Documentation

All project documentation is organized in the `documentation/` directory:

- **[CONTRIBUTING.md](./documentation/CONTRIBUTING.md)** - Contribution guidelines and development workflow
- **[CODE_STYLE.md](./documentation/CODE_STYLE.md)** - Detailed coding style rules and best practices
- **[TESTING_GUIDELINES.md](./documentation/TESTING_GUIDELINES.md)** - Testing strategies and guidelines
- **[MOCKING_STRATEGIES.md](./documentation/MOCKING_STRATEGIES.md)** - Mocking patterns and strategies for tests
- **[TYPESCRIPT_MIGRATION.md](./documentation/TYPESCRIPT_MIGRATION.md)** - TypeScript migration status and documentation

## Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/JorgeRojo/slack-frontend-closure.git
   cd slack-frontend-closure
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Load in Chrome:**
   - Open Chrome and navigate to `chrome://extensions`.
   - Enable **Developer mode** (toggle switch in the top right).
   - Click on **Load unpacked**.
   - Select the `slack-frontend-closure` directory.

## Configuration & Usage

For detailed configuration instructions and usage information, please refer to the built-in help page in the extension:

1. After installing the extension, right-click on the extension icon in your Chrome toolbar
2. Select **Options** from the menu
3. Click on the **View Configuration & Usage Help** link at the top of the page

The help page provides comprehensive instructions for:

- Setting up your Slack App
- Configuring the Chrome Extension
- Using the extension with Bitbucket
- Understanding the different merge control statuses

---

_Documentation and UI improvements assisted by [Amazon Q](https://aws.amazon.com/q/)._
