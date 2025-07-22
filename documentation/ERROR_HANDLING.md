# Simplified Error Handling System

This document describes how to use the simplified error handling system in the extension using `Logger.error` with `silentMessages` in the context.

## Key Concepts

### Available Error Messages

Error messages are now separated into two categories in `src/constants.js`:

#### Console Error Messages (for debugging and logging)

```javascript
export const ERROR_MESSAGES = {
  // Chrome extension connection errors (silenceable)
  RECEIVING_END_NOT_EXIST: 'Receiving end does not exist',
  CONNECTION_FAILED: 'Could not establish connection. Receiving end does not exist',
  MESSAGE_PORT_CLOSED: 'The message port closed before a response was received',

  // Slack API errors (internal)
  CHANNEL_NOT_FOUND: 'channel_not_found',
  NOT_IN_CHANNEL: 'not_in_channel',
  INVALID_AUTH: 'invalid_auth',
  TOKEN_REVOKED: 'token_revoked',

  // WebSocket and connection errors
  ERROR_SENDING_PING: 'Error sending ping',
  ERROR_FETCHING_MESSAGES: 'Error fetching messages',

  // Error handler errors
  ERROR_IN_CALLBACK: 'Error in error handler callback',
};
```

#### User Error Messages (for UI display)

```javascript
export const USER_ERROR_MESSAGES = {
  // General status messages
  ERROR_PROCESSING_MESSAGES: 'Error processing messages',
  CHANNEL_NOT_FOUND: 'Channel not found or bot is not in channel',
  CONFIG_NEEDED: 'Slack token or channel name not configured',
  COULD_NOT_DETERMINE_STATUS: 'Could not determine status',

  // Configuration errors
  SLACK_TOKEN_MISSING: 'Slack Bot Token is missing. Please add it in the options page',
  APP_TOKEN_MISSING: 'Slack App Token is missing. Please add it in the options page',
  CHANNEL_NAME_MISSING: 'Channel name is missing. Please add it in the options page',
  CONFIGURATION_INCOMPLETE:
    'Configuration is incomplete. Please check all required fields in the options page',

  // Options page errors
  FILL_ALL_FIELDS: 'Please fill in all fields',
};
```

### Main Function

```javascript
Logger.error(error, component, context);
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

### 1. Silence Console Errors (Connection Issues)

```javascript
import { Logger } from './utils/logger.js';
import { CONSOLE_ERROR_MESSAGES } from './constants.js';

try {
  await chrome.runtime.sendMessage({ action: 'someAction' });
} catch (error) {
  // Only silence connection errors (console-level)
  Logger.error(error, 'MyComponent', {
    silentMessages: [
      CONSOLE_ERROR_MESSAGES.RECEIVING_END_NOT_EXIST,
      CONSOLE_ERROR_MESSAGES.CONNECTION_FAILED,
    ],
  });
}
```

### 2. Display User-Friendly Error Messages

```javascript
import { USER_ERROR_MESSAGES } from './constants.js';

function displayError(errorType) {
  const errorMessage = USER_ERROR_MESSAGES[errorType];
  document.getElementById('error-display').textContent = errorMessage;
}

// Usage
displayError('CHANNEL_NOT_FOUND'); // Shows: "Channel not found or bot is not in channel"
```

### 3. Silence Multiple Console Error Types

```javascript
import { Logger } from './utils/logger.js';
import { CONSOLE_ERROR_MESSAGES } from './constants.js';

try {
  await chrome.tabs.sendMessage(tabId, message);
} catch (error) {
  // Silence multiple known console error types
  Logger.error(error, 'TabMessaging', {
    silentMessages: [
      CONSOLE_ERROR_MESSAGES.RECEIVING_END_NOT_EXIST,
      CONSOLE_ERROR_MESSAGES.CONNECTION_FAILED,
      CONSOLE_ERROR_MESSAGES.MESSAGE_PORT_CLOSED,
    ],
  });
}
```

### 4. Conditional Handling Based on Silencing

```javascript
import { CONSOLE_ERROR_MESSAGES } from './constants.js';

