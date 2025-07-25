# Testing Guidelines

This document provides guidelines for writing tests for the Slack-Bitbucket Merge Control Chrome Extension.

## Using the Global Chrome Mock

The project uses a global Chrome mock defined in `tests/setup.ts` to simulate the Chrome API in tests. This approach provides several benefits:

1. **Consistency**: All tests use the same base mock implementation
2. **Maintainability**: Changes to the Chrome API mock only need to be made in one place
3. **Reduced duplication**: No need to redefine the mock in each test file

### How to Use the Global Chrome Mock

1. **Set up spies on the methods you need to test**:

```typescript
beforeEach(() => {
  vi.clearAllMocks();

  // Set up spies on the global chrome mock
  vi.spyOn(chrome.storage.local, 'get');
  vi.spyOn(chrome.storage.local, 'set');
  vi.spyOn(chrome.storage.sync, 'get');
  vi.spyOn(chrome.runtime, 'sendMessage');
  // Add more spies as needed
});
```

2. **Mock implementations for specific test cases**:

```typescript
chrome.storage.local.get.mockImplementation(keys => {
  if (Array.isArray(keys) && keys.includes('appStatus')) {
    return Promise.resolve({
      appStatus: 'config_error',
    });
  }
  return Promise.resolve({});
});
```

3. **Verify interactions with the Chrome API**:

```typescript
expect(chrome.storage.local.set).toHaveBeenCalledWith(
  expect.objectContaining({
    appStatus: 'web_socket_error',
  })
);
```

### Example

Here's an example from a test file:

```typescript
import { APP_STATUS, MERGE_STATUS } from '@src/modules/common/constants';
import { beforeEach, describe, expect, test, vi } from 'vitest';

describe('App Status Error Handling', () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.spyOn(chrome.storage.local, 'get').mockImplementation(keys => {
      if (Array.isArray(keys) && keys.includes('messages')) {
        return Promise.resolve({
          messages: [],
          appStatus: null,
          featureEnabled: true,
        });
      }
      return Promise.resolve({});
    });

    vi.spyOn(chrome.storage.sync, 'get').mockImplementation(() => {
      return Promise.resolve({
        allowedPhrases: 'allowed to merge',
        disallowedPhrases: 'not allowed to merge',
        exceptionPhrases: 'except',
      });
    });

    vi.spyOn(chrome.storage.local, 'set').mockImplementation(() => Promise.resolve());
    vi.spyOn(chrome.runtime, 'sendMessage').mockImplementation(() => Promise.resolve());
  });

  test('should set merge status to ERROR when app status is UNKNOWN_ERROR', async () => {
    chrome.storage.local.get.mockImplementation(() => {
      return Promise.resolve({
        messages: [],
        appStatus: APP_STATUS.UNKNOWN_ERROR,
        featureEnabled: true,
      });
    });

    await updateContentScriptMergeState('test-channel');

    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      expect.objectContaining({
        lastKnownMergeState: expect.objectContaining({
          mergeStatus: MERGE_STATUS.ERROR,
        }),
      })
    );
  });
});
```

## Test Directory Structure

Tests are organized in directories that mirror the structure of the source code:

```schema
tests/
├── modules/
│   ├── background/         # Tests for background script functionality
│   │   └── utils/          # Tests for background utilities
│   ├── common/             # Tests for shared code
│   │   ├── components/     # Tests for UI components
│   │   └── utils/          # Tests for utility functions
│   ├── content/            # Tests for content script
│   ├── options/            # Tests for options pages
│   └── popup/              # Tests for popup functionality
└── setup.ts                # Test setup and global mocks
```

This organization makes it easier to find and maintain tests related to specific parts of the application.

## TypeScript in Tests

All tests are written in TypeScript, which provides several benefits:

1. **Type safety**: TypeScript helps catch errors at compile time
2. **Better IDE support**: TypeScript provides better autocompletion and documentation
3. **Consistency**: Tests use the same language as the source code

### Import Aliases

Tests use import aliases for cleaner imports:

