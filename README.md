# Slack Channel Reader Chrome Extension

This is a Chrome extension designed to read messages from specified Slack channels (both public and private) and display them within the extension's popup.

## Features

- Reads messages from a configurable Slack channel.
- Supports both public and private channels.
- Fetches messages periodically.
- Displays the latest messages in the extension popup.

## Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/JorgeRojo/slack-frontend-closure.git
    cd slack-frontend-closure
    ```
2.  **Load in Chrome:**
    - Open Chrome and navigate to `chrome://extensions`.
    - Enable **Developer mode** (toggle switch in the top right).
    - Click on **Load unpacked**.
    - Select the `slack-frontend-closure` directory.

## Configuration

1.  **Obtain a Slack Bot Token:**
    - Go to your Slack API dashboard and create a new app or select an existing one.
    - Navigate to **OAuth & Permissions**.
    - Add the following Bot Token Scopes:
        - `channels:read`
        - `groups:read` (for private channels)
        - `chat:read`
    - Install the app to your workspace to generate the Bot User OAuth Token (starts with `xoxb-`).
2.  **Configure the Extension:**
    - Right-click on the extension icon in your Chrome toolbar and select **Options**.
    - Enter your Slack Bot Token in the `Slack Token` field.
    - Enter the exact name of the `Channel Name` you wish to monitor (e.g., `general`, `my-private-channel`).
    - Click `Save`.

## Usage

Once configured, the extension will periodically fetch messages from the specified channel. Click on the extension icon in your Chrome toolbar to open the popup and view the latest messages.