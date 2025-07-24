# Bug 001: Bug #001: Toggle Switch Incorrect State After Browser Restart

[GitHub Issue #11](https://github.com/JorgeRojo/slack-bitbucket-merge-control-chrome-extension/issues/11)

## Component
`popup-toggle-feature-status.ts`

## Date Reported
2025-07-24

## Severity
Medium

## Reproduce
- 1. Switch off the toggleSwitch (countdown starts)
- 2. Close the browser
- 3. Open the browser again
- 4. Open the extension popup

## Current wrong behavior
The toggleSwitch is displayed as ON even though the feature is disabled and the countdown is active.

## Expected right behavior
The toggleSwitch should start as OFF because the feature is disabled and the countdown is displayed.

## Root Cause
Not yet determined

## Related Files
- `popup-toggle-feature-status.ts`


