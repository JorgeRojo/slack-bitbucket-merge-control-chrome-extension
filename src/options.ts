import {
  DEFAULT_ALLOWED_PHRASES,
  DEFAULT_DISALLOWED_PHRASES,
  DEFAULT_EXCEPTION_PHRASES,
  DEFAULT_BITBUCKET_URL,
  DEFAULT_MERGE_BUTTON_SELECTOR,
  DEFAULT_CHANNEL_NAME,
  MESSAGE_ACTIONS,
} from './constants.js';
import { literals } from './literals.js';
import { ChromeStorageItems } from './types/chrome.js';

function formatMultilineInput(text: string): string {
  return text
    .trim()
    .split('\n')
    .map(phrase => phrase.trim())
    .filter(phrase => phrase !== '')
    .join(',');
}

function formatCommaToMultiline(text: string): string {
  return text.split(',').join('\n');
}

document.addEventListener('DOMContentLoaded', function () {
  const saveButton = document.getElementById('save') as HTMLButtonElement;
  const tokenInput = document.getElementById('slackToken') as HTMLInputElement;
  const appTokenInput = document.getElementById('appToken') as HTMLInputElement;
  const channelInput = document.getElementById('channelName') as HTMLInputElement;
  const allowedPhrasesInput = document.getElementById('allowedPhrases') as HTMLTextAreaElement;
  const disallowedPhrasesInput = document.getElementById(
    'disallowedPhrases'
  ) as HTMLTextAreaElement;
  const exceptionPhrasesInput = document.getElementById('exceptionPhrases') as HTMLTextAreaElement;
  const bitbucketUrlInput = document.getElementById('bitbucketUrl') as HTMLInputElement;
  const mergeButtonSelectorInput = document.getElementById(
    'mergeButtonSelector'
  ) as HTMLInputElement;
  const statusDiv = document.getElementById('status') as HTMLDivElement;

  chrome.storage.sync.get(
    [
      'slackToken',
      'appToken',
      'channelName',
      'allowedPhrases',
      'disallowedPhrases',
      'exceptionPhrases',
      'bitbucketUrl',
      'mergeButtonSelector',
    ],
    async function (result: ChromeStorageItems) {
      if (result.slackToken) {
        tokenInput.value = result.slackToken;
      }

      if (result.appToken) {
        appTokenInput.value = result.appToken;
      }

      if (result.channelName) {
        channelInput.value = result.channelName;
      } else {
        channelInput.value = DEFAULT_CHANNEL_NAME;
      }

      if (result.allowedPhrases) {
        const phrasesValue = Array.isArray(result.allowedPhrases)
          ? result.allowedPhrases.join(',')
          : result.allowedPhrases;
        allowedPhrasesInput.value = formatCommaToMultiline(phrasesValue);
      } else {
        allowedPhrasesInput.value = DEFAULT_ALLOWED_PHRASES.join('\n');
      }

      if (result.disallowedPhrases) {
        const phrasesValue = Array.isArray(result.disallowedPhrases)
          ? result.disallowedPhrases.join(',')
          : result.disallowedPhrases;
        disallowedPhrasesInput.value = formatCommaToMultiline(phrasesValue);
      } else {
        disallowedPhrasesInput.value = DEFAULT_DISALLOWED_PHRASES.join('\n');
      }

      if (result.exceptionPhrases) {
        const phrasesValue = Array.isArray(result.exceptionPhrases)
          ? result.exceptionPhrases.join(',')
          : result.exceptionPhrases;
        exceptionPhrasesInput.value = formatCommaToMultiline(phrasesValue);
      } else {
        exceptionPhrasesInput.value = DEFAULT_EXCEPTION_PHRASES.join('\n');
      }

      if (result.bitbucketUrl) {
        bitbucketUrlInput.value = result.bitbucketUrl;
      } else {
        bitbucketUrlInput.value = DEFAULT_BITBUCKET_URL;
      }

      if (result.mergeButtonSelector) {
        mergeButtonSelectorInput.value = result.mergeButtonSelector;
      } else {
        mergeButtonSelectorInput.value = DEFAULT_MERGE_BUTTON_SELECTOR;
      }
    }
  );

  saveButton.addEventListener('click', function () {
    const slackToken = tokenInput.value.trim();
    const appToken = appTokenInput.value.trim();
    const channelName = channelInput.value.trim().replace(/^#/, '');
    const allowedPhrases = formatMultilineInput(allowedPhrasesInput.value);
    const disallowedPhrases = formatMultilineInput(disallowedPhrasesInput.value);
    const exceptionPhrases = formatMultilineInput(exceptionPhrasesInput.value);
    const bitbucketUrl = bitbucketUrlInput.value.trim();
    const mergeButtonSelector = mergeButtonSelectorInput.value.trim();

    if (slackToken && appToken && channelName && bitbucketUrl && mergeButtonSelector) {
      statusDiv.textContent = 'Saving options...';
      statusDiv.className = 'status-message status-loading';

      chrome.storage.sync.set(
        {
          slackToken,
          appToken,
          channelName,
          allowedPhrases,
          disallowedPhrases,
          exceptionPhrases,
          bitbucketUrl,
          mergeButtonSelector,
        },
        async function () {
          statusDiv.textContent = literals.options.textOptionsSaved;
          statusDiv.className = 'status-message status-success';

          chrome.storage.local.remove(['channelId', 'lastFetchTs']);

          await chrome.runtime.sendMessage({
            action: MESSAGE_ACTIONS.RECONNECT_SLACK,
          });

          await chrome.runtime.sendMessage({
            action: MESSAGE_ACTIONS.FETCH_NEW_MESSAGES,
            payload: { 
              channelName: channelName,
              skipErrorNotification: true,
            },
          });

          setTimeout(function () {
            statusDiv.textContent = '';
            statusDiv.className = 'status-message';
          }, 3000);
        }
      );
    } else {
      statusDiv.textContent = literals.options.textFillAllFields;
      statusDiv.className = 'status-message status-error';
    }
  });
});
