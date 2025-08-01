import { registerBitbucketContentScript } from '@src/modules/background/bitbucket/content-script';
import { checkScheduledReactivation } from '@src/modules/background/countdown';
import { messageHandlers } from '@src/modules/background/message-handlers';
import {
  checkWebSocketConnection,
  connectToSlackSocketMode,
  setupWebSocketCheckAlarm,
} from '@src/modules/background/websocket';
import {
  DEFAULT_MERGE_BUTTON_SELECTOR,
  WEBSOCKET_CHECK_ALARM,
} from '@src/modules/common/constants';

// Message handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const handler = messageHandlers[request.action];
  if (handler) {
    return handler(request, sender, sendResponse);
  }
  return false;
});

// Alarm handler
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === WEBSOCKET_CHECK_ALARM) {
    checkWebSocketConnection();
  }
});

// Storage change handler
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && changes.bitbucketUrl) {
    registerBitbucketContentScript();
  }
});

// Extension initialization
if (typeof process === 'undefined' || process.env.NODE_ENV !== 'test') {
  chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.sync.get('mergeButtonSelector', result => {
      if (!result.mergeButtonSelector) {
        chrome.storage.sync.set({
          mergeButtonSelector: DEFAULT_MERGE_BUTTON_SELECTOR,
        });
      }
    });
    connectToSlackSocketMode();
    registerBitbucketContentScript();
    checkScheduledReactivation();
    setupWebSocketCheckAlarm();
  });

  chrome.runtime.onStartup.addListener(() => {
    connectToSlackSocketMode();
    registerBitbucketContentScript();
    checkScheduledReactivation();
    setupWebSocketCheckAlarm();
  });
}
