import {
  DEFAULT_MERGE_BUTTON_SELECTOR,
  DEFAULT_ALLOWED_PHRASES,
  DEFAULT_DISALLOWED_PHRASES,
  DEFAULT_EXCEPTION_PHRASES,
  FEATURE_REACTIVATION_TIMEOUT,
} from './constants.js';
import { connectToSlackSocketMode } from './background_slack.js';
import {
  registerBitbucketContentScript,
  updateContentScriptMergeState,
} from './background_bitbucket.js';

// Common utility functions
export function normalizeText(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '') // Remove diacritical marks (accents, tildes, etc.)
    .replace(/\s+/g, ' ') // Replace multiple whitespace characters with single space
    .trim();
}

export function cleanSlackMessageText(text) {
  if (!text) return '';

  text = text.replace(/[\n\r\t]+/g, ' '); // Replace line breaks and tabs with spaces
  let cleanedText = text.replace(/<@[^>]+>/g, '@MENTION'); // Replace user mentions like <@U123456789> with @MENTION
  cleanedText = cleanedText.replace(/<#[^|>]+>/g, '@CHANNEL'); // Replace unnamed channel mentions like <#C123456789> with @CHANNEL
  cleanedText = cleanedText.replace(/<[^>]+>/g, ''); // Remove any remaining angle bracket content
  cleanedText = cleanedText.replace(/\s+/g, ' ').trim(); // Replace multiple spaces with single space and trim
  return cleanedText;
}

export function determineMergeStatus({
  messages,
  allowedPhrases,
  disallowedPhrases,
  exceptionPhrases,
}) {
  const normalizedAllowedPhrases = allowedPhrases.map(normalizeText);
  const normalizedDisallowedPhrases = disallowedPhrases.map(normalizeText);
  const normalizedExceptionPhrases = exceptionPhrases.map(normalizeText);

  for (const message of messages) {
    const normalizedMessageText = normalizeText(message.text);

    const matchingExceptionPhrase = normalizedExceptionPhrases.find((keyword) =>
      normalizedMessageText.includes(keyword),
    );
    if (matchingExceptionPhrase) {
      return { status: 'exception', message };
    }

    const matchingDisallowedPhrase = normalizedDisallowedPhrases.find(
      (keyword) => normalizedMessageText.includes(keyword),
    );
    if (matchingDisallowedPhrase) {
      return { status: 'disallowed', message };
    }

    const matchingAllowedPhrase = normalizedAllowedPhrases.find((keyword) =>
      normalizedMessageText.includes(keyword),
    );
    if (matchingAllowedPhrase) {
      return { status: 'allowed', message };
    }
  }

  return { status: 'unknown', message: null };
}

export function updateExtensionIcon(status) {
  let path16, path48;
  switch (status) {
    case 'loading':
      path16 = 'images/icon16.png';
      path48 = 'images/icon48.png';
      break;
    case 'allowed':
      path16 = 'images/icon16_enabled.png';
      path48 = 'images/icon48_enabled.png';
      break;
    case 'disallowed':
      path16 = 'images/icon16_disabled.png';
      path48 = 'images/icon48_disabled.png';
      break;
    case 'exception':
      path16 = 'images/icon16_exception.png';
      path48 = 'images/icon48_exception.png';
      break;
    case 'error':
      path16 = 'images/icon16_error.png';
      path48 = 'images/icon48_error.png';
      break;
    default:
      path16 = 'images/icon16.png';
      path48 = 'images/icon48.png';
      break;
  }
  chrome.action.setIcon({
    path: {
      16: path16,
      48: path48,
    },
  });
}

export async function getPhrasesFromStorage() {
  const { allowedPhrases, disallowedPhrases, exceptionPhrases } =
    await chrome.storage.sync.get([
      'allowedPhrases',
      'disallowedPhrases',
      'exceptionPhrases',
    ]);

  const currentAllowedPhrases = allowedPhrases
    ? allowedPhrases.split(',')
    : DEFAULT_ALLOWED_PHRASES;

  const currentDisallowedPhrases = disallowedPhrases
    ? disallowedPhrases.split(',')
    : DEFAULT_DISALLOWED_PHRASES;

  const currentExceptionPhrases = exceptionPhrases
    ? exceptionPhrases.split(',')
    : DEFAULT_EXCEPTION_PHRASES;

  return {
    currentAllowedPhrases,
    currentDisallowedPhrases,
    currentExceptionPhrases,
  };
}

// Feature reactivation functions
export async function scheduleFeatureReactivation() {
  const reactivationTime = Date.now() + FEATURE_REACTIVATION_TIMEOUT;
  await chrome.storage.local.set({ reactivationTime });

  setTimeout(async () => {
    await chrome.storage.local.set({ featureEnabled: true });

    const { channelName } = await chrome.storage.sync.get('channelName');
    if (channelName) {
      await updateContentScriptMergeState(channelName);
    }
  }, FEATURE_REACTIVATION_TIMEOUT);
}

export async function checkScheduledReactivation() {
  const { reactivationTime, featureEnabled } = await chrome.storage.local.get([
    'reactivationTime',
    'featureEnabled',
  ]);

  if (featureEnabled === false && reactivationTime) {
    const timeLeft = Math.max(0, reactivationTime - Date.now());

    if (timeLeft > 0) {
      setTimeout(reactivateFeature, timeLeft);
    } else {
      await reactivateFeature();
    }
  }
}

export async function reactivateFeature() {
  await chrome.storage.local.set({ featureEnabled: true });

  const { channelName } = await chrome.storage.sync.get('channelName');
  if (channelName) {
    await updateContentScriptMergeState(channelName);
  }
}

// Re-export updateContentScriptMergeState for use by other modules
export { updateContentScriptMergeState };

// Chrome extension lifecycle events
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get('mergeButtonSelector', (result) => {
    if (!result.mergeButtonSelector) {
      chrome.storage.sync.set({
        mergeButtonSelector: DEFAULT_MERGE_BUTTON_SELECTOR,
      });
    }
  });
  connectToSlackSocketMode();
  registerBitbucketContentScript();
  checkScheduledReactivation();
});

chrome.runtime.onStartup.addListener(() => {
  connectToSlackSocketMode();
  checkScheduledReactivation();
});
