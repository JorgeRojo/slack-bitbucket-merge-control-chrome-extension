# GitHub Actions Workflows

This directory contains GitHub Actions workflows that automate various tasks for the Slack-Bitbucket Merge Control Chrome Extension project.

## Bug Tracking Synchronization

These workflows synchronize bug reports between GitHub Issues and the project's bug documentation system.

### 1. `sync-issues-to-bugs.yml`

This workflow creates a bug documentation file when a new GitHub Issue with the "bug" label is created.

**Trigger**: When an issue is opened or labeled with "bug"

**Actions**:
- Extracts information from the issue (component, severity, steps to reproduce, etc.)
- Creates a new bug documentation file in `documentation/bugs/` with the next available ID
- Updates the bug index in `documentation/bugs/README.md`
- Adds a comment to the issue with a link to the new bug documentation file

### 2. `sync-bugs-to-issues.yml`

This workflow creates a GitHub Issue when a new bug documentation file is added to the repository.

**Trigger**: When a file matching `documentation/bugs/[0-9]*.md` is pushed to the master branch

**Actions**:
- Extracts information from the bug documentation file
- Creates a new GitHub Issue with appropriate labels
- Updates the bug documentation file with a link to the new issue

## Setup Requirements

For these workflows to function properly, you need to:

1. Create a Personal Access Token (PAT) with `repo` permissions
2. Add it as a repository secret named `PAT_TOKEN`

To create a PAT and add it as a secret:
1. Go to GitHub → Settings → Developer settings → Personal access tokens → Generate new token
2. Select the `repo` scope
3. Copy the generated token
4. Go to your repository → Settings → Secrets → New repository secret
5. Name: `PAT_TOKEN`
6. Value: Paste the token you copied
7. Click "Add secret"
