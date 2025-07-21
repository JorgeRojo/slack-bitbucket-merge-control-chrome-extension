# Error Handling Guidelines

This document outlines the standard approach to error handling in the Slack-Bitbucket Merge Control Chrome Extension.

## Basic Usage

Use the `ErrorHandler` or `Logger` classes to handle errors consistently across the application:

```javascript
import { Logger } from '../utils/logger';

try {
  // Code that might throw an error
} catch (error) {
  Logger.error(error, 'ComponentName', { 
    contextKey: 'contextValue',
    additionalInfo: 'relevant information'
  });
  
  // Additional error recovery logic if needed
}
```

## Error Handler Parameters

The error handler accepts the following parameters:

1. `error` (required): The error object or error message string
2. `component` (optional): The name of the component where the error occurred
3. `context` (optional): An object with additional context information

## Examples

### Basic Error Logging

```javascript
try {
  await fetchData();
} catch (error) {
  Logger.error(error);
}
```

### With Component Information

```javascript
try {
  await connectToSlack();
} catch (error) {
  Logger.error(error, 'SlackConnection');
}
```

### With Context Information

```javascript
try {
  await fetchChannelMessages(channelId);
} catch (error) {
  Logger.error(error, 'MessageFetcher', {
    channelId,
    timestamp: new Date().toISOString(),
    requestType: 'channel_history'
  });
}
```

### With Error Recovery

```javascript
try {
  await sendMessage(message);
} catch (error) {
  Logger.error(error, 'MessageSender', { message });
  
  // Attempt recovery
  if (error.message.includes('rate_limited')) {
    setTimeout(() => retryMessageSend(message), 5000);
  } else {
    showErrorToUser('Failed to send message');
  }
}
```

## Best Practices

1. Always include meaningful component names to identify where errors occur
2. Add relevant context that will help with debugging
3. Handle errors at the appropriate level - don't catch errors too early
4. Consider adding recovery logic for expected error conditions
5. Use consistent error messages across the application
