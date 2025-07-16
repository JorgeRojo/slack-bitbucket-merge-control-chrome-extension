# Slack-Bitbucket Merge Control Chrome Extension

This is a Chrome extension designed to read messages from specified Slack channels (both public and private) and display them within the extension's popup. It also integrates with Bitbucket to control merge button availability based on Slack channel messages.

https://api.slack.com/apps/

## Features

- Reads messages from a configurable Slack channel.
- Supports both public and private channels.
- Receives messages in real-time via Slack Socket Mode.
- Displays the latest messages in the extension popup.
- **Bitbucket Integration:** Controls the merge button on Bitbucket pull request pages based on keywords in Slack messages.

## Code Quality

This project uses [Prettier](https://prettier.io/) for code formatting and [ESLint](https://eslint.org/) for static code analysis.

- **Formatting:**
  To format the code, run:
  ```bash
  npm run format
  ```
- **Linting:**
  To lint the code, run:
  ```bash
  npm run lint
  ```
  To automatically fix linting issues, run:
  ```bash
  npm run lint -- --fix
  ```

## Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/JorgeRojo/slack-frontend-closure.git
    cd slack-frontend-closure
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Load in Chrome:**
    - Open Chrome and navigate to `chrome://extensions`.
    - Enable **Developer mode** (toggle switch in the top right).
    - Click on **Load unpacked**.
    - Select the `slack-frontend-closure` directory.

## Configuration

1.  **Obtain a Slack App-Level Token (xapp-):**
    - Go to your Slack API dashboard and create a new app or select an existing one.
    - Navigate to **Socket Mode** and enable it.
    - Navigate to **Basic Information** -> **App-Level Tokens** and generate a new token with the `connections:write` scope. This token starts with `xapp-`.
    - Navigate to **OAuth & Permissions**.
    - Add the following Bot Token Scopes:
      - `channels:read`
      - `groups:read` (for private channels)
      - `channels:history`
      - `groups:history`
    - Install the app to your workspace to generate the Bot User OAuth Token (starts with `xoxb-`).
2.  **Configure the Extension:**
    - Right-click on the extension icon in your Chrome toolbar and select **Options**.
    - Enter your Slack Bot Token (xoxb-) in the `Slack Token` field.
    - Enter your Slack App-Level Token (xapp-) in the `Slack App Token` field.
    - Enter the exact name of the `Channel Name` you wish to monitor (e.g., `general`, `my-private-channel`).
    - **Bitbucket Configuration:**
      - Enter the `Bitbucket Pull Request URL Pattern` (e.g., `https://bitbucket.my-company.com/projects/*/repos/*/pull-requests/*/overview*`).
      - Enter the `Merge Button DOM Selector` (e.g., `.merge-button`).
    - Click `Save`.

## Usage

Once configured, the extension will receive messages in real-time from the specified channel. Click on the extension icon in your Chrome toolbar to open the popup and view the latest messages. On Bitbucket pull request pages, the merge button will be enabled or disabled based on the configured phrases in Slack messages.
