# Bug Tracking Index

This directory contains documentation for bugs that have been identified and fixed in the Slack-Bitbucket Merge Control Chrome Extension.

## Bug List

| ID                                                        | Title                                               | Component                      | Status | Severity | Date Reported | Date Fixed |
| --------------------------------------------------------- | --------------------------------------------------- | ------------------------------ | ------ | -------- | ------------- | ---------- |
| [001](./001-toggle-switch-state-after-browser-restart.md) | Toggle Switch Incorrect State After Browser Restart | popup-toggle-feature-status.ts | Fixed  | Medium   | 2025-07-24    | 2025-07-24 |

## How to Add a New Bug

1. Create a new file in this directory with the format: `XXX-brief-description.md` where XXX is the next available bug number
2. Use the template below for the bug documentation
3. Add an entry to the table above

## Bug Template

```markdown
# Bug XXX: Brief Title

## Component

Which component/file contains the bug

## Date Reported

YYYY-MM-DD

## Status

[Open/Fixed/Won't Fix]

## Severity

[Critical/High/Medium/Low]

## Reproduce

Steps to reproduce the bug

## Current wrong behavior

Description of the incorrect behavior

## Expected right behavior

Description of what should happen

## Root Cause

Analysis of what caused the bug

## Fix Summary

How the bug was fixed (if applicable)

## Tests Added/Modified

What tests were added or changed to prevent regression

## Related Files

- List of files affected by the bug or the fix
```

## Severity Levels

- **Critical**: Application crashes, data loss, security vulnerability
- **High**: Major functionality broken, no workaround available
- **Medium**: Functionality works but with issues, workaround available
- **Low**: Minor issues, cosmetic problems, edge cases
