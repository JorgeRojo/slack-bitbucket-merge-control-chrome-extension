const SLACK_CONVERSATIONS_LIST_URL = "https://slack.com/api/conversations.list";
const SLACK_CONVERSATIONS_HISTORY_URL =
  "https://slack.com/api/conversations.history";
const SLACK_USERS_LIST_URL = "https://slack.com/api/users.list";

const POLLING_ALARM_NAME = "slack-poll-alarm";
const MAX_MESSAGES = 100;
const DEFAULT_ALLOWED_PHRASES = [
  ":check1: allowed to merge",
  "it's allowed to merge",
  "merged. no restrictions on merging.",
];
const DEFAULT_DISALLOWED_PHRASES = [
  ":octagonal_sign: not allowed to merge",
  "not allowed to merge",
  "do not merge without consent",
  "do not merge in",
  "closing versions. do not merge",
  "ask me before merging",
];
const DEFAULT_EXCEPTION_PHRASES = [
  "it will be allowed to merge this task:",
  "except everything related to:",
  "allowed to merge in all projects except",
  "merge is allowed except",
  ":alert: do not merge these projects:",
];

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

function determineMergeStatus(messageText, allowedPhrases, disallowedPhrases, exceptionPhrases) {
  const normalizedMessageText = normalizeText(messageText);

  const currentAllowedPhrases = allowedPhrases.map(phrase => normalizeText(phrase));
  const currentDisallowedPhrases = disallowedPhrases.map(phrase => normalizeText(phrase));
  const currentExceptionPhrases = exceptionPhrases.map(phrase => normalizeText(phrase));

  let status = "unknown";

  if (currentExceptionPhrases.some(keyword => normalizedMessageText.includes(keyword))) {
    status = "exception";
  } else if (currentDisallowedPhrases.some(keyword => normalizedMessageText.includes(keyword))) {
    status = "disallowed";
  } else if (currentAllowedPhrases.some(keyword => normalizedMessageText.includes(keyword))) {
    status = "allowed";
  }

  return status;
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
      path16 = "images/icon16.png"; // Default icon
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

async function getSlackConfig() {
  const { slackToken, channelName } = await chrome.storage.sync.get([
    "slackToken",
    "channelName",
  ]);
  if (!slackToken || !channelName) {
    throw new Error("Slack token or channel name not configured.");
  }
  return { slackToken, channelName };
}

async function fetchAndCacheUserProfiles(slackToken, userIds) {
  let { userProfiles = {} } = await chrome.storage.local.get("userProfiles");
  const newUsersToFetch = userIds.filter((id) => !userProfiles[id]);

  if (newUsersToFetch.length === 0) return;

  // users.list is a Tier 3 endpoint, so it's better to fetch all once
  // than using users.info multiple times.
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

    // Fetch user profiles for new messages
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

    // Determine merge status based on the latest message and configurable phrases
    const {
      currentAllowedPhrases,
      currentDisallowedPhrases,
      currentExceptionPhrases,
    } = await getPhrasesFromStorage();

    const mergeStatus = determineMergeStatus(
      newMessages[0].text,
      currentAllowedPhrases,
      currentDisallowedPhrases,
      currentExceptionPhrases
    );

    updateExtensionIcon(mergeStatus);
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

    const mergeStatus = determineMergeStatus(
      currentMessages.length > 0
        ? currentMessages[currentMessages.length - 1].text
        : "",
      currentAllowedPhrases,
      currentDisallowedPhrases,
      currentExceptionPhrases
    );
    updateExtensionIcon(mergeStatus);
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
  if (lastSlackMessage) {
    mergeStatusForContentScript = determineMergeStatus(
      lastSlackMessage.text,
      currentAllowedPhrases,
      currentDisallowedPhrases,
      currentExceptionPhrases
    );
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
      lastSlackMessage: lastSlackMessage,
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

async function fetchAndStoreMessages() {
  updateExtensionIcon("loading");
  let channelName = "";

  try {
    const config = await getSlackConfig();
    const { slackToken, channelName: configChannelName } = config;
    channelName = configChannelName;

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
          js: ["bitbucket_content.js"],
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