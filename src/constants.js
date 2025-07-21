const SLACK_API_BASE_URL = 'https://slack.com/api';

export const SLACK_CONVERSATIONS_LIST_URL = `${SLACK_API_BASE_URL}/conversations.list`;
export const SLACK_CONVERSATIONS_HISTORY_URL = `${SLACK_API_BASE_URL}/conversations.history`;

export const SLACK_USERS_LIST_URL = `${SLACK_API_BASE_URL}/users.list`;

export const SLACK_AUTH_TEST_URL = `${SLACK_API_BASE_URL}/auth.test`;
export const SLACK_CONNECTIONS_OPEN_URL = `${SLACK_API_BASE_URL}/apps.connections.open`;

export const MAX_MESSAGES = 50;

export const DEFAULT_ALLOWED_PHRASES = [
  'allowed to merge',
  'no restrictions on merging.',
];

export const DEFAULT_DISALLOWED_PHRASES = [
  'not allowed to merge',
  'do not merge without consent',
  'closing versions. do not merge',
  'ask me before merging',
];

export const DEFAULT_EXCEPTION_PHRASES = [
  'allowed to merge this task',
  'except everything related to',
  'allowed to merge in all projects except',
  'merge is allowed except',
  'do not merge these projects',
  'you can merge:',
  'do not merge in',
];

export const DEFAULT_MERGE_BUTTON_SELECTOR =
  '.merge-button-container > .merge-button';

export const DEFAULT_BITBUCKET_URL =
  'https://bitbucket.my-company.com/projects/*/repos/*/pull-requests/*/overview*';

export const DEFAULT_CHANNEL_NAME = 'frontend-closure';

export const SLACK_BASE_URL = 'https://app.slack.com/client/';

export const FEATURE_REACTIVATION_TIMEOUT = 1 * 60 * 1000; // 1 minute in milliseconds

export const APP_STATUS = {
  OK: 'ok',
  UNKNOWN_ERROR: 'unknown_error',
  TOKEN_ERROR: 'token_error',
  CONFIG_ERROR: 'config_error',
  WEB_SOCKET_ERROR: 'web_socket_error',
  CHANNEL_NOT_FOUND: 'channel_not_found',
};

export const MERGE_STATUS = {
  UNKNOWN: 'unknown',
  ALLOWED: 'allowed',
  DISALLOWED: 'disallowed',
  EXCEPTION: 'exception',
  LOADING: 'loading',
  ERROR: 'error',
  CONFIG_NEEDED: 'config_needed',
};

export const RECONNECTION_DELAY_MS = 5000; // 5 seconds
export const WEBSOCKET_CHECK_INTERVAL = 2; // 2 minutes
export const WEBSOCKET_CHECK_ALARM = 'checkWebSocketConnection';
export const WEBSOCKET_MAX_AGE = 30 * 60 * 1000; // 30 minutes in milliseconds

export const MESSAGE_ACTIONS = {
  GET_DEFAULT_PHRASES: 'getDefaultPhrases',
  FETCH_NEW_MESSAGES: 'fetchNewMessages',
  RECONNECT_SLACK: 'reconnectSlack',
  BITBUCKET_TAB_LOADED: 'bitbucketTabLoaded',
  FEATURE_TOGGLE_CHANGED: 'featureToggleChanged',
  GET_COUNTDOWN_STATUS: 'getCountdownStatus',
  COUNTDOWN_COMPLETED: 'countdownCompleted',
  UPDATE_MESSAGES: 'updateMessages',
  UPDATE_MERGE_BUTTON: 'updateMergeButton',
  CHANNEL_CHANGE_ERROR: 'channelChangeError',
  UPDATE_COUNTDOWN_DISPLAY: 'updateCountdownDisplay',
};

// Console error messages for debugging and logging (not shown to users)
export const CONSOLE_ERROR_MESSAGES = {
  // Chrome extension connection errors (silenceable)
  RECEIVING_END_NOT_EXIST: 'Receiving end does not exist',
  CONNECTION_FAILED:
    'Could not establish connection. Receiving end does not exist',
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

// User-facing error messages (shown in UI)
export const USER_ERROR_MESSAGES = {
  // General status messages
  ERROR_PROCESSING_MESSAGES: 'Error processing messages',
  CHANNEL_NOT_FOUND: 'Channel not found or bot is not in channel',
  CONFIG_NEEDED: 'Slack token or channel name not configured',
  COULD_NOT_DETERMINE_STATUS: 'Could not determine status',

  // Configuration errors
  SLACK_TOKEN_MISSING:
    'Slack Bot Token is missing. Please add it in the options page',
  APP_TOKEN_MISSING:
    'Slack App Token is missing. Please add it in the options page',
  CHANNEL_NAME_MISSING:
    'Channel name is missing. Please add it in the options page',
  CONFIGURATION_INCOMPLETE:
    'Configuration is incomplete. Please check all required fields in the options page',

  // Options page errors
  FILL_ALL_FIELDS: 'Please fill in all fields',
};

// Legacy alias for backward compatibility (will be deprecated)
export const ERROR_MESSAGES = CONSOLE_ERROR_MESSAGES;
