# Release Process Documentation

This document describes the automated release process for the Slack-Bitbucket Merge Control Chrome Extension, following Git Flow principles.

## Important: Enforced Automated Process

**Manual releases are not allowed.** The repository includes a "Release Guardian" workflow that detects and fails any attempt to create tags or releases manually. All releases must be created using the automated workflows described in this document.

## Quick Start Guide

### Standard Release Process

1. Go to the "Actions" tab in GitHub
2. Select "Prepare, Close and Publish Release" workflow
3. Enter the new version (e.g., v1.0.0)
4. Choose whether to automatically publish the release
5. Click "Run workflow"

### Hotfix Process

1. Go to the "Actions" tab in GitHub
2. Select "Hotfix Workflow"
3. Choose "create" action and enter hotfix name
4. Implement your fix on the created branch
5. Use "merge" action to create a PR to master
6. After merge, use "cherry-pick" action to apply to develop
7. Finally, use "cleanup" action to remove the hotfix branch

## Git Flow Overview

The project follows Git Flow principles with the following branch structure:

### Main Branches

- **`master`**: Production-ready code, highly protected
- **`develop`**: Main development branch where all features are integrated

### Temporary Branches

- **`hotfix/*`**: Emergency fixes for production issues (created from `master`)
- **Feature branches**: New features and improvements (created from `develop`)

## Release Workflow Details

### Workflow Diagram

```
detect-pending-release
        |
        v
validate-and-close-version  <-- (Only if no pending release)
        |
        v
  prepare-release          <-- (Only if no pending release)
        |
        v
  publish-release          <-- (Only if auto_publish=true)
```

### Workflow Stages

1. **Detect Pending Release**: Checks if there's a version in master that hasn't been published yet
2. **Validate and Close Version**: Validates code and updates version numbers in develop
3. **Prepare Release**: Merges develop into master
4. **Publish Release**: Creates a tag, builds the extension, and publishes a GitHub release

### Detailed Steps

#### 1. detect-pending-release

- Checkout the master branch
- Check if the current version in package.json has a corresponding tag
- If no tag exists, mark as a pending release
- Display a notice about the auto_publish setting

#### 2. validate-and-close-version

- Checkout the develop branch
- Validate Git Flow compliance (must run from develop)
- Validate version format (must be vX.Y.Z)
- Run comprehensive test suite (lint, type-check, tests, build)
- Validate version increment (new version must be higher than current)
- Check for potential conflicts with master
- Update versions in package.json and manifest.json
- Commit version changes to develop

#### 3. prepare-release

- Checkout the develop branch
- Merge develop into master with a descriptive commit message
- Push changes to master

#### 4. publish-release

- Checkout the master branch
- Set version based on workflow path (pending or new release)
- Create a version tag
- Build the extension
- Create a ZIP package for the Chrome Web Store
- Create a GitHub release with the ZIP file attached

## GitHub Actions Workflows

### 1. `prepare-close-publish-release.yml` 🚀

**Purpose**: Complete end-to-end release process from develop to published GitHub release

**Trigger**: Manual dispatch with version input

**Features**:

- Three-stage workflow: Validate and close version → Prepare release → Publish release
- Pending release detection
- Auto-publish option
- Comprehensive validation
- Automatic version management
- Git tagging
- Release packaging

### 2. `release-guardian.yml` 🛡️

**Purpose**: Prevent manual release creation

**Trigger**: Tag or release creation events

**Features**:

- Validates that tags and releases are created only by the automated workflow
- Fails with clear error messages if manual release is attempted
- Enforces the use of the automated release process

### 3. `hotfix.yml` 🚨

**Purpose**: Complete hotfix lifecycle management

**Actions**:

- `create`: Create hotfix branch from master
- `merge`: Create PR to merge hotfix to master
- `cherry-pick`: Apply hotfix changes to develop
- `cleanup`: Delete hotfix branch after completion

### 4. `setup-branch-protection.yml` 🔒

**Purpose**: Configure branch protection rules

**Protection Rules**:

- **Master Branch**: Required reviews, status checks, no force pushes
- **Develop Branch**: Required reviews, allows maintainer force pushes

## Usage Scenarios

### 1. Creating a New Release

To create a new release:

1. Run the "Prepare, Close and Publish Release" workflow with:
   - **version**: The new version (e.g., v1.0.0)
   - **auto_publish**: true/false depending on whether you want to publish immediately

2. The workflow will:
   - Validate the code and version
   - Update version numbers in develop
   - Merge develop into master
   - (If auto_publish=true) Create a GitHub release

### 2. Publishing a Pending Release

If you previously created a release but didn't publish it:

1. Run the "Prepare, Close and Publish Release" workflow with:
   - **version**: Leave empty
   - **auto_publish**: true

2. The workflow will:
   - Detect the pending release
   - Skip validation and merge steps
   - Create a GitHub release for the pending version

### 3. Hotfix Process

For emergency fixes to production:

1. Create a hotfix branch:

   ```bash
   # Using GitHub Actions
   Actions → Hotfix Workflow → create
   Input: hotfix_name (e.g., critical-security-fix)
   ```

2. Implement and test the fix

3. Merge the hotfix:

   ```bash
   # Using GitHub Actions
   Actions → Hotfix Workflow → merge
   Input: hotfix_name, version (e.g., v1.0.1)
   ```

4. Apply to develop:

   ```bash
   # Using GitHub Actions
   Actions → Hotfix Workflow → cherry-pick
   Input: hotfix_name
   ```

5. Clean up:

   ```bash
   # Using GitHub Actions
   Actions → Hotfix Workflow → cleanup
   Input: hotfix_name
   ```

## Version Numbering

The project follows semantic versioning (MAJOR.MINOR.PATCH):

- **MAJOR**: Incremented for incompatible API changes
- **MINOR**: Incremented for adding functionality in a backward-compatible manner
- **PATCH**: Incremented for backward-compatible bug fixes

## Emergency Procedures

### Critical Production Issue

1. Run `hotfix.yml` → `create`
2. Implement fix on hotfix branch
3. Run `hotfix.yml` → `merge`
4. Review and merge PR immediately
5. Deploy to production
6. Run `hotfix.yml` → `cherry-pick`
7. Run `hotfix.yml` → `cleanup`

### Rollback

If hotfix causes issues:

1. Revert merge commit on master
2. Deploy reverted version
3. Create new hotfix with proper solution

## Setup Requirements

For workflows to function properly:

1. **Personal Access Token (PAT)**:
   - Create PAT with `repo` permissions
   - Add as repository secret: `PAT_TOKEN`

2. **Branch Protection** (recommended):
   - Run `setup-branch-protection.yml` with `setup-all` action

3. **Repository Settings**:
   - Enable Actions in repository settings
   - Allow GitHub Actions to create and approve pull requests

## Troubleshooting

If you encounter issues with the workflow:

- Check that the version format is correct (vMAJOR.MINOR.PATCH)
- Make sure the new version is higher than the current version
- Ensure you have the necessary permissions to push to the repository
- Check the workflow run logs for detailed error messages

**Common Issues**:

- **403 Permission Denied**: Ensure you have repository access
- **404 Branch Not Found**: Ensure target branches exist
- **Organization Policies**: Check if organization allows branch protection

## Best Practices

1. Always run the workflow from the develop branch
2. Ensure all tests pass before initiating a release
3. Follow semantic versioning (vMAJOR.MINOR.PATCH)
4. Review the workflow summary after completion
5. Verify the GitHub release after publication
6. For feature development, always create branches from develop
7. For hotfixes, create branches from master and cherry-pick to develop

For additional help, please create an issue in the GitHub repository.
