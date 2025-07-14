// bitbucket_content.js

console.log("Bitbucket content script loaded and running.");

// Send a message to the background script when the content script loads
chrome.runtime.sendMessage({ action: "bitbucketTabLoaded" });

let originalMergeButtonHtml = null; // To store the original button's HTML

// Function to create the disabled merge button
function createDisabledMergeButton(slackMessageText, channelName) {
  const newButton = document.createElement("button");
  // Copy classes and other attributes from the original button for consistent styling
  const originalButton = document.querySelector(".merge-button");
  if (originalButton) {
    // Copy all attributes
    for (let i = 0; i < originalButton.attributes.length; i++) {
      const attr = originalButton.attributes[i];
      newButton.setAttribute(attr.name, attr.value);
    }
    // Ensure it has the merge-button class
    if (!newButton.classList.contains("merge-button")) {
      newButton.classList.add("merge-button");
    }
  } else {
    // Fallback classes if original not found (shouldn't happen if we're replacing it)
    newButton.setAttribute("type", "button");
    newButton.setAttribute("tabindex", "0");
  }

  const span = document.createElement("span");
  span.classList.add("css-19r5em7"); // Example class
  span.textContent = "Merge";
  newButton.innerHTML = ""; // Clear existing content
  newButton.appendChild(span);

  newButton.style.backgroundColor = "#ef445e";
  newButton.style.color = "white";
  newButton.style.cursor = "not-allowed"; // Indicate it's disabled

  newButton.addEventListener("click", (event) => {
    event.preventDefault();
    const cleanedSlackMessage = slackMessageText
      .replace(/:\w+:/g, "")
      .replace(/<[^>]+>/g, "")
      .trim();
    alert(
      `Merge function is disabled from Slack.\nNotified from channel: #${channelName}\nSlack message: ${cleanedSlackMessage}`
    );
  });
  return newButton;
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "updateMergeButton" && request.lastSlackMessage) {
    const lastMessageText = request.lastSlackMessage.text;
    const channelName = request.channelName; // Get channel name
    console.log("Received last Slack message:", lastMessageText);

    const mergeButton = document.querySelector(".merge-button");

    if (mergeButton) {
      // Store original button HTML if not already stored
      if (!originalMergeButtonHtml) {
        originalMergeButtonHtml = mergeButton.outerHTML;
        console.log("Original merge button HTML stored.");
      }

      if (lastMessageText && lastMessageText.includes("Not allowed")) {
        console.log("Condition 'Not allowed' met. Replacing merge button.");
        // Check if it's already the custom button to avoid re-replacing
        if (!mergeButton.classList.contains("custom-disabled-merge-button")) {
          // Add a unique class to the custom button
          const newButton = createDisabledMergeButton(
            lastMessageText,
            channelName
          );
          newButton.classList.add("custom-disabled-merge-button"); // Mark it as custom
          mergeButton.parentNode.replaceChild(newButton, mergeButton);
        }
      } else {
        console.log(
          "Condition 'Not allowed' not met. Restoring original merge button."
        );
        // Check if it's currently the custom button before restoring
        if (mergeButton.classList.contains("custom-disabled-merge-button")) {
          const tempDiv = document.createElement("div");
          tempDiv.innerHTML = originalMergeButtonHtml;
          const originalButton = tempDiv.firstElementChild;
          mergeButton.parentNode.replaceChild(originalButton, mergeButton);
        }
      }
    } else {
      console.log("Merge button not found on this page.");
      // If the button is not found, it might be because it was replaced and we are trying to find the original again.
      // Or the page structure changed.
      // For now, assume it's the replacement logic.
    }
  }
});
