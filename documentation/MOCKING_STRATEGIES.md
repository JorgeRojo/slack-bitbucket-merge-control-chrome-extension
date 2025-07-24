# Mocking Strategies

This document outlines the mocking strategies used in the Slack-Bitbucket Merge Control Chrome Extension tests.

## Chrome API Mocking

### Global Chrome Mock

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

### Using the Chrome Mock in Tests

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

## Web Components Mocking

### Shadow DOM Mocking

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

## DOM API Mocking

### Document Methods

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

## Module Mocking

### Mocking Imported Modules

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

### Mocking Dynamic Imports

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

## Fetch API Mocking

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

## WebSocket Mocking

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

## Timer Mocking

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

1. **Reset mocks between tests**: Use `vi.clearAllMocks()` in `beforeEach` to reset mock state
2. **Type your mocks**: Use TypeScript types for mocks to catch type errors
3. **Mock at the appropriate level**: Mock at the boundary of your system, not internal implementation details
4. **Use descriptive mock implementations**: Make mock behavior clear and related to the test case
5. **Avoid complex mock logic**: Keep mock implementations simple and focused on the test case
6. **Verify mock interactions**: Check that mocks were called with the expected arguments
7. **Clean up after tests**: Reset global mocks in `afterEach` or `afterAll` hooks
