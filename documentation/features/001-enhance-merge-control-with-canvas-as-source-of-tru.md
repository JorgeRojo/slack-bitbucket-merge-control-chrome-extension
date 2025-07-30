# Feature 001: Enhance Merge Control with Canvas as Source of Truth and an Enriched Popup UI

[GitHub Issue #43](https://github.com/JorgeRojo/slack-bitbucket-merge-control-chrome-extension/issues/43)

## Component
`src/modules/background/background.ts`

## Date Requested
2025-07-30

## Priority
High

## Description
Currently, the merge state is determined by ephemeral messages in a Slack channel, which can get lost in the history. This makes it difficult to maintain clear, persistent control over pull request approvals.

Additionally, with the introduction of a second data source (the Canvas), the current popup UI will not provide enough context to the user about *why* a certain merge state was decided (i.e., whether the decision came from the Canvas or a channel message).

The User Story that solves this is:
> As a developer, I want to define the merge state in a persistent Slack Canvas and clearly see the source of the current merge status in the extension popup, so that the team has unambiguous, centralized, and lasting control over the approval process.


----

The solution is to use a Slack Canvas as the primary source of truth for the merge state and to enhance the popup UI to display both the Canvas content and the specific channel message that was last evaluated.

## Additional Context
The following technical approach is suggested for implementation:

* **Slack Event:** `canvas_changed`
* **API Endpoint:** `canvas.getDocument`
* **Required Scope:** `canvas:read`
* **Function to modify:** `determineMergeStatus` (to return the decision source) and the popup rendering logic.
