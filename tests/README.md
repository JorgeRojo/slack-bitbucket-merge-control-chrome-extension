# Testing Guidelines

This document provides guidelines for writing tests for the Slack-Bitbucket Merge Control Chrome Extension.

## Using the Global Chrome Mock

The project uses a global Chrome mock defined in `tests/setup.js` to simulate the Chrome API in tests. This approach provides several benefits:

1. **Consistency**: All tests use the same base mock implementation
2. **Maintainability**: Changes to the Chrome API mock only need to be made in one place
3. **Reduced duplication**: No need to redefine the mock in each test file

### How to Use the Global Chrome Mock

1. **Set up spies on the methods you need to test**:

```javascript
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

```javascript
chrome.storage.local.get.mockImplementation((keys) => {
  if (Array.isArray(keys) && keys.includes('appStatus')) {
    return Promise.resolve({
      appStatus: 'config_error',
    });
  }
  return Promise.resolve({});
});
```

3. **Verify interactions with the Chrome API**:

```javascript
expect(chrome.storage.local.set).toHaveBeenCalledWith(
  expect.objectContaining({
    appStatus: 'web_socket_error',
  }),
);
```

### Example

Here's an example from `tests/background/background-status-handling.test.js`:

```javascript
describe('App Status Error Handling', () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.spyOn(chrome.storage.local, 'get').mockImplementation((keys) => {
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

    vi.spyOn(chrome.storage.local, 'set').mockImplementation(() =>
      Promise.resolve(),
    );
    vi.spyOn(chrome.runtime, 'sendMessage').mockImplementation(() =>
      Promise.resolve(),
    );
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
      }),
    );
  });
});
```

## Test Directory Structure

Tests are organized in directories that mirror the structure of the source code:

- `tests/background/`: Tests for background script functionality
- `tests/components/`: Tests for UI components
- `tests/popup/`: Tests for popup functionality

This organization makes it easier to find and maintain tests related to specific parts of the application.

## Best Practices

1. **Use descriptive test names**: Test names should clearly describe what is being tested
2. **Isolate tests**: Each test should be independent and not rely on the state of other tests
3. **Mock external dependencies**: Use mocks for external dependencies like the Chrome API
4. **Test edge cases**: Include tests for error conditions and edge cases
5. **Keep tests focused**: Each test should test a single piece of functionality
6. **Use setup and teardown**: Use `beforeEach` and `afterEach` to set up and clean up test state
7. **Avoid testing implementation details**: Test behavior, not implementation details

## Running Tests

To run all tests:

```bash
npm test
```

To run tests with coverage:

```bash
npm run test:coverage
```
