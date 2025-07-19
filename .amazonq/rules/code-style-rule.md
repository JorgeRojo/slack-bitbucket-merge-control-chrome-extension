# Project Guidelines for Code Generation

When making any code changes or suggestions, always follow these project guidelines:

## Code Style Guidelines (from CODE_STYLE.md)

1. Follow JavaScript naming conventions:
   - camelCase for variables and functions
   - PascalCase for classes and components
   - UPPER_SNAKE_CASE for constants
   - Prefix private properties/methods with underscore

2. Follow code structure guidelines:
   - Group and order imports properly
   - Keep functions under 30 lines when possible
   - Avoid nesting more than 3 levels deep
   - Use early returns to avoid deep nesting

3. Apply best practices:
   - Use destructuring
   - Use spread operator for shallow copies
   - Use template literals over string concatenation
   - Use optional chaining for nested properties
   - Use nullish coalescing for defaults
   - Prefer async/await over Promise chains
   - Use objects for functions with more than two parameters

4. Follow HTML and CSS conventions as specified in CODE_STYLE.md

5. Follow Chrome Extension specific guidelines for background scripts, content scripts, and manifest

## General Guidelines (from CONTRIBUTING.md)

- Write clean, readable, and maintainable code
- Follow the Single Responsibility Principle
- Keep functions small and focused
- Use meaningful variable and function names
- Add comments for complex logic, but prefer self-documenting code
- Use English for all code, comments, and documentation
- Use `const` for variables that don't change, `let` otherwise
- Avoid using `var`
- Use arrow functions for callbacks

## Testing Guidelines

- Write tests for new functionality
- Ensure all tests pass
- Test in different environments when applicable
- Don't export functions or variables solely to make them testable
- Aim for 80% code coverage when possible without overly complicating test logic

## Documentation Guidelines

- Update documentation when changing functionality
- Document complex functions and components
- Keep inline documentation up to date with code changes

Always check your suggestions against these guidelines before providing them.

## Maintenance Note

Whenever changes are made to CODE_STYLE.md or CONTRIBUTING.md, those same changes should be reflected in this rules file to ensure Amazon Q follows the most current project guidelines.
