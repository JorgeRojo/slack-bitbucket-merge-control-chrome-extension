# Feature 001: Create a github action to create a release

[GitHub Issue #13](https://github.com/JorgeRojo/slack-bitbucket-merge-control-chrome-extension/issues/13)

## Component
`.github/workflows/close-version.yml`
`.github/workflows/release.yml`

## Date Requested
2025-07-24

## Date Implemented
2025-07-24

## Priority
Medium

## Status
✅ Implemented

## Description
- Create a release builder for the entire Chrome extension
- Investigate the release flow and closing version... determine the git flow and extension versioning
- Investigate how to build the assets for the standard Chrome extensions, ready to publish
- Perform the release building when a new versión is closed.
- Should execute de build script
- The assets of the extension will be in ./dist directory

## Implementation Details
The implementation consists of two separate GitHub Actions workflows:

1. **Close Version** (`.github/workflows/close-version.yml`):
   - Allows closing a version with a semantic version format (v1.0.0)
   - Validates that the version format is correct
   - Ensures the new version is higher than the current version
   - Updates version in package.json and manifest.json
   - Creates a git tag with the version
   - Only works on the master branch

2. **Build and Release** (`.github/workflows/release.yml`):
   - Triggered automatically when a new tag is pushed
   - Builds the extension using the npm build script
   - Creates a ZIP archive of the extension
   - Creates a GitHub release with the packaged extension

Documentation for the release process is available in `./documentation/VERSION_RELEASE_PROCESS.md`.

## Additional Context
_No response_