```typescript
// Instead of relative paths like:
import { Logger } from '../../../src/modules/common/utils/Logger';

// We use aliases:
import { Logger } from '@src/modules/common/utils/Logger';
import { mockRuntime } from '@tests/setup';
```

## Mocking Strategies

This section outlines the mocking strategies used in the Slack-Bitbucket Merge Control Chrome Extension tests.

### Chrome API Mocking

#### Global Chrome Mock

The project uses a global Chrome mock defined in `tests/setup.ts`. This mock simulates the Chrome API and is available in all test files.

```typescript
// Example from tests/setup.ts
export const mockRuntime = {
  getURL: vi.fn(path => `chrome-extension://mock-extension-id${path}`),
  sendMessage: vi.fn(),
  onMessage: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
  },
  openOptionsPage: vi.fn(),
};

global.chrome = {
  runtime: mockRuntime,
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn(),
    },
    sync: {
      get: vi.fn(),
      set: vi.fn(),
    },
  },
  action: {
    setIcon: vi.fn(),
  },
  tabs: {
    query: vi.fn(),
    sendMessage: vi.fn(),
  },
} as unknown as typeof chrome;
```

#### Using the Chrome Mock in Tests

```typescript
import { beforeEach, describe, expect, test, vi } from 'vitest';

describe('Chrome API Interaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Configure mock behavior
    chrome.storage.local.get.mockImplementation(keys => {
      if (keys === 'featureEnabled') {
        return Promise.resolve({ featureEnabled: true });
      }
      return Promise.resolve({});
    });
  });

  test('should store data in local storage', async () => {
    await saveData({ key: 'value' });

    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'value' })
    );
  });
});
```

### Web Components Mocking

#### Shadow DOM Mocking

For testing Web Components with Shadow DOM:

```typescript
describe('ToggleSwitch Component', () => {
  let toggleSwitch: any;
  let mockShadowRoot: any;
  let mockInput: any;

  beforeEach(() => {
    // Create mocks for shadow DOM elements
    mockInput = {
      type: 'checkbox',
      checked: false,
      addEventListener: vi.fn(),
    };

    mockShadowRoot = {
      querySelector: vi.fn(selector => {
        if (selector === 'input') return mockInput;
        return null;
      }),
    };

    toggleSwitch = {
      shadowRoot: mockShadowRoot,
      getAttribute: vi.fn(),
      hasAttribute: vi.fn(),
    };

    document.createElement = vi.fn().mockReturnValue(toggleSwitch);
  });

  test('should initialize with default attributes', () => {
    const component = document.createElement('toggle-switch');
    expect(component.shadowRoot.querySelector('input').checked).toBe(false);
  });
});
```

### DOM API Mocking

#### Document Methods

```typescript
describe('DOM Interaction', () => {
  beforeEach(() => {
    document.getElementById = vi.fn().mockImplementation(id => {
      if (id === 'status-display') {
        return {
          textContent: '',
          style: { display: 'none' },
        };
      }
      return null;
    });

    document.querySelector = vi.fn().mockImplementation(selector => {
      if (selector === '.merge-button') {
        return {
          disabled: false,
          style: {},
        };
      }
      return null;
    });
  });

  test('should update status display', () => {
    updateStatusDisplay('Error message');

    const statusElement = document.getElementById('status-display');
    expect(statusElement.textContent).toBe('Error message');
    expect(statusElement.style.display).toBe('block');
  });
});
```

### Module Mocking

#### Mocking Imported Modules

```typescript
import { Logger } from '@src/modules/common/utils/Logger';
import { beforeEach, describe, expect, test, vi } from 'vitest';

// Mock the Logger module
vi.mock('@src/modules/common/utils/Logger', () => ({
  Logger: {
    log: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should log errors', () => {
    handleError(new Error('Test error'));

    expect(Logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Test error' }),
      'ErrorHandler'
    );
  });
});
```

#### Mocking Dynamic Imports

```typescript
// Mock dynamic import
vi.mock('@src/modules/common/utils/Logger', async () => {
  return {
    Logger: {
      log: vi.fn(),
      error: vi.fn(),
    },
  };
});

