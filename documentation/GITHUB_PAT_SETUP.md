# GitHub Personal Access Token Setup

This document explains how to set up a Personal Access Token (PAT) to enable the Complete Release Pipeline workflow to create Pull Requests automatically.

## Why is this needed?

GitHub Actions has a security restriction that prevents workflows from creating Pull Requests using the default `GITHUB_TOKEN`. This is to prevent infinite loops and maintain security. To enable PR creation, you need to use a Personal Access Token.

## Step-by-Step Setup

### 1. Create a Personal Access Token

1. **Go to GitHub Settings**:
   - Click your profile picture → Settings
   - Or visit: https://github.com/settings/tokens

2. **Navigate to Developer Settings**:
   - Scroll down to "Developer settings" in the left sidebar
   - Click "Personal access tokens" → "Tokens (classic)"

3. **Generate New Token**:
   - Click "Generate new token" → "Generate new token (classic)"
   - Give it a descriptive name: `Release Pipeline - [Repository Name]`
   - Set expiration (recommended: 90 days or 1 year)

4. **Select Scopes**:
   - ✅ **repo** (Full control of private repositories)
     - This includes: repo:status, repo_deployment, public_repo, repo:invite, security_events
   - ✅ **workflow** (Update GitHub Action workflows) - if you want to modify workflows

   **Note**: The `repo` scope is essential for creating Pull Requests.

5. **Generate and Copy Token**:
   - Click "Generate token"
   - **⚠️ IMPORTANT**: Copy the token immediately - you won't see it again!

### 2. Add Token to Repository Secrets

1. **Go to Repository Settings**:
   - Navigate to your repository
   - Click "Settings" tab
   - Click "Secrets and variables" → "Actions"

2. **Create New Secret**:
   - Click "New repository secret"
   - **Name**: `PAT_TOKEN`
   - **Secret**: Paste the token you copied
   - Click "Add secret"

### 3. Verify Setup

1. **Run the Workflow**:
   - Go to Actions tab
   - Run "Complete Release Pipeline"
   - Select "Create Pull Request" option
   - The workflow should now create PRs successfully

## Alternative Solutions

If you prefer not to use a PAT, you have these alternatives:

### Option 1: Direct Merge Mode

- Run the workflow with "Create Pull Request" = false
- This bypasses PR creation and merges directly to master
- ⚠️ **Use with caution** - skips code review process

### Option 2: Manual PR Creation

- Let the workflow validation run
- Create the PR manually from develop to master
- Merge the PR to trigger the rest of the pipeline

### Option 3: GitHub App (Advanced)

- Create a GitHub App with appropriate permissions
- Use the app's token instead of PAT
- More complex but better for organizations

## Security Considerations

### PAT Security Best Practices:

- ✅ Use descriptive names for tokens
- ✅ Set appropriate expiration dates
- ✅ Use minimum required scopes
- ✅ Regularly rotate tokens
- ✅ Delete unused tokens
- ❌ Never commit tokens to code
- ❌ Don't share tokens

### Repository Secret Security:

- ✅ Secrets are encrypted and only accessible to workflows
- ✅ Secrets are not exposed in logs
- ✅ Only repository collaborators with admin access can manage secrets

## Troubleshooting

### Common Issues:

1. **"Bad credentials" error**:
   - Token may be expired or invalid
   - Regenerate token and update secret

2. **"Not Found" error**:
   - Check repository name and owner
   - Ensure token has `repo` scope

3. **"Insufficient permissions" error**:
   - Token needs `repo` scope
   - Check if organization has restrictions

4. **Token not working after setup**:
   - Ensure secret name is exactly `PAT_TOKEN`
   - Try re-running the workflow
   - Check token hasn't expired

### Getting Help:

If you continue having issues:

1. Check the workflow logs for specific error messages
2. Verify the token has correct permissions
3. Ensure the secret is properly configured
4. Consider using direct merge mode as alternative

## Workflow Integration

The workflow automatically:

1. Tries to use `PAT_TOKEN` if available
2. Falls back to `GITHUB_TOKEN` if PAT not found
3. Provides clear error messages and solutions if PR creation fails
4. Offers alternative approaches in the workflow summary

This ensures the workflow remains functional even without PAT setup, while providing the best experience when properly configured.
