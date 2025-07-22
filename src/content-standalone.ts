// Standalone content script without ES6 imports for Chrome Extension compatibility

// Constants copied from constants.ts to avoid import issues
const MERGE_STATUS = {
  ALLOWED: 'allowed',
  DISALLOWED: 'disallowed',
  EXCEPTION: 'exception',
  LOADING: 'loading',
} as const;

const MESSAGE_ACTIONS = {
  BITBUCKET_TAB_LOADED: 'bitbucketTabLoaded',
  UPDATE_MERGE_BUTTON: 'updateMergeButton',
} as const;

const BITBUCKET_TAB_LOADED = MESSAGE_ACTIONS.BITBUCKET_TAB_LOADED;
const UPDATE_MERGE_BUTTON = MESSAGE_ACTIONS.UPDATE_MERGE_BUTTON;

interface MergeButtonWithHandler extends HTMLElement {
  _customMergeHandler?: (event: MouseEvent) => void;
}

interface ChromeRuntimeMessage {
  action: string;
  payload?: any;
}

const BitbucketMergeController = (() => {
  let mergeButtonObserver: MutationObserver | null = null;

  function disableMergeButton(
    mergeButton: HTMLElement,
    channelName: string,
    mergeStatus: string
  ): void {
    if (mergeStatus === MERGE_STATUS.EXCEPTION) {
      mergeButton.style.backgroundColor = '#FFA500';
    } else {
      mergeButton.style.backgroundColor = '#dc3545';
    }
    mergeButton.style.color = 'white';
    mergeButton.style.cursor = 'not-allowed';
    mergeButton.style.opacity = '0.7';

    const buttonWithHandler = mergeButton as MergeButtonWithHandler;

    if (!buttonWithHandler._customMergeHandler) {
      buttonWithHandler._customMergeHandler = (event: MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        let message = '';
        if (mergeStatus === MERGE_STATUS.EXCEPTION) {
          message = `Merge temporarily allowed due to exception keywords, but please check #${channelName} for context.`;
        } else {
          message = `Merge is currently disabled. Check #${channelName} for the latest status.`;
        }

        alert(message);
        return false;
      };

      mergeButton.addEventListener('click', buttonWithHandler._customMergeHandler, true);
    }

    mergeButton.setAttribute('disabled', 'true');
    if (mergeButton.tagName === 'BUTTON') {
      (mergeButton as HTMLButtonElement).disabled = true;
    }
  }

  function enableMergeButton(mergeButton: HTMLElement): void {
    mergeButton.style.backgroundColor = '';
    mergeButton.style.color = '';
    mergeButton.style.cursor = '';
    mergeButton.style.opacity = '';

    const buttonWithHandler = mergeButton as MergeButtonWithHandler;

    if (buttonWithHandler._customMergeHandler) {
      mergeButton.removeEventListener('click', buttonWithHandler._customMergeHandler, true);
      buttonWithHandler._customMergeHandler = undefined;
    }

    mergeButton.removeAttribute('disabled');
    if (mergeButton.tagName === 'BUTTON') {
      (mergeButton as HTMLButtonElement).disabled = false;
    }
  }

  function updateMergeButtonState(
    mergeButton: HTMLElement,
    channelName: string,
    mergeStatus: string,
    featureEnabled: boolean
  ): void {
    if (!featureEnabled || mergeStatus === MERGE_STATUS.ALLOWED) {
      enableMergeButton(mergeButton);
    } else {
      disableMergeButton(mergeButton, channelName, mergeStatus);
    }
  }

  function handleRuntimeMessage(
    message: ChromeRuntimeMessage,
    _sender: chrome.runtime.MessageSender,
    _sendResponse: (response?: any) => void
  ): void {
    if (message.action === UPDATE_MERGE_BUTTON) {
      const { lastSlackMessage, channelName, mergeStatus, featureEnabled } = message.payload || {};

      console.log('Content script received merge button update:', {
        channelName,
        mergeStatus,
        featureEnabled,
        lastSlackMessage,
      });

      const mergeButton = findMergeButton();
      if (mergeButton) {
        updateMergeButtonState(mergeButton, channelName, mergeStatus, featureEnabled);
      }
    }
  }

  function findMergeButton(): HTMLElement | null {
    // Try multiple selectors for different Bitbucket layouts
    const selectors = [
      '[data-testid="merge-button"]',
      'button[data-testid="merge-button"]',
      '.merge-button',
      'button.merge-button',
      '[aria-label*="Merge"]',
      'button[aria-label*="Merge"]',
      'button:contains("Merge")',
      '[data-qa="pr-merge-button"]',
      'button[data-qa="pr-merge-button"]',
    ];

    for (const selector of selectors) {
      const button = document.querySelector(selector) as HTMLElement;
      if (button) {
        return button;
      }
    }

    // Fallback: look for buttons with "Merge" text
    const buttons = document.querySelectorAll('button');
    for (let i = 0; i < buttons.length; i++) {
      const button = buttons[i];
      if (button.textContent?.toLowerCase().includes('merge')) {
        return button as HTMLElement;
      }
    }

    return null;
  }

  function observeMergeButton(): void {
    if (mergeButtonObserver) {
      mergeButtonObserver.disconnect();
    }

    mergeButtonObserver = new MutationObserver(() => {
      const mergeButton = findMergeButton();
      if (mergeButton) {
        console.log('Merge button found via observer');
      }
    });

    mergeButtonObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  function init(): void {
    chrome.runtime.sendMessage({ action: BITBUCKET_TAB_LOADED });
    chrome.runtime.onMessage.addListener(handleRuntimeMessage);
    observeMergeButton();
  }

  return {
    init,
  };
})();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', BitbucketMergeController.init);
} else {
  BitbucketMergeController.init();
}
