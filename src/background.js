import {
  DEFAULT_MERGE_BUTTON_SELECTOR,
  SLACK_CONVERSATIONS_LIST_URL,
  SLACK_CONVERSATIONS_HISTORY_URL,
  SLACK_USERS_LIST_URL,
  POLLING_ALARM_NAME,
  MAX_MESSAGES,
  DEFAULT_ALLOWED_PHRASES,
  DEFAULT_DISALLOWED_PHRASES,
  DEFAULT_EXCEPTION_PHRASES,
  MAX_MESSAGES_TO_CHECK,
} from './constants.js';

let bitbucketTabId = null;

function normalizeText(text) {
  if (!text) return "";
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function determineMergeStatus(
  messages,
  allowedPhrases,
  disallowedPhrases,
  exceptionPhrases
) {
  const currentAllowedPhrases = allowedPhrases.map((phrase) =>
    normalizeText(phrase)
  );
  const currentDisallowedPhrases = disallowedPhrases.map((phrase) =>
    normalizeText(phrase)
  );
  const currentExceptionPhrases = exceptionPhrases.map((phrase) =>
    normalizeText(phrase)
  );

  for (
    let i = messages.length - 1;
    i >= Math.max(0, messages.length - MAX_MESSAGES_TO_CHECK);
    i--
  ) {
    const message = messages[i];
    const normalizedMessageText = normalizeText(message.text);

    if (
      currentExceptionPhrases.some((keyword) =>
        normalizedMessageText.includes(keyword)
      )
    ) {
      return { status: "exception", message: message };
    } else if (
      currentDisallowedPhrases.some((keyword) =>
        normalizedMessageText.includes(keyword)
      )
    ) {
      return { status: "disallowed", message: message };
    } else if (
      currentAllowedPhrases.some((keyword) =>
        normalizedMessageText.includes(keyword)
      )
    ) {
      return { status: "allowed", message: message };
    }
  }

  return { status: "unknown", message: null }; // If no matching phrase is found in the last 10 messages
}

function updateExtensionIcon(status) {
  let path16, path48;
  switch (status) {
    case "loading":
      path16 = "images/icon16.png";
      path48 = "images/icon48.png";
      break;
    case "allowed":
      path16 = "images/icon16_enabled.png";
      path48 = "images/icon48_enabled.png";
      break;
    case "disallowed":
      path16 = "images/icon16_disabled.png";
      path48 = "images/icon48_disabled.png";
      break;
    case "exception":
      path16 = "images/icon16_exception.png";
      path48 = "images/icon48_exception.png";
      break;
    case "error":
      path16 = "images/icon16_error.png";
      path48 = "images/icon48_error.png";
      break;
    default:
      path16 = "images/icon16.png";
      path48 = "images/icon48.png";
      break;
  }
  chrome.action.setIcon({
    path: {
      16: path16,
      48: path48,
    },
  });
}

async function fetchAndCacheUserProfiles(slackToken, userIds) {
  let { userProfiles = {} } = await chrome.storage.local.get("userProfiles");
  const newUsersToFetch = userIds.filter((id) => !userProfiles[id]);

  if (newUsersToFetch.length === 0) return;

  try {
    const usersResponse = await fetch(SLACK_USERS_LIST_URL, {
      headers: { Authorization: `Bearer ${slackToken}` },
    });
    const usersData = await usersResponse.json();
    if (usersData.ok) {
      usersData.members.forEach((user) => {
        if (userIds.includes(user.id)) {
          userProfiles[user.id] = {
            name: user.real_name || user.name,
            avatar: user.profile.image_72,
          };
        }
      });
      await chrome.storage.local.set({ userProfiles });
    }
  } catch (error) {
    /* console.error('Error fetching user profiles:', error); */
  }
}

async function resolveChannelId(slackToken, channelName) {
  let { channelId, cachedChannelName } = await chrome.storage.local.get([
    "channelId",
    "cachedChannelName",
  ]);

  if (cachedChannelName !== channelName) {
    channelId = null;
  }

  if (!channelId) {
    const fetchAllChannels = async () => {
      const channelTypes = ["public_channel", "private_channel"];
      const promises = channelTypes.map((type) =>
        fetch(`${SLACK_CONVERSATIONS_LIST_URL}?types=${type}`, {
          headers: { Authorization: `Bearer ${slackToken}` },
        }).then((res) => res.json())
      );

      const results = await Promise.all(promises);
      let allChannels = [];
      for (const result of results) {
        if (result.ok) {
          allChannels = allChannels.concat(result.channels);
        } else {
          // console.error('Error fetching channels:', result.error);
        }
      }
      return allChannels;
    };

    const allChannels = await fetchAllChannels();
    const foundChannel = allChannels.find((c) => c.name === channelName);

    if (!foundChannel) {
      // console.error(`Channel "${channelName}" not found in public or private channels.`);
      throw new Error("channel_not_found");
    }

    channelId = foundChannel.id;
    await chrome.storage.local.set({
      channelId,
      cachedChannelName: channelName,
    });
  }
  return channelId;
}

async function fetchSlackHistory(slackToken, channelId, lastFetchTs) {
  const historyUrl = new URL(SLACK_CONVERSATIONS_HISTORY_URL);
  historyUrl.searchParams.append("channel", channelId);
  if (lastFetchTs) {
    historyUrl.searchParams.append("oldest", lastFetchTs);
  }
  historyUrl.searchParams.append("limit", 100);

  const historyResponse = await fetch(historyUrl, {
    headers: { Authorization: `Bearer ${slackToken}` },
  });
  const historyData = await historyResponse.json();
  if (!historyData.ok) throw new Error(historyData.error);
  return historyData;
}

async function processAndStoreMessages(historyData, slackToken) {
  if (historyData.messages && historyData.messages.length > 0) {
    const newMessages = historyData.messages.map((msg) => ({
      user: msg.user,
      text: msg.text,
      ts: msg.ts,
    }));
    const newLastFetchTs = newMessages[0].ts;

    const userIds = [
      ...new Set(newMessages.map((msg) => msg.user).filter(Boolean)),
    ];
    await fetchAndCacheUserProfiles(slackToken, userIds);

    let { messages: storedMessages = [] } = await chrome.storage.local.get(
      "messages"
    );
    storedMessages.push(...newMessages.reverse());

    if (storedMessages.length > MAX_MESSAGES) {
      storedMessages = storedMessages.slice(
        storedMessages.length - MAX_MESSAGES
      );
    }

    await chrome.storage.local.set({
      messages: storedMessages,
      lastFetchTs: newLastFetchTs,
    });

    const {
      currentAllowedPhrases,
      currentDisallowedPhrases,
      currentExceptionPhrases,
    } = await getPhrasesFromStorage();

    const { status: mergeStatus, message: matchingMessage } =
      determineMergeStatus(
        storedMessages,
        currentAllowedPhrases,
        currentDisallowedPhrases,
        currentExceptionPhrases
      );

    updateExtensionIcon(mergeStatus);
    await chrome.storage.local.set({ lastMatchingMessage: matchingMessage });
  } else {
    // If no new messages, re-evaluate status based on existing messages
    const { messages: currentMessages = [] } = await chrome.storage.local.get(
      "messages"
    );
    const {
      currentAllowedPhrases,
      currentDisallowedPhrases,
      currentExceptionPhrases,
    } = await getPhrasesFromStorage();

    const { status: mergeStatus, message: matchingMessage } =
      determineMergeStatus(
        currentMessages,
        currentAllowedPhrases,
        currentDisallowedPhrases,
        currentExceptionPhrases
      );
    updateExtensionIcon(mergeStatus);
    await chrome.storage.local.set({ lastMatchingMessage: matchingMessage });
  }
}

async function getPhrasesFromStorage() {
  const { allowedPhrases, disallowedPhrases, exceptionPhrases } =
    await chrome.storage.sync.get([
      "allowedPhrases",
      "disallowedPhrases",
      "exceptionPhrases",
    ]);

  const currentAllowedPhrases = allowedPhrases
    ? allowedPhrases.split(",")
    : DEFAULT_ALLOWED_PHRASES;

  const currentDisallowedPhrases = disallowedPhrases
    ? disallowedPhrases.split(",")
    : DEFAULT_DISALLOWED_PHRASES;

  const currentExceptionPhrases = exceptionPhrases
    ? exceptionPhrases.split(",")
    : DEFAULT_EXCEPTION_PHRASES;

  return {
    currentAllowedPhrases,
    currentDisallowedPhrases,
    currentExceptionPhrases,
  };
}

async function handleSlackApiError(error) {
  // console.error('Error fetching Slack messages:', error.message);
  const errorMessage = error.message;

  if (
    errorMessage.includes("channel_not_found") ||
    errorMessage.includes("not_in_channel")
  ) {
    await chrome.storage.local.set({
      appStatus: "CHANNEL_ERROR",
      messages: [],
      channelId: null,
    });
  } else if (
    errorMessage.includes("invalid_auth") ||
    errorMessage.includes("token_revoked")
  ) {
    await chrome.storage.local.set({
      appStatus: "TOKEN_TOKEN_ERROR",
      messages: [],
    });
  } else {
    await chrome.storage.local.set({
      appStatus: "UNKNOWN_ERROR",
      messages: [],
    });
  }
  updateExtensionIcon("error");
}

async function updateContentScriptMergeState(channelName) {
  const { messages: currentMessages = [], appStatus } =
    await chrome.storage.local.get(["messages", "appStatus"]);
  const lastSlackMessage =
    currentMessages.length > 0
      ? currentMessages[currentMessages.length - 1]
      : null;

  const {
    currentAllowedPhrases,
    currentDisallowedPhrases,
    currentExceptionPhrases,
  } = await getPhrasesFromStorage();

  let mergeStatusForContentScript = "unknown";
  let matchingMessageForContentScript = null;
  if (currentMessages.length > 0) {
    const { status, message } = determineMergeStatus(
      currentMessages,
      currentAllowedPhrases,
      currentDisallowedPhrases,
      currentExceptionPhrases
    );
    mergeStatusForContentScript = status;
    matchingMessageForContentScript = message;
  }

  // If there's an error status, ensure the merge button is enabled (or not disabled by the extension)
  if (
    appStatus &&
    (appStatus.includes("ERROR") || appStatus.includes("TOKEN"))
  ) {
    // If there's an error, we don't want the extension to prevent merging.
    // So, we set the status to 'allowed' for the content script.
    mergeStatusForContentScript = "allowed";
  }

  await chrome.storage.local.set({
    lastKnownMergeState: {
      isMergeDisabled:
        mergeStatusForContentScript === "disallowed" ||
        mergeStatusForContentScript === "exception", // Bitbucket only cares if it's disabled or not
      mergeStatus: mergeStatusForContentScript, // New field for more granular status
      lastSlackMessage: matchingMessageForContentScript, // Use the matching message
      channelName: channelName,
    },
  });

  try {
    await chrome.runtime.sendMessage({ action: "updateMessages" });
  } catch (error) {
    console.warn(
      "Could not send message to popup, it might not be open:",
      error.message
    );
  }
  if (bitbucketTabId) {
    try {
      await chrome.tabs.sendMessage(bitbucketTabId, {
        action: "updateMergeButton",
        lastSlackMessage: lastSlackMessage,
        channelName: channelName,
        isMergeDisabled:
          mergeStatusForContentScript === "disallowed" ||
          mergeStatusForContentScript === "exception",
        mergeStatus: mergeStatusForContentScript, // Pass granular status to content script
      });
    } catch (error) {
      console.warn(
        "Could not send message to Bitbucket tab, resetting bitbucketTabId:",
        error.message
      );
      bitbucketTabId = null;
    }
  }
}

async function fetchAndStoreTeamId(slackToken) {
  try {
    const response = await fetch("https://slack.com/api/auth.test", {
      headers: { Authorization: `Bearer ${slackToken}` },
    });
    const data = await response.json();
    if (data.ok) {
      await chrome.storage.local.set({ teamId: data.team_id });
    } else {
      console.error("Error fetching team ID:", data.error);
    }
  } catch (error) {
    console.error("Error fetching team ID:", error);
  }
}

async function fetchAndStoreMessages() {
  updateExtensionIcon("loading");
  let channelName = "";

  try {
    const { slackToken, channelName: configChannelName } =
      await chrome.storage.sync.get(["slackToken", "channelName"]);

    if (!slackToken || !configChannelName) {
      await chrome.storage.local.set({
        appStatus: "CONFIG_ERROR",
        messages: [],
      });
      updateExtensionIcon("default");
      return;
    }

    channelName = configChannelName;

    await fetchAndStoreTeamId(slackToken);

    const channelId = await resolveChannelId(slackToken, channelName);
    const { lastFetchTs } = await chrome.storage.local.get("lastFetchTs");
    const historyData = await fetchSlackHistory(
      slackToken,
      channelId,
      lastFetchTs
    );

    await chrome.storage.local.set({ appStatus: "OK" });
    await processAndStoreMessages(historyData, slackToken);
  } catch (error) {
    await handleSlackApiError(error);
  } finally {
    await updateContentScriptMergeState(channelName);
  }
}

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  if (request.action === "getDefaultPhrases") {
    sendResponse({
      defaultAllowedPhrases: DEFAULT_ALLOWED_PHRASES,
      defaultDisallowedPhrases: DEFAULT_DISALLOWED_PHRASES,
      defaultExceptionPhrases: DEFAULT_EXCEPTION_PHRASES,
    });
    return true; // Indicates that sendResponse will be called asynchronously
  } else if (request.action === "bitbucketTabLoaded" && sender.tab) {
    const { bitbucketUrl } = await chrome.storage.sync.get("bitbucketUrl");
    if (bitbucketUrl) {
      // Convert glob to regex. This is a simplified conversion.
      // For a full robust solution, a dedicated glob-to-regex library would be ideal.
      const regexPattern = bitbucketUrl.replace(/\*/g, ".*"); // Escape * for regex
      const bitbucketRegex = new RegExp(regexPattern);

      if (bitbucketRegex.test(sender.tab.url)) {
        bitbucketTabId = sender.tab.id;

        // Send the last known merge state immediately to the newly loaded tab
        chrome.storage.local.get(["lastKnownMergeState"], async (result) => {
          if (result.lastKnownMergeState) {
            const { isMergeDisabled, lastSlackMessage, channelName } =
              result.lastKnownMergeState;
            try {
              await chrome.tabs.sendMessage(bitbucketTabId, {
                action: "updateMergeButton",
                lastSlackMessage: lastSlackMessage,
                channelName: channelName,
                isMergeDisabled: isMergeDisabled,
              });
            } catch (error) {
              console.warn(
                "Could not send initial message to Bitbucket tab, resetting bitbucketTabId:",
                error.message
              );
              bitbucketTabId = null;
            }
          }
        });
      }
    }
  }
});

