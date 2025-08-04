# Project Context for slack-bitbucket-merge-control-chrome-extension

This project is a Chrome extension designed for Slack and Bitbucket merge control.

## Key Directories:

- `src/`: Source code for the Chrome extension (background scripts, content scripts, options, popup).
- `tests/`: Unit and integration tests for the project.
- `documentation/`: Project documentation, including code style, contributing guidelines, and release processes.
- `.github/`: GitHub Actions workflows for CI/CD.
- `.husky/`: Git hooks for pre-commit and pre-push checks.

## Technologies Used:

- **Frontend:** TypeScript, JavaScript
- **Build Tool:** Vite
- **Testing:** Vitest
- **Linting/Formatting:** ESLint, Prettier
- **Package Manager:** npm

## Code Style Guidelines (from .amazonq/rules/code-style-rule.md, documentation/CODE_STYLE.md, documentation/CONTRIBUTING.md):

### Naming Conventions:

- `camelCase` for variables and functions.
- `PascalCase` for classes and components.
- `UPPER_SNAKE_CASE` for constants.
- Prefix private properties/methods with an underscore (`_`).

### Code Structure:

- Group and order imports properly.
- Keep functions under 30 lines when possible.
- Avoid nesting more than 3 levels deep; use early returns.

### Best Practices:

- Use destructuring.
- Use spread operator for shallow copies.
- Use template literals over string concatenation.
- Use optional chaining for nested properties.
- Use nullish coalescing for defaults.
- Prefer `async/await` over Promise chains.
- Use objects for functions with more than two parameters.
- Follow the Single Responsibility Principle.
- Keep functions small and focused.
- Use meaningful variable and function names.
- Add comments for complex logic, but prefer self-documenting code.
- Use English for all code, comments, and documentation.
- Use `const` for variables that don't change, `let` otherwise; avoid `var`.
- Use arrow functions for callbacks.

### Testing Guidelines:

- Write tests for new functionality.
- Ensure all tests pass.
- Test in different environments when applicable.
- Don't export functions or variables solely to make them testable.
- Aim for 80% code coverage when possible without overly complicating test logic.

### Documentation Guidelines:

- Update documentation when changing functionality.
- Document complex functions and components.
- Keep inline documentation up to date with code changes.

### Chrome Extension Specific Guidelines:

- Follow conventions for background scripts, content scripts, and manifest.
