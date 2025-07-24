import { MERGE_STATUS, MESSAGE_ACTIONS } from '@src/modules/common/constants';
import { ChromeRuntimeMessage } from '@src/modules/common/types/chrome';

interface MergeButtonWithHandler extends HTMLElement {
  _customMergeHandler?: (event: MouseEvent) => void;
}

interface LastKnownMergeState {
  mergeStatus: MERGE_STATUS;
  channelName?: string;
}

const BitbucketMergeController = (() => {
  let mergeButtonObserver: MutationObserver | null = null;

  function disableMergeButton(
    mergeButton: MergeButtonWithHandler,
    channelName: string | undefined,
    mergeStatus: MERGE_STATUS
  ): void {
    if (mergeStatus === MERGE_STATUS.EXCEPTION) {
      mergeButton.style.backgroundColor = '#FFA500';
    } else {
      mergeButton.style.backgroundColor = '#ef445e';
      mergeButton.style.cursor = 'not-allowed';
    }

    if (mergeButton._customMergeHandler) {
      mergeButton.removeEventListener('click', mergeButton._customMergeHandler, true);
    }

    mergeButton._customMergeHandler = (event: MouseEvent) => {
      let message = ``;
      if (mergeStatus === MERGE_STATUS.DISALLOWED) {
        message = `Merge function is disallowed from Slack.`;
      } else if (mergeStatus === MERGE_STATUS.EXCEPTION) {
        message = `Merge function is allowed with specific exceptions.`;
      }

      message += `\nNotified from channel: #${channelName || ''}`;

      if (mergeStatus === MERGE_STATUS.EXCEPTION) {
        if (!confirm(message)) {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
      } else {
        alert(message);
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };

    mergeButton.addEventListener('click', mergeButton._customMergeHandler, true);
  }

  function enableMergeButton(mergeButton: MergeButtonWithHandler): void {
    mergeButton.style.backgroundColor = '';
    mergeButton.style.color = '';
    mergeButton.style.cursor = '';

    if (!mergeButton._customMergeHandler) return;

    mergeButton.removeEventListener('click', mergeButton._customMergeHandler, true);
    mergeButton._customMergeHandler = undefined;
  }

  async function applyMergeButtonLogic(
    mergeStatus: MERGE_STATUS,
    channelName: string | undefined
  ): Promise<void> {
    const { mergeButtonSelector } = await chrome.storage.sync.get('mergeButtonSelector');
    const mergeButton = document.querySelector(
      mergeButtonSelector || '.merge-button-container > .merge-button'
    ) as MergeButtonWithHandler | null;

    if (!mergeButton) {
      return;
    }

    if (mergeStatus === MERGE_STATUS.DISALLOWED || mergeStatus === MERGE_STATUS.EXCEPTION) {
      disableMergeButton(mergeButton, channelName, mergeStatus);
    } else {
      enableMergeButton(mergeButton);
    }
  }

  function applyInitialMergeState(): void {
    chrome.storage.local.get(
      ['lastKnownMergeState', 'featureEnabled'],
      (result: { lastKnownMergeState?: LastKnownMergeState; featureEnabled?: boolean }) => {
        if (result.lastKnownMergeState) {
          const { mergeStatus, channelName } = result.lastKnownMergeState;

          if (result.featureEnabled === false) {
            applyMergeButtonLogic(MERGE_STATUS.ALLOWED, channelName);
          } else {
            applyMergeButtonLogic(mergeStatus, channelName);
          }
        }
      }
    );
  }

  async function observeMergeButton(): Promise<void> {
    const targetNode = document.body;
    const config: MutationObserverInit = { childList: true, subtree: true };
    const { mergeButtonSelector } = await chrome.storage.sync.get('mergeButtonSelector');

    const callback = function (_mutationsList: MutationRecord[], observer: MutationObserver) {
      const mergeButton = document.querySelector(
        mergeButtonSelector || '.merge-button-container > .merge-button'
      );
      if (mergeButton) {
        observer.disconnect();
        applyInitialMergeState();
      }
    };

    mergeButtonObserver = new MutationObserver(callback);
    mergeButtonObserver.observe(targetNode, config);
  }

  function handleRuntimeMessage(request: ChromeRuntimeMessage): void {
    if (request.action === MESSAGE_ACTIONS.UPDATE_MERGE_BUTTON) {
      const payload = request.payload || {};
      if (payload.featureEnabled === false) {
        applyMergeButtonLogic(MERGE_STATUS.ALLOWED, payload.channelName);
      } else {
        applyMergeButtonLogic(payload.mergeStatus as MERGE_STATUS, payload.channelName);
      }
    }
  }

  function init(): void {
    chrome.runtime.sendMessage({ action: MESSAGE_ACTIONS.BITBUCKET_TAB_LOADED });
    chrome.runtime.onMessage.addListener(handleRuntimeMessage);
    observeMergeButton();
  }

  return {
    init,
  };
})();

BitbucketMergeController.init();
