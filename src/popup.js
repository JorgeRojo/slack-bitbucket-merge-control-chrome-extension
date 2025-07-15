document.addEventListener("DOMContentLoaded", async () => {
  const statusIcon = document.getElementById("status-icon");
  const statusText = document.getElementById("status-text");

  function updateUI(state, message) {
    statusIcon.className = state;
    statusText.className = state;

    switch (state) {
      case "allowed":
        statusIcon.textContent = "✅";
        statusText.textContent = message || "Merge allowed";
        break;
      case "disallowed":
        statusIcon.textContent = "❌";
        statusText.textContent = message || "Merge not allowed";
        break;
      case "exception":
        statusIcon.textContent = "⚠️";
        statusText.textContent = message || "Allowed with exceptions";
        break;
      default:
        statusIcon.textContent = "❓";
        statusText.textContent = message || "Could not determine";
        break;
    }
  }

  try {
    const { lastKnownMergeState } = await chrome.storage.local.get("lastKnownMergeState");

    if (!lastKnownMergeState || !lastKnownMergeState.mergeStatus) {
      updateUI("loading", "Waiting for status...");
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
