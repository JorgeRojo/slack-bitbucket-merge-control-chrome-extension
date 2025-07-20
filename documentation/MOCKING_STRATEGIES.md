# Test Mocking Strategies

This document explains the different mocking strategies used in the test suite for the Slack-Bitbucket Merge Control Chrome Extension.

## Global Chrome Mock vs. Local Mocks

The project uses two different approaches for mocking the Chrome API in tests:

1. **Global Chrome Mock** (defined in `setup.js`)
2. **Local Mocks** (defined in individual test files)

### Global Chrome Mock

The global Chrome mock is defined in `tests/setup.js` and provides a basic implementation of the Chrome API that can be used across all test files. This approach has several benefits:

- **Consistency**: All tests use the same base mock implementation
- **Maintainability**: Changes to the Chrome API mock only need to be made in one place
- **Reduced duplication**: No need to redefine the mock in each test file

Example of using the global Chrome mock:

```javascript
// In a test file
beforeEach(() => {
  // Set up spies on the global chrome mock
  vi.spyOn(chrome.storage.local, 'get');
  vi.spyOn(chrome.storage.local, 'set');
  vi.spyOn(chrome.runtime, 'sendMessage');
  // ...
});

test('should do something', () => {
  // Use the global chrome mock
  chrome.storage.local.get.mockImplementation(() =>
    Promise.resolve({ key: 'value' }),
  );
  // ...
});
```

### Local Mocks

Some test files define their own local mocks for the Chrome API. This approach is used when:

1. **Special Behavior**: The test requires special behavior from the Chrome API that would be difficult to achieve with the global mock
2. **Complex Interactions**: The test involves complex interactions between different parts of the Chrome API
3. **Historical Reasons**: The test was written before the global mock was established

Example of using a local mock:

```javascript
// In a test file
const mockStorage = {
  local: {
    get: vi.fn(),
    set: vi.fn(),
  },
  // ...
};

global.chrome = {
  storage: mockStorage,
  // ...
};

test('should do something', () => {
  // Use the local mock
  mockStorage.local.get.mockImplementation(() =>
    Promise.resolve({ key: 'value' }),
  );
  // ...
});
```

## Which Files Use Which Strategy

### Files Using Global Chrome Mock

- `tests/popup/popup-error-handling.test.js`
- `tests/background/background-status-handling.test.js`

### Files Using Local Mocks

- `tests/background/background-chrome-api.test.js`
- `tests/background/background-websocket-persistence.test.js`
- `tests/popup/popup.test.js`

## Why Some Files Don't Use the Global Mock

There are several reasons why some test files don't use the global Chrome mock:

1. **Custom Mock Behavior**: Some tests require custom mock behavior that would be difficult to achieve with the global mock. For example, `background-chrome-api.test.js` needs to mock complex interactions between different Chrome API methods.

2. **Test Isolation**: Some tests need to be isolated from changes to the global mock. Using a local mock ensures that changes to the global mock don't affect these tests.

3. **Historical Reasons**: Some tests were written before the global mock was established and have not been updated to use it.

## Future Improvements

In the future, we could consider:

1. **Migrating More Tests**: Gradually migrate more tests to use the global Chrome mock where appropriate
2. **Enhancing the Global Mock**: Add more functionality to the global mock to support more test cases
3. **Documenting Exceptions**: Clearly document cases where a local mock is preferred over the global mock

## Best Practices

When writing new tests:

1. **Prefer Global Mock**: Use the global Chrome mock when possible
2. **Document Exceptions**: If you need to use a local mock, document why
3. **Be Consistent**: Within a single test file, use either the global mock or a local mock, but not both
4. **Use Spies**: Always use spies to track calls to Chrome API methods, regardless of whether you're using the global or local mock
