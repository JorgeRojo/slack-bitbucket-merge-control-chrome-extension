import { MERGE_STATUS, APP_STATUS, ERROR_MESSAGES } from '../constants';
import { Logger } from './logger';
import { ProcessedMessage } from '../types/index';
import { SlackMessage } from '../types/slack';
import { toErrorType, toString } from './type-helpers';

/**
 * Normalizes text by removing diacritical marks and standardizing whitespace
 */
export function normalizeText(text: string | undefined): string {
  if (!text) return '';
  const DIACRITICAL_MARKS_REGEX = /\p{Diacritic}/gu;
  const MULTIPLE_WHITESPACE_REGEX = /\s+/g;
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(DIACRITICAL_MARKS_REGEX, '')
    .replace(MULTIPLE_WHITESPACE_REGEX, ' ')
    .trim();
}

/**
 * Cleans Slack message text by removing formatting, mentions, etc.
 */
export function cleanSlackMessageText(text: string | undefined): string {
  if (!text) return '';

  const NEWLINES_AND_TABS_REGEX = /[\n\r\t]+/g;
  const USER_MENTION_REGEX = /<@[^>]+>/g;
  const CHANNEL_MENTION_REGEX = /<#[^>]+>/g;
  const REMAINING_BRACKETS_REGEX = /<[^>]+>/g;
  const MULTIPLE_WHITESPACE_REGEX = /\s+/g;

  text = text.replace(NEWLINES_AND_TABS_REGEX, ' ');
  let cleanedText = text.replace(USER_MENTION_REGEX, '@MENTION');
  cleanedText = cleanedText.replace(CHANNEL_MENTION_REGEX, '@CHANNEL');
  cleanedText = cleanedText.replace(REMAINING_BRACKETS_REGEX, '');
  cleanedText = cleanedText.replace(MULTIPLE_WHITESPACE_REGEX, ' ').trim();
  return cleanedText;
}

interface DetermineMergeStatusParams {
  messages: ProcessedMessage[];
  allowedPhrases: string[];
  disallowedPhrases: string[];
  exceptionPhrases: string[];
}

interface DetermineMergeStatusResult {
  status: MERGE_STATUS;
  message: ProcessedMessage | null;
}

/**
 * Determines merge status based on message content and configured phrases
 */
export function determineMergeStatus({
  messages,
  allowedPhrases,
  disallowedPhrases,
  exceptionPhrases,
}: DetermineMergeStatusParams): DetermineMergeStatusResult {
  const normalizedAllowedPhrases = allowedPhrases.map(normalizeText);
  const normalizedDisallowedPhrases = disallowedPhrases.map(normalizeText);
  const normalizedExceptionPhrases = exceptionPhrases.map(normalizeText);

  for (const message of messages) {
    const normalizedMessageText = normalizeText(message.text);

    const matchingExceptionPhrase = normalizedExceptionPhrases.find(keyword =>
      normalizedMessageText.includes(keyword)
    );
    if (matchingExceptionPhrase) {
      return { status: MERGE_STATUS.EXCEPTION, message };
    }

    const matchingDisallowedPhrase = normalizedDisallowedPhrases.find(keyword =>
      normalizedMessageText.includes(keyword)
    );
    if (matchingDisallowedPhrase) {
      return { status: MERGE_STATUS.DISALLOWED, message };
    }

    const matchingAllowedPhrase = normalizedAllowedPhrases.find(keyword =>
      normalizedMessageText.includes(keyword)
    );
    if (matchingAllowedPhrase) {
      return { status: MERGE_STATUS.ALLOWED, message };
    }
  }

  return { status: MERGE_STATUS.UNKNOWN, message: null };
}

/**
 * Updates the extension icon based on the current status
 */
export function updateExtensionIcon(status: MERGE_STATUS): boolean {
  let smallIconPath: string, largeIconPath: string;
  switch (status) {
    case MERGE_STATUS.LOADING:
      smallIconPath = 'images/icon16.png';
      largeIconPath = 'images/icon48.png';
      break;
    case MERGE_STATUS.ALLOWED:
      smallIconPath = 'images/icon16_enabled.png';
      largeIconPath = 'images/icon48_enabled.png';
      break;
    case MERGE_STATUS.DISALLOWED:
      smallIconPath = 'images/icon16_disabled.png';
      largeIconPath = 'images/icon48_disabled.png';
      break;
    case MERGE_STATUS.EXCEPTION:
      smallIconPath = 'images/icon16_exception.png';
      largeIconPath = 'images/icon48_exception.png';
      break;
    case MERGE_STATUS.ERROR:
      smallIconPath = 'images/icon16_error.png';
      largeIconPath = 'images/icon48_error.png';
      break;
    default:
      smallIconPath = 'images/icon16.png';
      largeIconPath = 'images/icon48.png';
      break;
  }

  chrome.action.setIcon({
    path: {
      16: smallIconPath,
      48: largeIconPath,
    },
  });

  return true;
}

/**
 * Handles Slack API errors and updates app status accordingly
 */
export async function handleSlackApiError(error: Error | unknown): Promise<void> {
  const errorMessage = error instanceof Error ? error.message : String(error);

  if (
    errorMessage.includes(ERROR_MESSAGES.CHANNEL_NOT_FOUND) ||
    errorMessage.includes(ERROR_MESSAGES.NOT_IN_CHANNEL)
  ) {
    await updateAppStatus(APP_STATUS.CHANNEL_NOT_FOUND);
    await chrome.storage.local.set({
      channelId: null,
    });
  } else if (
    errorMessage.includes(ERROR_MESSAGES.INVALID_AUTH) ||
    errorMessage.includes(ERROR_MESSAGES.TOKEN_REVOKED)
  ) {
    await updateAppStatus(APP_STATUS.TOKEN_ERROR);
  } else {
    await updateAppStatus(APP_STATUS.UNKNOWN_ERROR);
  }
}

