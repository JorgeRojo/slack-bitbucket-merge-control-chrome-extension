# Code Style Guide

This document provides detailed coding style guidelines for the Slack-Bitbucket Merge Control Chrome Extension project.

## JavaScript

### Naming Conventions

- **Variables and Functions**: Use camelCase

  ```javascript
  const userName = 'John';
  function getUserData() { ... }
  ```

- **Classes and Components**: Use PascalCase

  ```javascript
  class UserProfile { ... }
  const ToggleSwitch = { ... }
  ```

- **Constants**: Use UPPER_SNAKE_CASE

  ```javascript
  const MAX_RETRY_COUNT = 3;
  const DEFAULT_TIMEOUT = 5000;
  ```

- **Private Properties/Methods**: Prefix with underscore
  ```javascript
  class Example {
    _privateMethod() { ... }
  }
  ```

### Code Structure

- **Imports**: Group and order imports

  ```javascript
  // 1. Built-in modules
  import { useState } from 'react';

  // 2. External libraries
  import { debounce } from 'lodash';

  // 3. Internal modules
  import { constants } from './constants.js';
  ```

### Comments

- **Avoid comments in code**: Use descriptive function and variable names to make code self-documenting
- **Language**: All comments must be written in English, regardless of the primary language used by the development team.
- **Function Length**: Keep functions under 30 lines when possible
- **Nesting**: Avoid nesting more than 3 levels deep
- **Early Returns**: Use early returns to avoid deep nesting

  ```javascript
  // Good
  function example(value) {
    if (!value) return null;
    // rest of function
  }

  // Avoid
  function example(value) {
    if (value) {
      // rest of function
    }
  }
  ```

### Best Practices

- **Use Destructuring**:

  ```javascript
  const { name, age } = user;
  ```

- **Use Spread Operator** for shallow copies:

  ```javascript
  const newArray = [...oldArray];
  const newObject = { ...oldObject };
  ```

- **Template Literals** over string concatenation:

  ```javascript
  // Good
  const greeting = `Hello, ${name}!`;

  // Avoid
  const greeting = 'Hello, ' + name + '!';
  ```

- **Optional Chaining** for nested properties:

  ```javascript
  const userName = user?.profile?.name;
  ```

- **Nullish Coalescing** for defaults:

  ```javascript
  const count = value ?? 0;
  ```

- **Async/Await** over Promise chains:

  ```javascript
  // Good
  async function fetchData() {
    try {
      const response = await fetch(url);
      return await response.json();
    } catch (error) {
      console.error(error);
    }
  }

  // Avoid
  function fetchData() {
    return fetch(url)
      .then((response) => response.json())
      .catch((error) => console.error(error));
  }
  ```

- **Use an object** for functions with more than two parameters:

  ```javascript
  // Good
  function createUser({ name, email, age, role }) {
    // function body
  }

  createUser({
    name: 'John',
    email: 'john@example.com',
    age: 30,
    role: 'admin',
  });

  // Avoid
  function createUser(name, email, age, role) {
    // function body
  }
  ```

## HTML

### Structure

- Use proper indentation (2 spaces)
- Use semantic HTML elements
- Keep nesting minimal
- Use self-closing tags for void elements
  ```html
  <img src="image.jpg" alt="Description" /> <input type="text" />
  ```

### Attributes

- Use double quotes for attribute values
- Avoid comments in HTML
- Boolean attributes should not have values
  ```html
  <input type="text" disabled />
  ```
- Order attributes consistently:
  1. id
  2. class
  3. name
  4. data-\*
  5. src, href, etc.
  6. title, alt
  7. aria-\*, role
  8. event handlers

### Accessibility

- Always include alt text for images
- Use appropriate ARIA attributes
- Ensure proper heading hierarchy
- Use semantic elements over generic divs when possible

## CSS

### Naming Conventions

- Use kebab-case for class names
  ```css
  .user-profile { ... }
  ```
