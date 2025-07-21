# Simplified Error Handling System

This document describes how to use the simplified error handling system in the extension using `Logger.error` with `silentMessages` in the context.

## Key Concepts

### Available Error Messages

Error messages that can be silenced are defined in `src/constants.js`:

```javascript
export const ERROR_MESSAGES = {
  RECEIVING_END_NOT_EXIST: 'Receiving end does not exist',
  CONNECTION_FAILED:
    'Could not establish connection. Receiving end does not exist',
  MESSAGE_PORT_CLOSED: 'The message port closed before a response was received',
};
```

### Main Function

```javascript
Logger.error(error, component, context)
```

**Parameters:**
- `error`: The error to handle (Error object or string)
- `component`: Component name (default: 'General')
- `context`: Context object that can include `silentMessages` and other data

**Context with silentMessages:**
```javascript
{
  silentMessages: ['message1', 'message2'], // Array of messages to silence
  otherProperty: 'value',                   // Other context properties
}
```

**Returns:**
```javascript
{
  error: Error,      // The original error
  context: Object,   // The context without silentMessages
  silenced: boolean  // true if the error was silenced
}
```

## Usage Examples

### 1. Silence Specific Errors

```javascript
import { Logger } from './utils/logger.js';
import { ERROR_MESSAGES } from './constants.js';

try {
  await chrome.runtime.sendMessage({ action: 'someAction' });
} catch (error) {
  // Only silence connection errors
  Logger.error(error, 'MyComponent', {
    silentMessages: [
      ERROR_MESSAGES.RECEIVING_END_NOT_EXIST,
      ERROR_MESSAGES.CONNECTION_FAILED,
    ],
  });
}
```

### 2. Silence Multiple Error Types

```javascript
import { Logger } from './utils/logger.js';
import { ERROR_MESSAGES } from './constants.js';

try {
  await chrome.tabs.sendMessage(tabId, message);
} catch (error) {
  // Silence multiple known error types
  Logger.error(error, 'TabMessaging', {
    silentMessages: [
      ERROR_MESSAGES.RECEIVING_END_NOT_EXIST,
      ERROR_MESSAGES.CONNECTION_FAILED,
      ERROR_MESSAGES.MESSAGE_PORT_CLOSED,
    ],
  });
}
```

### 3. Conditional Handling Based on Silencing

```javascript
try {
  await chrome.tabs.sendMessage(bitbucketTabId, message);
} catch (error) {
  const result = Logger.error(error, 'Background', {
    silentMessages: [ERROR_MESSAGES.RECEIVING_END_NOT_EXIST],
  });
  
  // Clean up tabId only if error was silenced
  if (result.silenced) {
    bitbucketTabId = null;
    return;
  }
  
  // If not silenced, do something else
  console.log('Unsilenced error requires attention');
}
```

### 4. Additional Context with Silencing

```javascript
try {
  await someOperation();
} catch (error) {
  Logger.error(error, 'CriticalOperation', {
    silentMessages: [ERROR_MESSAGES.CONNECTION_FAILED],
    userId: '123',
    operation: 'fetchData',
    timestamp: Date.now(),
  });
}
```

### 5. No Error Silencing

```javascript
try {
  await someOperation();
} catch (error) {
  // Log all errors normally (without silentMessages)
  Logger.error(error, 'CriticalOperation', {
    userId: '123',
    operation: 'criticalTask',
  });
}
```

## Common Use Cases

### Background Script - Messages to Popup

When popup is not open, messages fail with connection errors:

```javascript
try {
  await chrome.runtime.sendMessage({
    action: MESSAGE_ACTIONS.UPDATE_MESSAGES,
  });
} catch (error) {
  // Silence connection errors when popup is not open
  Logger.error(error, 'Background', {
    silentMessages: [
      ERROR_MESSAGES.RECEIVING_END_NOT_EXIST,
      ERROR_MESSAGES.CONNECTION_FAILED,
    ],
  });
}
```

### Content Script - Messages to Tabs

When a tab is closed or not available:

```javascript
try {
  await chrome.tabs.sendMessage(tabId, message);
} catch (error) {
  // Silence connection errors when tab is not available
  const result = Logger.error(error, 'TabMessaging', {
    silentMessages: [
      ERROR_MESSAGES.RECEIVING_END_NOT_EXIST,
      ERROR_MESSAGES.CONNECTION_FAILED,
    ],
  });
  
  if (result.silenced) {
    tabId = null; // Clean up invalid tab reference
  }
}
```

### Popup - Handling chrome.runtime.lastError

```javascript
chrome.runtime.sendMessage(message, (response) => {
  if (chrome.runtime.lastError) {
    Logger.error(
      new Error(chrome.runtime.lastError.message),
      'Popup',
      {
        silentMessages: [
          ERROR_MESSAGES.RECEIVING_END_NOT_EXIST,
          ERROR_MESSAGES.MESSAGE_PORT_CLOSED,
        ],
      },
    );
    return;
  }
  // Process response...
});
```

## Adding New Silenceable Messages

1. Add the message to `ERROR_MESSAGES` in `constants.js`:

```javascript
export const ERROR_MESSAGES = {
  RECEIVING_END_NOT_EXIST: 'Receiving end does not exist',
  CONNECTION_FAILED: 'Could not establish connection. Receiving end does not exist',
  MESSAGE_PORT_CLOSED: 'The message port closed before a response was received',
  NEW_ERROR_TYPE: 'New error type', // ← Add here
};
```

2. Use the new message where needed:

```javascript
Logger.error(error, 'Component', {
  silentMessages: [ERROR_MESSAGES.NEW_ERROR_TYPE],
});
```

## Best Practices

1. **Be Specific**: Only silence errors that you really need to silence
2. **Document**: Add comments explaining why certain errors are silenced
3. **Context**: Provide useful context for debugging along with silentMessages
4. **Conditional**: Use the `silenced` return value for conditional logic when needed
5. **Consistency**: Always use `Logger.error` instead of `console.error` directly

## Differences from Previous System

- **Removed**: `handleErrorSilently` function
- **Simplified**: Everything is handled through `Logger.error`
- **Integrated**: `silentMessages` is part of the context
- **Consistent**: Single entry point for error handling

## Testing

```javascript
test('should handle errors with silentMessages', () => {
  expect(() => {
    Logger.error(new Error('test error'), 'TestComponent', {
      silentMessages: ['test error'],
      otherContext: 'value',
    });
  }).not.toThrow();
});
```
