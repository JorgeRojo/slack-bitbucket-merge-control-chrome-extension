# Feature 002: Update help.html with Detailed Slack App Configuration Guide

[GitHub Issue #44](https://github.com/JorgeRojo/slack-bitbucket-merge-control-chrome-extension/issues/44)

## Component
`src/modules/options/help.html`

## Date Requested
2025-07-30

## Priority
High

## Description
The current setup guide in `src/modules/options/help.html` is not detailed enough. Users may struggle to correctly configure the required Slack application, find the right scopes, and generate the two necessary tokens (`xoxb-` and `xapp-`). This creates a high barrier to entry and can lead to configuration errors and user frustration.

--- 

The `help.html` file should be updated with a new, comprehensive guide that walks the user through the entire setup process step-by-step.

The new content should clearly explain how to:
1. Create a Slack app using the recommended "From an app manifest" method.
2. Use a provided YAML manifest to ensure all required scopes (`channels:read`, `canvas:read`, etc.) and settings (Socket Mode) are enabled correctly.
3. Generate the `xapp-` App-Level Token with the `connections:write` scope.
4. Install the app to the workspace and retrieve the `xoxb-` Bot User OAuth Token.
5. Correctly fill in each field in the extension's options page with the generated tokens and other required information.

--- alternatives

Leaving the documentation as is would continue to cause user friction. Creating an external guide (e.g., in the repo's wiki) is an option, but having the instructions directly inside the extension's help page provides the best and most accessible user experience.

## Additional Context
new content proposal:
----------

Below is the proposed new content for `help.html`, formatted in Markdown. This can be adapted into the final HTML file.

---

# Setup and Usage Guide

Welcome to the extension's setup guide. Follow these steps to connect the extension to Slack and start controlling your merges from Bitbucket.

---

## **Step 1: Create and Configure Your Slack App**

For the extension to read messages and receive events, you need to create an "app" in your Slack workspace.