chrome.alarms.create(POLLING_ALARM_NAME, {
  periodInMinutes: 1 / 12, // 5 seconds
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === POLLING_ALARM_NAME) {
    fetchAndStoreMessages();
  }
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get('mergeButtonSelector', (result) => {
    if (!result.mergeButtonSelector) {
      chrome.storage.sync.set({ mergeButtonSelector: DEFAULT_MERGE_BUTTON_SELECTOR });
    }
  });
  fetchAndStoreMessages();
  registerBitbucketContentScript();
});

chrome.runtime.onStartup.addListener(() => {
  fetchAndStoreMessages();
  registerBitbucketContentScript();
});

async function registerBitbucketContentScript() {
  const { bitbucketUrl } = await chrome.storage.sync.get("bitbucketUrl");

  // Clear existing dynamic scripts to avoid duplicates or old patterns
  try {
    await chrome.scripting.unregisterContentScripts({
      ids: ["bitbucket-content-script"],
    });
  } catch (e) {
    // Ignore error if script was not registered
  }

  if (bitbucketUrl) {
    try {
      await chrome.scripting.registerContentScripts([
        {
          id: "bitbucket-content-script",
          matches: [bitbucketUrl],
          js: ["slack_frontend_closure_bitbucket_content.js"],
          runAt: "document_idle",
        },
      ]);
      console.log("Bitbucket content script registered for:", bitbucketUrl);
    } catch (error) {
      console.error("Error registering Bitbucket content script:", error);
    }
  }
}

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === "sync" && changes.bitbucketUrl) {
    registerBitbucketContentScript();
  }
});
