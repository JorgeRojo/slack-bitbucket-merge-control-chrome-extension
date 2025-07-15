document.addEventListener("DOMContentLoaded", async () => {
  const statusIcon = document.getElementById("status-icon");
  const statusText = document.getElementById("status-text");
  const openOptionsButton = document.getElementById("open-options");

  function updateUI(state, message) {
    statusIcon.className = state;
    statusText.className = state;

    openOptionsButton.style.display = "none";

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

    if (!slackToken || !channelName) {
      updateUI("config_needed", "Slack token or channel name not configured.");
      return;
    }

    const { lastKnownMergeState } = await chrome.storage.local.get(
      "lastKnownMergeState"
    );

    if (!lastKnownMergeState || !lastKnownMergeState.mergeStatus) {
      updateUI("loading");
      return;
    }

    const status = lastKnownMergeState.mergeStatus;

    if (status === "exception") {
      updateUI("exception", "Allowed with exceptions");
    } else if (status === "allowed") {
      updateUI("allowed", "Merge allowed");
    } else if (status === "disallowed") {
      updateUI("disallowed", "Merge not allowed");
    } else {
      updateUI("unknown", "Could not determine status");
    }
  } catch (error) {
    console.error("Error processing messages:", error);
    updateUI("disallowed", "Error processing messages");
  }
});
