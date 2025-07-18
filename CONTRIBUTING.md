# Contributing to Slack-Bitbucket Merge Control Chrome Extension

Thank you for your interest in contributing to this project! This document outlines the coding standards, development workflow, and best practices to follow when contributing.

## Code Style and Standards

### General Guidelines

- Write clean, readable, and maintainable code
- Follow the Single Responsibility Principle
- Keep functions small and focused
- Use meaningful variable and function names
- Add comments for complex logic, but prefer self-documenting code
- Use English for all code, comments, and documentation

### JavaScript Style

- We use ESLint and Prettier for code formatting and linting
- Run `npm run format` before committing to ensure consistent formatting
- Run `npm run lint` to check for linting issues
- Follow these specific conventions:
  - Use `const` for variables that don't change, `let` otherwise
  - Avoid using `var`
  - Use arrow functions for callbacks
  - Use template literals instead of string concatenation
  - Use destructuring where appropriate
  - Use async/await for asynchronous code
  - Use camelCase for variables and functions
  - Use PascalCase for classes and components
  - Use UPPER_SNAKE_CASE for constants

### CSS Style

- Keep CSS in external files, not inline styles
- Use descriptive class names
- Follow a consistent naming convention (e.g., BEM or similar)
- Group related styles together
- Add comments for complex selectors or rules
- Avoid using `!important` unless absolutely necessary

### HTML Style

- Use semantic HTML elements
- Keep markup clean and minimal
- Use proper indentation
- Include appropriate accessibility attributes

## Development Workflow

### Setting Up the Development Environment

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/slack-bitbucket-merge-control-chrome-extension.git`
3. Install dependencies: `npm install`
4. Load the extension in Chrome as described in the README

### Making Changes

1. Create a new branch for your feature or bugfix: `git checkout -b feature/your-feature-name`
2. Make your changes
3. Run tests: `npm test`
4. Format your code: `npm run format`
5. Check for linting issues: `npm run lint`
6. Commit your changes with a descriptive commit message
7. Push to your fork: `git push origin feature/your-feature-name`
8. Create a Pull Request

### Commit Message Guidelines

- Use the present tense ("Add feature" not "Added feature")
- Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
- Limit the first line to 72 characters or less
- Reference issues and pull requests after the first line
- Consider using a commit message format like:

  ```
  feat: add countdown timer for switch reactivation

  - Implement 5-minute countdown timer
  - Add visual indicator in popup
  - Ensure timer persists across popup reopens

  Fixes #123
  ```

## Testing

- Write tests for new functionality
- Ensure all tests pass before submitting a PR
- Test your changes in different environments (OS, Chrome versions)

## Documentation

- Update README.md if you change functionality
- Document complex functions and components
- Keep inline documentation up to date with code changes

## Pull Request Process

1. Ensure your code follows the style guidelines
2. Update documentation if necessary
3. Include screenshots for UI changes
4. Link any related issues
5. Your PR will be reviewed by maintainers who may request changes
6. Once approved, your PR will be merged

## Code of Conduct

- Be respectful and inclusive in your communications
- Accept constructive criticism gracefully
- Focus on what is best for the community and project
- Show empathy towards other community members

## Questions?

If you have any questions or need clarification on these guidelines, please open an issue or contact the maintainers.
