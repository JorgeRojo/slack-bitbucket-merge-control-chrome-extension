# Issue Tracking Index

This directory contains documentation for bugs and features in the Slack-Bitbucket Merge Control Chrome Extension.

## Open Bug List

| ID  | Title | Component | Severity | Date Reported |
| --- | ----- | --------- | -------- | ------------- |

<!-- No bugs yet -->

## Open Feature List

| ID                                                                  | Title                                      | Component                     | Priority | Date Requested |
| ------------------------------------------------------------------- | ------------------------------------------ | ----------------------------- | -------- | -------------- |
| [001](./features/001-create-a-github-action-to-create-a-release.md) | Create a github action to create a release | .github/workflows/release.yml | Medium   | 2025-07-24     |

## How to Add a New Issue

1. Create a GitHub issue with the appropriate label ('bug' or 'feature')
2. Fill out the issue template
3. The documentation file will be automatically created

## Bug Template

```markdown
# Bug XXX: Brief Title

## Component

Which component/file contains the bug

## Date Reported

YYYY-MM-DD

## Severity

[Critical/High/Medium/Low]

## Reproduce

Steps to reproduce the bug

## Current wrong behavior

Description of the incorrect behavior

## Expected right behavior

Description of what should happen

## Root Cause

Analysis of what caused the bug (if known)

## Related Files

- List of files affected by the bug
```

## Feature Template

```markdown
# Feature XXX: Brief Title

## Component

Which component/file the feature affects

## Date Requested

YYYY-MM-DD

## Priority

[High/Medium/Low]

## Description

Detailed description of the feature

## Additional Context

Any additional context or information
```

## Severity/Priority Levels

### Severity (for bugs)

- **Critical**: Application crashes, data loss, security vulnerability
- **High**: Major functionality broken, no workaround available
- **Medium**: Functionality works but with issues, workaround available
- **Low**: Minor issues, cosmetic problems, edge cases

### Priority (for features)

- **High**: Core functionality, needed for next release
- **Medium**: Important but not critical, planned for upcoming releases
- **Low**: Nice to have, may be implemented in future releases
