document.addEventListener("DOMContentLoaded", async () => {
  const statusMessageDiv = document.getElementById("status-message");
  const messagesContainer = document.getElementById("messages-container");
  const messagesTextarea = document.createElement("textarea"); // Create the textarea
  function renderStatus(state) {
    if (!state) {
      statusMessageDiv.textContent = "Loading...";
      statusMessageDiv.className = "";
      return;
    }

    const { appStatus, lastKnownMergeState } = state;
    const { isMergeDisabled, channelName } = lastKnownMergeState || {};

    if (appStatus && appStatus.includes("ERROR")) {
      statusMessageDiv.className = "status-error";
      if (appStatus === "CHANNEL_ERROR") {
        statusMessageDiv.innerHTML = `Error: Canal no encontrado. Revisa las <a href="options.html" target="_blank">opciones</a>.`;
      } else if (appStatus === "TOKEN_ERROR") {
        statusMessageDiv.innerHTML = `Error: Token de Slack inválido. Revisa las <a href="options.html" target="_blank">opciones</a>.`;
      } else {
        statusMessageDiv.innerHTML = `Error desconocido. Revisa las <a href="options.html" target="_blank">opciones</a>.`;
      }
      return;
    }

    if (isMergeDisabled === undefined) {
      statusMessageDiv.textContent = "Awaiting first check...";
      statusMessageDiv.className = "";
      return;
    }

    if (isMergeDisabled) {
      statusMessageDiv.innerHTML = `Merge: <span class="status-word disabled-word">DISABLED</span> en #${channelName}`;
      statusMessageDiv.className = "status-disabled";
    } else {
      statusMessageDiv.innerHTML = `Merge: <span class="status-word enabled-word">ENABLED</span> in #${channelName}`;
      statusMessageDiv.className = "status-ok";
    }
  }

  async function renderMessages() {
    let { messages = [], userProfiles = {} } = await chrome.storage.local.get([
      "messages",
      "userProfiles",
    ]);

    messagesContainer.innerHTML = ""; // Clear previous messages
    if (messages.length === 0) {
      return;
    }

    messagesContainer.appendChild(messagesTextarea);
    messagesTextarea.id = "messages-textarea"; // Set the ID for styling
    messagesTextarea.readOnly = true; // Make it read-only

    // Calculate the timestamp for 20 days ago
    const twentyDaysAgo = new Date();
    twentyDaysAgo.setDate(twentyDaysAgo.getDate() - 40);
    const twentyDaysAgoTimestamp = twentyDaysAgo.getTime() / 1000; // Slack's ts is in seconds

    // Filter for recent messages and display in reverse chronological order (newest first)
    const recentMessages = messages
      .slice()
      .reverse()
      .filter((msg) => parseFloat(msg.ts) >= twentyDaysAgoTimestamp);

    let allMessagesText = "";
    recentMessages.forEach((msg) => {
      const messageDate = new Date(parseFloat(msg.ts) * 1000);
      const dateString = messageDate.toLocaleDateString();
      const timeString = messageDate.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });

      // A simple way to replace user mentions like <@U12345>
      const processedText = (msg.text || "").replace(
        /<@(\w+)>/g,
        (match, userId) => {
          const mentionedUser = userProfiles[userId];
          return mentionedUser ? `@${mentionedUser.name}` : match;
        }
      );

      allMessagesText += `(${dateString} - ${timeString}):\n${processedText}\n\n`;
    });

    messagesTextarea.value = allMessagesText.trim();

    // Make the textarea fill the container and adjust scroll
    messagesTextarea.style.height = `${messagesContainer.clientHeight}px`;

    // Optional: Select all text when clicking inside for easy copying
    messagesTextarea.addEventListener("focus", () => {
      messagesTextarea.select();
    });

    // Disable scroll synchronization if you don't need it
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  async function updatePopup() {
    const { lastKnownMergeState, appStatus } = await chrome.storage.local.get([
      "lastKnownMergeState",
      "appStatus",
    ]);
    renderStatus({ lastKnownMergeState, appStatus });
    await renderMessages();
  }

  // Add a listener for links in the status message to open the options page
  document.body.addEventListener("click", (event) => {
    if (
      event.target.tagName === "A" &&
      event.target.href.includes("options.html")
    ) {
      event.preventDefault();
      chrome.runtime.openOptionsPage();
    }
  });

  chrome.runtime.onMessage.addListener(
    (request) => request.action === "updateMessages" && updatePopup()
  );
  updatePopup(); // Initial load
});
