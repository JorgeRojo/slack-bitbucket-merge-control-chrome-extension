// bitbucket_content.js

console.log("Bitbucket content script loaded and running.");

// Send a message to the background script when the content script loads
chrome.runtime.sendMessage({ action: "bitbucketTabLoaded" });

let mergeButtonObserver = null; // To store the MutationObserver

// Function to apply the merge button logic
function applyMergeButtonLogic(isMergeDisabled, lastSlackMessage, channelName) {
  const mergeButton = document.querySelector(".merge-button");

  if (mergeButton) {
    if (isMergeDisabled) {
      console.log("Condition 'Merge Disabled' met. Modifying merge button.");
      mergeButton.style.backgroundColor = "#ef445e";
      mergeButton.style.color = "white";
      mergeButton.style.cursor = "not-allowed"; // Indicate it's disabled

      // Add custom click handler if not already added
      if (!mergeButton._customMergeHandler) {
        mergeButton._customMergeHandler = (event) => {
          event.preventDefault(); // Stop the default merge action
          event.stopImmediatePropagation(); // Stop other handlers from running
          const cleanedSlackMessage = lastSlackMessage.text
            .replace(/:\w+:/g, "")
            .replace(/<[^>]+>/g, "")
            .trim();
          alert(
            `Merge function is disabled from Slack.\nNotified from channel: #${channelName}\nSlack message: 
 ${cleanedSlackMessage}`
          );
        };
        // Use capture phase to ensure it runs before other handlers
        mergeButton.addEventListener("click", mergeButton._customMergeHandler, true);
      }

    } else {
      console.log("Condition 'Merge Enabled' met. Restoring merge button.");
      // Reset to default or remove custom styling if condition is not met
      mergeButton.style.backgroundColor = ''; // Remove custom background
      mergeButton.style.color = ''; // Remove custom text color
      mergeButton.style.cursor = ''; // Remove custom cursor

      // Remove custom click handler if it was added
      if (mergeButton._customMergeHandler) {
        mergeButton.removeEventListener("click", mergeButton._customMergeHandler, true);
        mergeButton._customMergeHandler = null;
      }
    }
  } else {
    console.log("Merge button not found on this page.");
  }
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "updateMergeButton") {
    console.log("Received updateMergeButton message:", request);
    applyMergeButtonLogic(request.isMergeDisabled, request.lastSlackMessage, request.channelName);
  }
});

// Observe the DOM for the merge button
function observeMergeButton() {
  const targetNode = document.body; // Observe the entire body
  const config = { childList: true, subtree: true }; // Watch for direct children and descendants

  const callback = function(mutationsList, observer) {
    for(const mutation of mutationsList) {
      if (mutation.type === 'childList') {
        const mergeButton = document.querySelector('.merge-button');
        if (mergeButton) {
          console.log("Merge button found by observer.");
          observer.disconnect(); // Stop observing once found
          // Get the last known state and apply logic
          chrome.storage.local.get(['lastKnownMergeState'], (result) => {
            if (result.lastKnownMergeState) {
              const { isMergeDisabled, lastSlackMessage, channelName } = result.lastKnownMergeState;
              console.log("Applying initial merge button logic from stored state via observer.", result.lastKnownMergeState);
              applyMergeButtonLogic(isMergeDisabled, lastSlackMessage, channelName);
            }
          });
          break; // Exit loop once button is found and processed
        }
      }
    }
  };

  mergeButtonObserver = new MutationObserver(callback);
  mergeButtonObserver.observe(targetNode, config);
  console.log("MutationObserver started for merge button.");
}

// Start observing when the content script loads
observeMergeButton();
