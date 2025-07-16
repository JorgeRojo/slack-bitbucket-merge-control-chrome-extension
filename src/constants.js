export const SLACK_CONVERSATIONS_LIST_URL =
  'https://slack.com/api/conversations.list';
export const SLACK_CONVERSATIONS_HISTORY_URL =
  'https://slack.com/api/conversations.history';
export const SLACK_USERS_LIST_URL = 'https://slack.com/api/users.list';

export const POLLING_ALARM_NAME = 'slack-poll-alarm';
export const MAX_MESSAGES = 100;
export const DEFAULT_ALLOWED_PHRASES = [
  ':check1: allowed to merge',
  "it's allowed to merge",
  'merged. no restrictions on merging.',
];
export const DEFAULT_DISALLOWED_PHRASES = [
  ':octagonal_sign: not allowed to merge',
  'not allowed to merge',
  'do not merge without consent',
  'do not merge in',
  'closing versions. do not merge',
  'ask me before merging',
];
export const DEFAULT_EXCEPTION_PHRASES = [
  'it will be allowed to merge this task:',
  'except everything related to:',
  'allowed to merge in all projects except',
  'merge is allowed except',
  ':alert: do not merge these projects:',
  'you can merge:',
];

export const MAX_MESSAGES_TO_CHECK = 10;
export const DEFAULT_MERGE_BUTTON_SELECTOR =
  '.merge-button-container > .merge-button';
export const DEFAULT_BITBUCKET_URL =
  'https://bitbucket.my-company.com/projects/*/repos/*/pull-requests/*/overview*';
export const DEFAULT_CHANNEL_NAME = 'frontend-closure';
export const SLACK_BASE_URL = 'https://app.slack.com/client/';
