# Bug Tracking Index

This directory contains documentation for bugs that have been identified and fixed in the Slack-Bitbucket Merge Control Chrome Extension.

## Bug List

| ID | Title | Component | Status | Severity | Date Reported | Date Fixed |
| --- | ----- | --------- | ------ | -------- | ------------ | --------- |
| [002](./002-test-bug-reporting-github-action-dont-take-this-bu.md) | test bug reporting github action - DON'T take this bug in consideration bug Something isn't working | test bug reporting github action - DON'T take this bug in consideration bug Something isn't working | Open | Medium | 2025-07-24 |  |
| [003](./003-xxxxx-1.md) | XXXXX 1 | XXXXX 1 | Open | Medium | 2025-07-24 |  |
| [004](./004-xxxxx-2.md) | XXXXX 2 | XXXXX 2 | Open | Medium | 2025-07-24 |  |
| [005](./005-xxxxx-3.md) | XXXXX 3 | XXXXX 3 | Open | Medium | 2025-07-24 |  |
| [006](./006-xxxx-4.md) | XXXX 4 | XXXX 4 | Open | Medium | 2025-07-24 |  |
| [007](./007-xxxx-5.md) | XXXX 5 | XXXX 5 | Open | Medium | 2025-07-24 |  |
| [008](./008-xxxx-6.md) | XXXX 6 | XXXX 6 | Open | Medium | 2025-07-24 |  |
| [009](./009-xxxx-7.md) | XXXX 7 | XXXX 7 | Open | Medium | 2025-07-24 |  |

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