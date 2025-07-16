import {
  DEFAULT_ALLOWED_PHRASES,
  DEFAULT_DISALLOWED_PHRASES,
  DEFAULT_EXCEPTION_PHRASES,
  DEFAULT_BITBUCKET_URL,
  DEFAULT_MERGE_BUTTON_SELECTOR,
  DEFAULT_CHANNEL_NAME,
} from './constants.js';
import { literals } from './literals.js';

document.addEventListener('DOMContentLoaded', function () {
  const saveButton = document.getElementById('save');
  const tokenInput = document.getElementById('slackToken');
  const channelInput = document.getElementById('channelName');
  const allowedPhrasesInput = document.getElementById('allowedPhrases');
  const disallowedPhrasesInput = document.getElementById('disallowedPhrases');
  const exceptionPhrasesInput = document.getElementById('exceptionPhrases');
  const bitbucketUrlInput = document.getElementById('bitbucketUrl');
  const mergeButtonSelectorInput = document.getElementById(
    'mergeButtonSelector',
  );
  const statusDiv = document.getElementById('status');

  chrome.storage.sync.get(
    [
      'slackToken',
      'channelName',
      'allowedPhrases',
      'disallowedPhrases',
      'exceptionPhrases',
      'bitbucketUrl',
      'mergeButtonSelector',
    ],
    async function (result) {
      if (result.slackToken) {
        tokenInput.value = result.slackToken;
      }
      if (result.channelName) {
        channelInput.value = result.channelName;
      } else {
        channelInput.value = DEFAULT_CHANNEL_NAME;
      }
      if (result.allowedPhrases) {
        allowedPhrasesInput.value = result.allowedPhrases.split(',').join('\n');
      } else {
        allowedPhrasesInput.value = DEFAULT_ALLOWED_PHRASES.join('\n');
      }
      if (result.disallowedPhrases) {
        disallowedPhrasesInput.value = result.disallowedPhrases
          .split(',')
          .join('\n');
      } else {
        disallowedPhrasesInput.value = DEFAULT_DISALLOWED_PHRASES.join('\n');
      }
      if (result.exceptionPhrases) {
        exceptionPhrasesInput.value = result.exceptionPhrases
          .split(',')
          .join('\n');
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
    },
  );

  saveButton.addEventListener('click', function () {
    const slackToken = tokenInput.value.trim();
    const channelName = channelInput.value.trim().replace(/^#/, '');
    const allowedPhrases = allowedPhrasesInput.value
      .trim()
      .split('\n')
      .map((phrase) => phrase.trim())
      .filter((phrase) => phrase !== '')
      .join(',');
    const disallowedPhrases = disallowedPhrasesInput.value
      .trim()
      .split('\n')
      .map((phrase) => phrase.trim())
      .filter((phrase) => phrase !== '')
      .join(',');
    const exceptionPhrases = exceptionPhrasesInput.value
      .trim()
      .split('\n')
      .map((phrase) => phrase.trim())
      .filter((phrase) => phrase !== '')
      .join(',');
    const bitbucketUrl = bitbucketUrlInput.value.trim();
    const mergeButtonSelector = mergeButtonSelectorInput.value.trim();

    if (slackToken && channelName && bitbucketUrl && mergeButtonSelector) {
      chrome.storage.sync.set(
        {
          slackToken,
          channelName,
          allowedPhrases,
          disallowedPhrases,
          exceptionPhrases,
          bitbucketUrl,
          mergeButtonSelector,
        },
        function () {
          statusDiv.textContent = literals.options.textOptionsSaved;
          chrome.storage.local.remove([
            'channelId',
            'lastFetchTs',
            'messages',
            'appStatus',
          ]);
          setTimeout(function () {
            statusDiv.textContent = '';
          }, 2000);
        },
      );
    } else {
      statusDiv.textContent = literals.options.textFillAllFields;
    }
  });
});