let lastAppStatus: APP_STATUS | null = null;

/**
 * Updates the application status and icon
 */
export async function updateAppStatus(status: APP_STATUS): Promise<boolean> {
  if (status === lastAppStatus) {
    return false;
  }

  lastAppStatus = status;

  const { lastKnownMergeState = {} } = await chrome.storage.local.get('lastKnownMergeState');
  await chrome.storage.local.set({
    lastKnownMergeState: {
      ...lastKnownMergeState,
      appStatus: status,
    },
  });

  let iconStatus: MERGE_STATUS;
  switch (status) {
    case APP_STATUS.OK:
      iconStatus = await getCurrentMergeStatusFromMessages();
      break;
    case APP_STATUS.CONFIG_ERROR:
    case APP_STATUS.TOKEN_ERROR:
    case APP_STATUS.WEB_SOCKET_ERROR:
    case APP_STATUS.CHANNEL_NOT_FOUND:
    case APP_STATUS.UNKNOWN_ERROR:
      iconStatus = MERGE_STATUS.ERROR;
      break;
    default:
      iconStatus = MERGE_STATUS.UNKNOWN;
  }

  updateExtensionIcon(iconStatus);

  return true;
}

/**
 * Gets the current merge status based on stored messages
 */
export async function getCurrentMergeStatusFromMessages(): Promise<MERGE_STATUS> {
  const { messages = [] } = await chrome.storage.local.get('messages');

  if (messages.length === 0) {
    return MERGE_STATUS.UNKNOWN;
  }

  const { currentAllowedPhrases, currentDisallowedPhrases, currentExceptionPhrases } =
    await getPhrasesFromStorage();

  const { status } = determineMergeStatus({
    messages,
    allowedPhrases: currentAllowedPhrases,
    disallowedPhrases: currentDisallowedPhrases,
    exceptionPhrases: currentExceptionPhrases,
  });

  return status;
}

/**
 * Updates the extension icon based on current messages
 */
export async function updateIconBasedOnCurrentMessages(): Promise<void> {
  const iconStatus = await getCurrentMergeStatusFromMessages();
  updateExtensionIcon(iconStatus);
}

/**
 * Gets phrases from storage or uses defaults
 */
export async function getPhrasesFromStorage(): Promise<{
  currentAllowedPhrases: string[];
  currentDisallowedPhrases: string[];
  currentExceptionPhrases: string[];
}> {
  try {
    const result = await chrome.storage.sync.get([
      'allowedPhrases',
      'disallowedPhrases',
      'exceptionPhrases',
    ]);

    // Safely destructure with fallback to empty object
    const { allowedPhrases, disallowedPhrases, exceptionPhrases } = result || {};

    // Import these directly in the function to avoid circular dependencies
    const { DEFAULT_ALLOWED_PHRASES, DEFAULT_DISALLOWED_PHRASES, DEFAULT_EXCEPTION_PHRASES } =
      await import('../constants');

    const currentAllowedPhrases =
      allowedPhrases && allowedPhrases.trim() ? allowedPhrases.split(',') : DEFAULT_ALLOWED_PHRASES;

    const currentDisallowedPhrases =
      disallowedPhrases && disallowedPhrases.trim()
        ? disallowedPhrases.split(',')
        : DEFAULT_DISALLOWED_PHRASES;

    const currentExceptionPhrases =
      exceptionPhrases && exceptionPhrases.trim()
        ? exceptionPhrases.split(',')
        : DEFAULT_EXCEPTION_PHRASES;

    return {
      currentAllowedPhrases,
      currentDisallowedPhrases,
      currentExceptionPhrases,
    };
  } catch (error) {
    // If there's an error (e.g., during tests), return default values
    const { DEFAULT_ALLOWED_PHRASES, DEFAULT_DISALLOWED_PHRASES, DEFAULT_EXCEPTION_PHRASES } =
      await import('../constants');

    return {
      currentAllowedPhrases: DEFAULT_ALLOWED_PHRASES,
      currentDisallowedPhrases: DEFAULT_DISALLOWED_PHRASES,
      currentExceptionPhrases: DEFAULT_EXCEPTION_PHRASES,
    };
  }
}

/**
 * Processes and stores a Slack message
 */
export async function processAndStoreMessage(message: SlackMessage): Promise<void> {
  if (!message.ts || !message.text) {
    return;
  }

  const messageTs = message.ts;

  let messages = (await chrome.storage.local.get('messages')).messages || [];
  const existMessage = messages.some((m: ProcessedMessage) => m.ts === messageTs);

  if (existMessage) {
    return;
  }

  messages.push({
    text: cleanSlackMessageText(message.text),
    ts: messageTs,
    user: message.user,
    matchType: null,
  });

  messages.sort((a: ProcessedMessage, b: ProcessedMessage) => Number(b.ts) - Number(a.ts));

  const MAX_MESSAGES = (await import('../constants')).MAX_MESSAGES;
  if (messages.length > MAX_MESSAGES) {
    messages = messages.slice(0, MAX_MESSAGES);
  }

  await chrome.storage.local.set({
    messages: messages,
  });

  const { currentAllowedPhrases, currentDisallowedPhrases, currentExceptionPhrases } =
    await getPhrasesFromStorage();

  const { message: matchingMessage } = determineMergeStatus({
    messages: messages,
    allowedPhrases: currentAllowedPhrases,
    disallowedPhrases: currentDisallowedPhrases,
    exceptionPhrases: currentExceptionPhrases,
  });

  await chrome.storage.local.set({ lastMatchingMessage: matchingMessage });

  await updateIconBasedOnCurrentMessages();
}
