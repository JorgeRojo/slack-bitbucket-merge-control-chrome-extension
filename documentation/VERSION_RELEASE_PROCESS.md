# Version Closing and Release Process

This document explains how to use the GitHub Actions workflows to close a version and create a release for the Slack-Bitbucket Merge Control Chrome Extension.

## Overview

The release process is split into two separate workflows that must be executed manually:

1. **Close Version**: Updates version numbers in relevant files, commits these changes, and creates a git tag
2. **Build and Release**: Builds the extension from the tagged version and creates a GitHub release with the packaged extension

**Important**: Both version closing and releases can only be performed on the `master` branch to ensure stability and consistency in the release process.

## Step 1: Closing a Version

To close a version:

1. Go to the "Actions" tab in the GitHub repository
2. Select the "Close Version" workflow from the left sidebar
3. Click the "Run workflow" button
4. In the form that appears:
   - Enter the new version in the format `v1.0.0` (following semantic versioning with a 'v' prefix)
   - The branch will be fixed to `master`
5. Click the green "Run workflow" button to start the process

The workflow will:
- Validate that the version format is correct (must be vMAJOR.MINOR.PATCH)
- Extract the semantic version (MAJOR.MINOR.PATCH) from the input
- Verify that the new version is higher than the current version
- Update the version in package.json and manifest.json
- Commit these changes
- Create a git tag with the version
- Push the changes and tag to the repository

## Step 2: Creating a Release

After successfully closing a version, you can create a release:

1. Go to the "Actions" tab in the GitHub repository
2. Select the "Build and Release Extension" workflow from the left sidebar
3. Click the "Run workflow" button
4. Click the green "Run workflow" button to start the process (no inputs required)

The workflow will:
- Read the current version from package.json
- Validate that the corresponding git tag exists (created by the Close Version workflow)
- Check that no release already exists for this version
- Check out the code at the specific version tag
- Install dependencies and run tests
- Build the extension
- Package the extension as a ZIP file
- Create a GitHub release with the packaged extension attached

## Version Numbering

The project follows semantic versioning (MAJOR.MINOR.PATCH):

- **MAJOR**: Incremented for incompatible API changes
- **MINOR**: Incremented for adding functionality in a backward-compatible manner
- **PATCH**: Incremented for backward-compatible bug fixes

## Troubleshooting

If you encounter issues with the workflows:

### Close Version Workflow
- Check that the version format is correct (vMAJOR.MINOR.PATCH)
- Make sure the new version is higher than the current version
- Ensure you have the necessary permissions to push to the repository

### Build and Release Workflow
- Verify that you have run the "Close Version" workflow first
- Check that the git tag exists for the current package.json version
- Ensure no release already exists for the current version
- Check the workflow run logs for detailed error messages

For additional help, please create an issue in the GitHub repository.