- Use BEM (Block Element Modifier) methodology for complex components
  ```css
  .card { ... }
  .card__title { ... }
  .card--featured { ... }
  ```

### Structure

- Group related properties
- Follow a consistent order of properties:
  1. Positioning (position, top, z-index)
  2. Box model (display, width, padding)
  3. Typography (font, line-height)
  4. Visual (color, background)
  5. Misc (cursor, overflow)
- Use shorthand properties when possible

  ```css
  /* Good */
  margin: 10px 20px;

  /* Avoid when unnecessary */
  margin-top: 10px;
  margin-right: 20px;
  margin-bottom: 10px;
  margin-left: 20px;
  ```

### Best Practices

- Avoid using `!important`
- Avoid comments in CSS
- Use CSS variables for repeated values

  ```css
  :root {
    --primary-color: #4a154b;
  }

  .button {
    background-color: var(--primary-color);
  }
  ```

- Minimize specificity
- Use media queries for responsive design
- Comment complex selectors or rules

## Chrome Extension Specific

### Background Scripts

- Keep background scripts lightweight
- Use message passing for communication
- Handle errors gracefully
- Clean up resources when not needed
- Try to minimize the number of promises by using try-catch structures

### Content Scripts

- Minimize DOM manipulation
- Use event delegation for performance
- Avoid conflicts with page scripts
- Use unique class names to prevent style collisions

### Manifest

- Keep permissions minimal
- Use declarative content when possible
- Version numbers should follow semantic versioning

## Testing

- Write tests for all new functionality
- Test edge cases
- Mock external dependencies
- Keep tests independent of each other
- Don't modify code only for testing purposes, improve the mocks instead
- Don't export functions or variables solely to make them testable
- Aim for 80% code coverage when possible without overly complicating test logic
- Avoid comments in code, leave only short comments in english for complex mocking

### Testing Approach

[Test README](./tests/README.md)

- **Prefer Integration Testing**: Test the behavior of the code through its public interfaces rather than testing internal functions directly.

  ```javascript
  // Good: Test through message passing (integration approach)
  await chrome.runtime.sendMessage({
    action: 'updateContentScriptMergeState',
    channelName: 'test-channel'
  });

  // Avoid: Creating duplicates of internal functions for testing
  const updateContentScriptMergeState = function() { ... };
  await updateContentScriptMergeState('test-channel');
  ```

- **Use Global Chrome API Mocks**: Leverage the global Chrome API mocks defined in the test setup file instead of redefining them in each test file.

  ```javascript
  // Good: Use spies on the global mock
  beforeEach(() => {
    vi.spyOn(chrome.storage.local, 'get').mockImplementation(() => Promise.resolve({...}));
  });

  // Avoid: Redefining the entire chrome object in each test file
  global.chrome = { ... };

  ```

- **Test State Changes**: Focus on testing the resulting state changes rather than implementation details.

  ```javascript
  // Good: Test the resulting state
  expect(chrome.storage.local.set).toHaveBeenCalledWith(
    expect.objectContaining({
      lastKnownMergeState: expect.objectContaining({
        mergeStatus: MERGE_STATUS.ERROR,
      }),
    }),
  );

  // Avoid: Testing implementation details
  expect(someInternalFunction).toHaveBeenCalledWith(...);
  ```

- **Use Realistic Test Data**: Create test data that closely resembles real-world scenarios.

  ```javascript
  const mockMessages = [
    {
      text: 'not allowed to merge today',
      user: 'U12345',
      ts: '1609459200.000100',
    },
  ];
  ```

## Documentation

- Use descriptive function and variable names to make code self-documenting
- Add comments only for complex logic that cannot be easily understood from the code context
- Always add comments for regular expressions explaining their purpose and expected matches
- Always add comments for constants that contain millisecond values, explaining their duration
- Keep README updated with new features

## Version Control

- Make atomic commits (one logical change per commit)
- Write descriptive commit messages
- Reference issue numbers in commits when applicable
