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
        statusIcon.textContent = "✅";
        statusText.textContent = message;
        break;
      case "disallowed":
        statusIcon.textContent = "❌";
        statusText.textContent = message;
        break;
      case "exception":
        statusIcon.textContent = "⚠️";
        statusText.textContent = message;
        slackChannelLink.style.display = "block"; // Show link for exceptions
        break;
      case "config_needed":
        statusIcon.textContent = "❓";
        statusText.textContent = message;
        openOptionsButton.style.display = "block";
        break;
      default:
        statusIcon.textContent = "❓";
        statusText.textContent = message || "Could not determine";
        break;
    }

    if (matchingMessage) {
      matchingMessageDiv.textContent = `Matching message: "${matchingMessage.text}"`;
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

    const { channelId } = await chrome.storage.local.get("channelId");

    if (!slackToken || !channelName) {
      updateUI("config_needed", "Slack token or channel name not configured.");
      return;
    }

    // Set Slack channel link if channelId is available
    if (channelId) {
      slackChannelLink.href = `slack://channel?team=&id=${channelId}`;
    }

    const { lastKnownMergeState } = await chrome.storage.local.get(
      "lastKnownMergeState"
    );

    if (!lastKnownMergeState || !lastKnownMergeState.mergeStatus) {
      updateUI("loading");
      return;
    }

    const status = lastKnownMergeState.mergeStatus;
    const lastSlackMessage = lastKnownMergeState.lastSlackMessage;

    if (status === "exception") {
      updateUI("exception", "Allowed with exceptions", lastSlackMessage);
    } else if (status === "allowed") {
      updateUI("allowed", "Merge allowed", lastSlackMessage);
    } else if (status === "disallowed") {
      updateUI("disallowed", "Merge not allowed", lastSlackMessage);
    } else {
      updateUI("unknown", "Could not determine status");
    }
  } catch (error) {
    console.error("Error processing messages:", error);
    updateUI("disallowed", "Error processing messages");
  }
});
