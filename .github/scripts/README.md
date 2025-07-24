# GitHub Actions Scripts

This directory contains JavaScript scripts used by GitHub Actions workflows. Extracting the logic into separate files makes the workflows more maintainable and easier to test.

## Available Scripts

### `sync-issue-to-bug.js`

Creates a bug documentation file from a GitHub issue.

**Usage**:
```javascript
const syncIssueToDoc = require('./.github/scripts/sync-issue-to-bug.js');

const result = await syncIssueToDoc({ 
  github,  // GitHub API client
  context, // GitHub Actions context
  core,    // GitHub Actions core library
  exec,    // GitHub Actions exec library
  fs,      // Node.js fs module
  path     // Node.js path module
});
```

**Returns**:
```javascript
{
  bugId: "001",           // The ID of the created bug
  bugFilePath: "path/to/file.md", // The path to the created file
  slug: "bug-title-slug"  // The slug generated from the title
}
```

### `sync-bug-to-issue.js`

Creates a GitHub issue from a bug documentation file.

**Usage**:
```javascript
const syncBugToIssue = require('./.github/scripts/sync-bug-to-issue.js');

const result = await syncBugToIssue({ 
  github,  // GitHub API client
  context, // GitHub Actions context
  core,    // GitHub Actions core library
  exec,    // GitHub Actions exec library
  fs,      // Node.js fs module
  path,    // Node.js path module
  file     // Path to the bug documentation file
});
```

**Returns**:
```javascript
{
  bugId: "001",           // The ID of the bug
  issueNumber: 42         // The number of the created GitHub issue
}
```

## Testing

To test these scripts locally:

1. Clone the repository
2. Install dependencies: `npm install @actions/github @actions/core @actions/exec`
3. Create a test file:

```javascript
const fs = require('fs');
const path = require('path');
const { getOctokit } = require('@actions/github');
const core = require('@actions/core');
const exec = require('@actions/exec');

// Mock GitHub context
const context = {
  repo: {
    owner: 'your-username',
    repo: 'your-repo'
  },
  payload: {
    issue: {
      // Mock issue data
    }
  }
};

// Create GitHub client with your token
const github = getOctokit(process.env.GITHUB_TOKEN);

// Import and test the script
const syncIssueToDoc = require('./sync-issue-to-bug.js');
syncIssueToDoc({ github, context, core, exec, fs, path })
  .then(result => console.log(result))
  .catch(error => console.error(error));
```

4. Run with: `GITHUB_TOKEN=your-token node test-script.js`
