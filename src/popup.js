document.addEventListener("DOMContentLoaded", function () {
  const statusMessageDiv = document.getElementById("status-message");

  function openOptionsPage() {
    chrome.runtime.openOptionsPage();
  }

  function handleConfigurationError(statusMessageDiv) {
    statusMessageDiv.innerHTML =
      'Please configure your Slack Token and Channel Name in the <a href="#" id="openOptions">extension options</a>.';
    statusMessageDiv.className = "status-error";
    document
      .getElementById("openOptions")
      .addEventListener("click", openOptionsPage);
  }

  function getDisplayMessageAndClass(appStatus, messages, channelName) {
    let displayMessage = "";
    let messageClass = "";

    switch (appStatus) {
      case "OK":
        const lastMessageText =
          messages.length > 0 ? messages[messages.length - 1].text : "";
        if (lastMessageText.includes("Not allowed")) {
          const cleanedSlackMessage = lastMessageText
            .replace(/:\w+:/g, "")
            .trim();
          displayMessage = `Merge is <span class="status-word disabled-word">DISABLED</span>.\nChannel: #${channelName}\nMessage: ${cleanedSlackMessage}`;
          messageClass = "status-disabled";
        } else {
          displayMessage = `Merge is <span class="status-word enabled-word">ENABLED</span>.\nChannel: #${channelName}`;
          messageClass = "status-ok";
        }
        break;
      case "CHANNEL_ERROR":
        displayMessage = `Error: Channel '${channelName}' not found, or bot not a member.`;
        messageClass = "status-error";
        break;
      case "TOKEN_ERROR":
        displayMessage =
          'Error: Invalid Slack Token. Please check <a href="#" id="openOptions">options</a>.';
        messageClass = "status-error";
        break;
      case "UNKNOWN_ERROR":
        displayMessage = "An unknown error occurred. Check extension logs.";
        messageClass = "status-error";
        break;
      default:
        displayMessage = "Loading status...";
        messageClass = "";
        break;
    }
    return { displayMessage, messageClass };
  }

  async function updateDisplay() {
    const syncResult = await chrome.storage.sync.get([
      "slackToken",
      "channelName",
    ]);
    const { slackToken, channelName = "Not Set" } = syncResult;

    if (!slackToken || channelName === "Not Set") {
      handleConfigurationError(statusMessageDiv);
      return;
    }

    const localResult = await chrome.storage.local.get([
      "messages",
      "appStatus",
    ]);
    const { messages = [], appStatus } = localResult;

    const { displayMessage, messageClass } = getDisplayMessageAndClass(
      appStatus,
      messages,
      channelName
    );

    statusMessageDiv.innerHTML = displayMessage.replace(/\n/g, "<br>"); // Replace newlines with <br> for HTML
    statusMessageDiv.className = messageClass;

    if (displayMessage.includes("openOptions")) {
      document
        .getElementById("openOptions")
        .addEventListener("click", openOptionsPage);
    }
  }

  function initializePopup() {
    // Initial load
    updateDisplay();

    // Listen for updates from the background script
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === "updateMessages") {
        updateDisplay();
      }
    });
  }

  initializePopup();
});