try {
  await chrome.tabs.sendMessage(bitbucketTabId, message);
} catch (error) {
  const result = Logger.error(error, 'Background', {
    silentMessages: [CONSOLE_ERROR_MESSAGES.RECEIVING_END_NOT_EXIST],
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

### 5. Mixed Usage - Console and User Messages

```javascript
import { CONSOLE_ERROR_MESSAGES, USER_ERROR_MESSAGES } from './constants.js';

try {
  await fetchSlackData();
} catch (error) {
  // Log console error (potentially silenced)
  Logger.error(error, 'SlackAPI', {
    silentMessages: [CONSOLE_ERROR_MESSAGES.INVALID_AUTH],
    userId: '123',
    operation: 'fetchData',
  });

  // Show user-friendly message in UI
  showUserError(USER_ERROR_MESSAGES.CONFIG_NEEDED);
}
```

## Common Use Cases

### Background Script - Messages to Popup

When popup is not open, messages fail with connection errors:

```javascript
import { CONSOLE_ERROR_MESSAGES } from './constants.js';

try {
  await chrome.runtime.sendMessage({
    action: MESSAGE_ACTIONS.UPDATE_MESSAGES,
  });
} catch (error) {
  // Silence console connection errors when popup is not open
  Logger.error(error, 'Background', {
    silentMessages: [
      CONSOLE_ERROR_MESSAGES.RECEIVING_END_NOT_EXIST,
      CONSOLE_ERROR_MESSAGES.CONNECTION_FAILED,
    ],
  });
}
```

### Content Script - Messages to Tabs

When a tab is closed or not available:

```javascript
import { CONSOLE_ERROR_MESSAGES } from './constants.js';

try {
  await chrome.tabs.sendMessage(tabId, message);
} catch (error) {
  // Silence console connection errors when tab is not available
  const result = Logger.error(error, 'TabMessaging', {
    silentMessages: [
      CONSOLE_ERROR_MESSAGES.RECEIVING_END_NOT_EXIST,
      CONSOLE_ERROR_MESSAGES.CONNECTION_FAILED,
    ],
  });

  if (result.silenced) {
    tabId = null; // Clean up invalid tab reference
  }
}
```

### Popup - User Interface Error Display

```javascript
import { USER_ERROR_MESSAGES } from './constants.js';

function updateUI(appStatus) {
  const statusElement = document.getElementById('status');

  switch (appStatus) {
    case 'CHANNEL_NOT_FOUND':
      statusElement.textContent = USER_ERROR_MESSAGES.CHANNEL_NOT_FOUND;
      break;
    case 'CONFIG_ERROR':
      statusElement.textContent = USER_ERROR_MESSAGES.CONFIG_NEEDED;
      break;
    default:
      statusElement.textContent = USER_ERROR_MESSAGES.COULD_NOT_DETERMINE_STATUS;
  }
}
```

## Adding New Error Messages

### For Console Errors (debugging/logging):

1. Add to `CONSOLE_ERROR_MESSAGES` in `constants.js`:

```javascript
export const CONSOLE_ERROR_MESSAGES = {
  // ... existing messages
  NEW_CONSOLE_ERROR: 'New console error message',
};
```

2. Use in code for logging/silencing:

```javascript
Logger.error(error, 'Component', {
  silentMessages: [CONSOLE_ERROR_MESSAGES.NEW_CONSOLE_ERROR],
});
```

### For User-Facing Errors (UI display):

1. Add to `USER_ERROR_MESSAGES` in `constants.js`:

```javascript
export const USER_ERROR_MESSAGES = {
  // ... existing messages
  NEW_USER_ERROR: 'User-friendly error message',
};
```

2. Use in UI components:

```javascript
import { USER_ERROR_MESSAGES } from './constants.js';
errorElement.textContent = USER_ERROR_MESSAGES.NEW_USER_ERROR;
```

## Best Practices

1. **Separate Concerns**: Use `CONSOLE_ERROR_MESSAGES` for debugging/logging, `USER_ERROR_MESSAGES` for UI
2. **Be Specific**: Only silence console errors that you really need to silence
3. **User-Friendly**: Always use clear, actionable messages for users
4. **Document**: Add comments explaining why certain console errors are silenced
5. **Context**: Provide useful context for debugging along with silentMessages
6. **Consistency**: Always use the appropriate constant instead of hardcoded strings

## Differences from Previous System

- **Separated**: Console errors and user-facing errors are now in different constants
- **Clearer Intent**: It's obvious which messages are for debugging vs user display
- **Better Organization**: Related error messages are grouped together
- **Backward Compatible**: Legacy `ERROR_MESSAGES` alias still works

## Testing

```javascript
import { CONSOLE_ERROR_MESSAGES, USER_ERROR_MESSAGES } from '../src/constants.js';

test('should handle console errors with silentMessages', () => {
  expect(() => {
    Logger.error(new Error('test error'), 'TestComponent', {
      silentMessages: [CONSOLE_ERROR_MESSAGES.CONNECTION_FAILED],
      otherContext: 'value',
    });
  }).not.toThrow();
});

test('should display user-friendly error messages', () => {
  const errorMessage = USER_ERROR_MESSAGES.CHANNEL_NOT_FOUND;
  expect(errorMessage).toBe('Channel not found or bot is not in channel');
});
```
