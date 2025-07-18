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
