import {
  DEFAULT_ALLOWED_PHRASES,
  DEFAULT_DISALLOWED_PHRASES,
  DEFAULT_EXCEPTION_PHRASES,
  DEFAULT_BITBUCKET_URL,
  DEFAULT_MERGE_BUTTON_SELECTOR,
  DEFAULT_CHANNEL_NAME,
} from './constants.js';
import { literals } from './literals.js';

function formatMultilineInput(text) {
  return text
    .trim()
    .split('\n')
    .map((phrase) => phrase.trim())
    .filter((phrase) => phrase !== '')
    .join(',');
}

function formatCommaToMultiline(text) {
  return text.split(',').join('\n');
}

document.addEventListener('DOMContentLoaded', function () {
  const saveButton = document.getElementById('save');
  const tokenInput = document.getElementById('slackToken');
  const appTokenInput = document.getElementById('appToken');
  const channelInput = document.getElementById('channelName');
  const allowedPhrasesInput = document.getElementById('allowedPhrases');
  const disallowedPhrasesInput = document.getElementById('disallowedPhrases');
  const exceptionPhrasesInput = document.getElementById('exceptionPhrases');
  const bitbucketUrlInput = document.getElementById('bitbucketUrl');
  const mergeButtonSelectorInput = document.getElementById(
    'mergeButtonSelector',
  );
  const statusDiv = document.getElementById('status');

  channelInput.addEventListener('change', function () {
    const channelName = channelInput.value.trim().replace(/^#/, '');
    if (channelName) {
      // Mostrar un indicador de carga
      statusDiv.textContent = 'Verificando canal...';
      statusDiv.className = 'status-message status-loading';

      chrome.runtime.sendMessage({
        action: 'fetchNewMessages',
        channelName: channelName,
      });

      // Escuchar la respuesta para saber si el cambio de canal fue exitoso
      chrome.runtime.onMessage.addListener(
        function channelChangeListener(message) {
          if (message.action === 'channelChangeError') {
            // Si hay un error, mostrar el mensaje
            statusDiv.textContent = `Error: ${message.error}`;
            statusDiv.className = 'status-message status-error';

            // Eliminar este listener después de usarlo
            chrome.runtime.onMessage.removeListener(channelChangeListener);

            // Limpiar el mensaje después de un tiempo
            setTimeout(function () {
              statusDiv.textContent = '';
              statusDiv.className = 'status-message';
            }, 3000);
          }
        },
      );
    }
  });

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
    async function (result) {
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
        allowedPhrasesInput.value = formatCommaToMultiline(
          result.allowedPhrases,
        );
      } else {
        allowedPhrasesInput.value = DEFAULT_ALLOWED_PHRASES.join('\n');
      }
      if (result.disallowedPhrases) {
        disallowedPhrasesInput.value = formatCommaToMultiline(
          result.disallowedPhrases,
        );
      } else {
        disallowedPhrasesInput.value = DEFAULT_DISALLOWED_PHRASES.join('\n');
      }
      if (result.exceptionPhrases) {
        exceptionPhrasesInput.value = formatCommaToMultiline(
          result.exceptionPhrases,
        );
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
    const appToken = appTokenInput.value.trim();
    const channelName = channelInput.value.trim().replace(/^#/, '');
    const allowedPhrases = formatMultilineInput(allowedPhrasesInput.value);
    const disallowedPhrases = formatMultilineInput(
      disallowedPhrasesInput.value,
    );
    const exceptionPhrases = formatMultilineInput(exceptionPhrasesInput.value);
    const bitbucketUrl = bitbucketUrlInput.value.trim();
    const mergeButtonSelector = mergeButtonSelectorInput.value.trim();

    if (
      slackToken &&
      appToken &&
      channelName &&
      bitbucketUrl &&
      mergeButtonSelector
    ) {
      // Mostrar un indicador de carga
      statusDiv.textContent = 'Guardando opciones...';
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
        function () {
          statusDiv.textContent = literals.options.textOptionsSaved;
          statusDiv.className = 'status-message status-success';

          // Solo eliminamos channelId y lastFetchTs, pero mantenemos messages y appStatus
          // hasta que se actualicen correctamente
          chrome.storage.local.remove(['channelId', 'lastFetchTs']);

          setTimeout(function () {
            statusDiv.textContent = '';
            statusDiv.className = 'status-message';
          }, 2000);

          // Primero reconectar Slack para actualizar la conexión con los nuevos tokens
          chrome.runtime.sendMessage({ action: 'reconnectSlack' });

          // Luego, después de un breve retraso, intentar obtener mensajes del canal
          setTimeout(function () {
            chrome.runtime.sendMessage({
              action: 'fetchNewMessages',
              channelName: channelName,
            });
          }, 1000);
        },
      );
    } else {
      statusDiv.textContent = literals.options.textFillAllFields;
      statusDiv.className = 'status-message status-error';
    }
  });
});
