import { SLACK_BASE_URL } from './constants.js';
import { literals } from './literals.js';
document.addEventListener("DOMContentLoaded", async () => {
  const statusIcon = document.getElementById("status-icon");
  const statusText = document.getElementById("status-text");
  const openOptionsButton = document.getElementById("open-options");
  const slackChannelLink = document.getElementById("slack-channel-link");
  const matchingMessageDiv = document.getElementById("matching-message");

  function updateUI(state, message, matchingMessage = null) {
    statusIcon.className = state;
    statusText.className = state;

    openOptionsButton.style.display = "none";
    slackChannelLink.style.display = "none"; // Hide by default
    matchingMessageDiv.style.display = "none"; // Hide by default

    switch (state) {
      case "allowed":
        statusIcon.textContent = literals.emojiAllowed;
        statusText.textContent = message;
        break;
      case "disallowed":
        statusIcon.textContent = literals.emojiDisallowed;
        statusText.textContent = message;
        break;
      case "exception":
        statusIcon.textContent = literals.emojiException;
        statusText.textContent = message;
        slackChannelLink.style.display = "block"; // Show link for exceptions
        break;
      case "config_needed":
        statusIcon.textContent = literals.emojiUnknown;
        statusText.textContent = message;
        openOptionsButton.style.display = "block";
        break;
      default:
        statusIcon.textContent = literals.emojiUnknown;
        statusText.textContent = message || literals.textCouldNotDetermine;
        break;
    }

    if (matchingMessage) {
      matchingMessageDiv.textContent = `${literals.textMatchingMessagePrefix}${matchingMessage.text}"`;
      matchingMessageDiv.style.display = "block";
    }
  }

  openOptionsButton.addEventListener("click", () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL("options.html"));
    }
  });

  try {
    const { slackToken, channelName } = await chrome.storage.sync.get([
      "slackToken",
      "channelName",
    ]);

    const { channelId, teamId } = await chrome.storage.local.get(["channelId", "teamId"]);

    if (!slackToken || !channelName) {
      updateUI("config_needed", literals.textConfigNeeded);
      return;
    }

    // Set Slack channel link if channelId and teamId are available
    if (channelId && teamId) {
      slackChannelLink.href = `${SLACK_BASE_URL}${teamId}/${channelId}`;
    }

    const { lastKnownMergeState } = await chrome.storage.local.get(
      "lastKnownMergeState"
    );

    if (!lastKnownMergeState || !lastKnownMergeState.mergeStatus) {
      updateUI("loading");
      statusText.textContent = literals.textWaitingMessages;
      return;
    }

    const status = lastKnownMergeState.mergeStatus;
    const lastSlackMessage = lastKnownMergeState.lastSlackMessage;

    if (status === "exception") {
      updateUI("exception", literals.textAllowedWithExceptions, lastSlackMessage);
    } else if (status === "allowed") {
      updateUI("allowed", literals.textMergeAllowed, lastSlackMessage);
    } else if (status === "disallowed") {
      updateUI("disallowed", literals.textMergeNotAllowed, lastSlackMessage);
    } else {
      updateUI("unknown", literals.textCouldNotDetermineStatus);
    }
  } catch (error) {
    console.error("Error processing messages:", error);
    updateUI("disallowed", literals.textErrorProcessingMessages);
  }
});
