import { determineMergeStatus, getPhrasesFromStorage } from './background.js';

let bitbucketTabId = null;

export async function registerBitbucketContentScript() {
  const { bitbucketUrl } = await chrome.storage.sync.get('bitbucketUrl');

  try {
    await chrome.scripting.unregisterContentScripts({
      ids: ['bitbucket-content-script'],
    });
  } catch {
    // Content script might not be registered yet, ignore error
  }

  if (bitbucketUrl) {
    try {
      await chrome.scripting.registerContentScripts([
        {
          id: 'bitbucket-content-script',
          matches: [bitbucketUrl],
          js: ['slack_frontend_closure_bitbucket_content.js'],
          runAt: 'document_idle',
        },
      ]);
    } catch {
      // Registration might fail if URL pattern is invalid, ignore error
    }
  }
}

export const updateMergeButtonFromLastKnownMergeState = () => {
  chrome.storage.local.get(
    ['lastKnownMergeState', 'featureEnabled'],
    async (result) => {
      if (result.lastKnownMergeState) {
        const { isMergeDisabled, lastSlackMessage, channelName, mergeStatus } =
          result.lastKnownMergeState;

        const finalIsMergeDisabled =
          result.featureEnabled === false ? false : isMergeDisabled;
        const finalMergeStatus =
          result.featureEnabled === false ? 'allowed' : mergeStatus;

        try {
          await chrome.tabs.sendMessage(bitbucketTabId, {
            action: 'updateMergeButton',
            lastSlackMessage: lastSlackMessage,
            channelName: channelName,
            isMergeDisabled: finalIsMergeDisabled,
            mergeStatus: finalMergeStatus,
            featureEnabled: result.featureEnabled !== false,
          });
        } catch {
          bitbucketTabId = null;
        }
      }
    },
  );
};

export async function updateContentScriptMergeState(channelName) {
  const { featureEnabled } = await chrome.storage.local.get('featureEnabled');

  if (bitbucketTabId) {
    const {
      currentAllowedPhrases,
      currentDisallowedPhrases,
      currentExceptionPhrases,
    } = await getPhrasesFromStorage();

    const { messages } = await chrome.storage.local.get('messages');

    if (messages && messages.length > 0) {
      const { status: mergeStatus, message: matchingMessage } =
        determineMergeStatus({
          messages,
          allowedPhrases: currentAllowedPhrases,
          disallowedPhrases: currentDisallowedPhrases,
          exceptionPhrases: currentExceptionPhrases,
        });

      const isMergeDisabled =
        featureEnabled !== false &&
        (mergeStatus === 'disallowed' || mergeStatus === 'exception');

      const finalMergeStatus =
        featureEnabled === false ? 'allowed' : mergeStatus;
      const finalIsMergeDisabled =
        featureEnabled === false ? false : isMergeDisabled;

      const lastSlackMessage = matchingMessage ? matchingMessage.text : '';

      const lastKnownMergeState = {
        mergeStatus: finalMergeStatus,
        isMergeDisabled: finalIsMergeDisabled,
        lastSlackMessage,
        channelName,
        featureEnabled: featureEnabled !== false,
      };

      await chrome.storage.local.set({ lastKnownMergeState });

      try {
        await chrome.tabs.sendMessage(bitbucketTabId, {
          action: 'updateMergeButton',
          lastSlackMessage,
          channelName,
          isMergeDisabled: finalIsMergeDisabled,
          mergeStatus: finalMergeStatus,
          featureEnabled: featureEnabled !== false,
        });
      } catch {
        bitbucketTabId = null;
      }
    }
  }
}

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'bitbucketPageLoaded') {
    bitbucketTabId = sender.tab.id;
    updateMergeButtonFromLastKnownMergeState();
    sendResponse({ success: true });
  }

  if (request.action === 'updateMessages') {
    sendResponse({ success: true });
  }

  if (request.action === 'getMessages') {
    chrome.storage.local.get(['messages', 'appStatus'], (result) => {
      sendResponse({
        messages: result.messages || [],
        appStatus: result.appStatus || 'UNKNOWN',
      });
    });
    return true; // Keep the message channel open for async response
  }

  if (request.action === 'reconnectSlack') {
    import('./background_slack.js').then(({ connectToSlackSocketMode }) => {
      connectToSlackSocketMode();
    });
    sendResponse({ success: true });
  }

  if (request.action === 'disableFeatureTemporarily') {
    chrome.storage.local.set({ featureEnabled: false });
    import('./background.js').then(({ scheduleFeatureReactivation }) => {
      scheduleFeatureReactivation();
    });
    sendResponse({ success: true });
  }
});