// Import the mocked module after mocking
const { Logger } = await import('@src/modules/common/utils/Logger');
```

### Fetch API Mocking

```typescript
describe('API Calls', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: 'mock data' }),
        text: () => Promise.resolve('mock text'),
      })
    );
  });

  test('should fetch data from API', async () => {
    const data = await fetchData('https://api.example.com');

    expect(fetch).toHaveBeenCalledWith('https://api.example.com');
    expect(data).toEqual({ data: 'mock data' });
  });
});
```

### WebSocket Mocking

```typescript
describe('WebSocket Connection', () => {
  let mockWebSocket: any;

  beforeEach(() => {
    mockWebSocket = {
      send: vi.fn(),
      close: vi.fn(),
      addEventListener: vi.fn(),
      readyState: WebSocket.OPEN,
    };

    global.WebSocket = vi.fn().mockImplementation(() => mockWebSocket);
  });

  test('should send message through WebSocket', () => {
    const socket = new WebSocket('wss://example.com');
    socket.send(JSON.stringify({ type: 'ping' }));

    expect(mockWebSocket.send).toHaveBeenCalledWith(JSON.stringify({ type: 'ping' }));
  });
});
```

### Timer Mocking

```typescript
describe('Timer Functions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('should execute callback after timeout', () => {
    const callback = vi.fn();
    setTimeout(callback, 1000);

    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1000);
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
```

## Best Practices

1. **Use descriptive test names**: Test names should clearly describe what is being tested
2. **Isolate tests**: Each test should be independent and not rely on the state of other tests
3. **Mock external dependencies**: Use mocks for external dependencies like the Chrome API
4. **Test edge cases**: Include tests for error conditions and edge cases
5. **Keep tests focused**: Each test should test a single piece of functionality
6. **Use setup and teardown**: Use `beforeEach` and `afterEach` to set up and clean up test state
7. **Avoid testing implementation details**: Test behavior, not implementation details
8. **Avoid conditional statements in tests**: Tests should be deterministic and straightforward. Avoid using if/else statements, ternary operators, or other conditional logic within test cases. If you need different test scenarios, create separate test cases instead.
9. **Avoid trivial assertions**: Never use `expect(true).toBe(true)` or other trivial assertions that always pass. Each assertion should verify something meaningful.
10. **Type your mocks**: Ensure mocks have proper TypeScript types
11. **Reset mocks between tests**: Use `vi.clearAllMocks()` in `beforeEach` to reset mock state
12. **Mock at the appropriate level**: Mock at the boundary of your system, not internal implementation details
13. **Use descriptive mock implementations**: Make mock behavior clear and related to the test case
14. **Avoid complex mock logic**: Keep mock implementations simple and focused on the test case
15. **Verify mock interactions**: Check that mocks were called with the expected arguments
16. **Clean up after tests**: Reset global mocks in `afterEach` or `afterAll` hooks

### Example of avoiding conditionals in tests

Instead of:

```typescript
test('should handle both valid and invalid inputs', () => {
  const validInput = 'valid';
  const invalidInput = '';

  if (validInput) {
    expect(isValid(validInput)).toBe(true);
  }

  if (!invalidInput) {
    expect(isValid(invalidInput)).toBe(false);
  }
});
```

Write separate tests:

```typescript
test('should return true for valid input', () => {
  const validInput = 'valid';
  expect(isValid(validInput)).toBe(true);
});

test('should return false for invalid input', () => {
  const invalidInput = '';
  expect(isValid(invalidInput)).toBe(false);
});
```

### Example of avoiding trivial assertions

Instead of:

```typescript
test('should handle missing handler', () => {
  if (handler) {
    // Test with handler
  } else {
    expect(true).toBe(true); // ❌ Trivial assertion
  }
});
```

Better approach:

```typescript
test('should handle handler when available', () => {
  // Verify handler exists before using it
  expect(handler).toBeDefined();

  // Continue with test only if handler exists
  // ...
});

// Or if the handler might not exist, skip the test
test.runIf(handler)('should process data with handler', () => {
  // Test implementation
});
```

## Running Tests

To run all tests:

```bash
npm test
```

To run tests with coverage:

```bash
npm run test:coverage
```
