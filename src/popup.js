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
    const { messages = [] } = await chrome.storage.local.get("messages");

    if (messages.length === 0) {
      updateUI("loading", "Waiting for messages...");
      return;
    }

    // Keywords for different states
    const exceptionKeywords = [
      "allowed to merge this task",
      "do not merge these projects",
    ];
    const disallowedKeywords = [
      "not allowed to merge",
      ":octagonal_sign:",
      ":alert:",
    ];
    const allowedKeywords = ["allowed to merge", ":check1:"];

    let status = "unknown"; // Default status

    // Iterate through messages from newest to oldest
    for (let i = messages.length - 1; i >= 0; i--) {
      const messageText = (messages[i].text || "").toLowerCase();

      if (exceptionKeywords.some((keyword) => messageText.includes(keyword))) {
        status = "exception";
        break;
      }
      if (disallowedKeywords.some((keyword) => messageText.includes(keyword))) {
        status = "disallowed";
        break;
      }
      if (allowedKeywords.some((keyword) => messageText.includes(keyword))) {
        status = "allowed";
        break;
      }
    }

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
