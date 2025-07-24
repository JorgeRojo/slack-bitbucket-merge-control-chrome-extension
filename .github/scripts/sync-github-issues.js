/**
 * Script to synchronize GitHub issues with documentation files
 * - Creates files for open issues with 'bug' or 'feature' label
 * - Removes files for closed issues or issues without the appropriate label
 * - Updates the common ISSUES_TRACKING.md with both bug and feature lists
 *
 * @param {object} github - The GitHub API client
 * @param {object} context - The GitHub Actions context
 * @param {object} _core - The GitHub Actions core library (unused)
 * @param {object} _exec - The GitHub Actions exec library (unused)
 * @param {object} fs - The Node.js fs module
 * @param {object} path - The Node.js path module
 */
export default async ({ github, context, _core, _exec, fs, path }) => {
  const bugsDir = 'documentation/bugs';
  const featuresDir = 'documentation/features';
  const issuesTrackingFile = 'documentation/ISSUES_TRACKING.md';

  // Ensure directories exist
  [bugsDir, featuresDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  // Get all open issues with 'bug' label
  const openBugIssues = await github.rest.issues.listForRepo({
    owner: context.repo.owner,
    repo: context.repo.repo,
    state: 'open',
    labels: 'bug',
  });

  console.log(`Found ${openBugIssues.data.length} open issues with 'bug' label`);

  // Get all open issues with 'feature' label
  const openFeatureIssues = await github.rest.issues.listForRepo({
    owner: context.repo.owner,
    repo: context.repo.repo,
    state: 'open',
    labels: 'feature',
  });

  console.log(`Found ${openFeatureIssues.data.length} open issues with 'feature' label`);

  // Process bugs
  const bugResults = await processIssues({
    issues: openBugIssues.data,
    issueType: 'bug',
    directory: bugsDir,
    fs,
    path,
    github,
  });

  // Process features
  const featureResults = await processIssues({
    issues: openFeatureIssues.data,
    issueType: 'feature',
    directory: featuresDir,
    fs,
    path,
    github,
  });

  // Update the common README.md
  await updateCommonReadme({
    fs,
    issuesTrackingFile,
    bugEntries: bugResults.tableEntries,
    featureEntries: featureResults.tableEntries,
  });

  return {
    createdFiles: [...bugResults.createdFiles, ...featureResults.createdFiles],
    removedFiles: [...bugResults.removedFiles, ...featureResults.removedFiles],
  };
};

/**
 * Process issues of a specific type (bug or feature)
 *
 * @param {object} params - Parameters
 * @param {Array} params.issues - List of issues
 * @param {string} params.issueType - Type of issue ('bug' or 'feature')
 * @param {string} params.directory - Directory to store files
 * @param {object} params.fs - The Node.js fs module
 * @param {object} params.path - The Node.js path module
 * @param {object} params._github - The GitHub API client (unused)
 * @returns {object} Results of processing
 */
async function processIssues({ issues, issueType, directory, fs, path, _github }) {
  // Get all existing files
  const existingFiles = fs
    .readdirSync(directory)
    .filter(f => f.match(/^\d{3}-.+\.md$/) && f !== 'README.md');

  console.log(`Found ${existingFiles.length} existing ${issueType} files`);

  // Track created and removed files
  const createdFiles = [];
  const removedFiles = [];
  const tableEntries = [];

  // Map to store issue number to file ID mapping
  const issueNumberToFileId = {};

  // First pass: Extract issue numbers from existing files
  for (const file of existingFiles) {
    try {
      const content = fs.readFileSync(path.join(directory, file), 'utf8');
      const issueMatch = content.match(/\[GitHub Issue #(\d+)\]/);
      if (issueMatch) {
        const issueNumber = parseInt(issueMatch[1], 10);
        const idMatch = file.match(/^(\d{3})/);
        if (idMatch) {
          issueNumberToFileId[issueNumber] = idMatch[1];
        }
      }
    } catch (error) {
      console.error(`Error processing file ${file}: ${error.message}`);
    }
  }

  // Find the next available ID
  let maxId = 0;
  existingFiles.forEach(file => {
    const idMatch = file.match(/^(\d{3})/);
    if (idMatch) {
      const id = parseInt(idMatch[1], 10);
      if (id > maxId) maxId = id;
    }
  });

  // Process open issues
  for (const issue of issues) {
    // Skip pull requests
    if (issue.pull_request) {
      continue;
    }

    const issueNumber = issue.number;
    let fileId = issueNumberToFileId[issueNumber];

    // If we don't have a file ID for this issue, create a new one
    if (!fileId) {
      fileId = String(++maxId).padStart(3, '0');
    }

    // Extract information from the issue body
    const extractField = (body, fieldId) => {
      if (!body) return '';
      const regex = new RegExp(`### ${fieldId}\\s+([\\s\\S]*?)(?=###|$)`, 'i');
      const match = body.match(regex);
      return match ? match[1].trim() : '';
    };

    const component = extractField(issue.body, 'Component');
    const severity = extractField(issue.body, 'Severity').split(' - ')[0]; // Get just the severity level
    const priority = extractField(issue.body, 'Priority').split(' - ')[0]; // Get just the priority level
    const description = extractField(issue.body, 'Description');
    const reproduceSteps = extractField(issue.body, 'Steps to Reproduce');
    const currentBehavior = extractField(issue.body, 'Current Behavior');
    const expectedBehavior = extractField(issue.body, 'Expected Behavior');
    const additionalContext = extractField(issue.body, 'Additional Context');

    // Create a slug from the title
    const slug = issue.title
      .toLowerCase()
      .replace(/^\[(bug|feature)\]:\s*/i, '')
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 50);

    // Format the file content based on issue type
    let fileContent;

    if (issueType === 'bug') {
      fileContent = `# Bug ${fileId}: ${issue.title.replace(/^\[Bug\]:\s*/i, '')}

[GitHub Issue #${issueNumber}](${issue.html_url})

## Component
\`${component || 'Not specified'}\`

## Date Reported
${new Date(issue.created_at).toISOString().split('T')[0]}

## Severity
${severity || 'Medium'}

## Reproduce
${
  reproduceSteps
    ? reproduceSteps
        .split('\n')
        .map(line => (line.trim() ? `- ${line.trim()}` : ''))
        .filter(Boolean)
        .join('\n')
    : 'No reproduction steps provided'
}

## Current wrong behavior
${currentBehavior || 'Not specified'}

## Expected right behavior
${expectedBehavior || 'Not specified'}

## Root Cause
Not yet determined

## Related Files
- \`${component || 'Not specified'}\`

${additionalContext ? `## Additional Context\n${additionalContext}` : ''}
`;
    } else {
      fileContent = `# Feature ${fileId}: ${issue.title.replace(/^\[Feature\]:\s*/i, '')}

[GitHub Issue #${issueNumber}](${issue.html_url})

## Component
\`${component || 'Not specified'}\`

## Date Requested
${new Date(issue.created_at).toISOString().split('T')[0]}

## Priority
${priority || 'Medium'}

## Description
${description || issue.body || 'No description provided'}

${additionalContext ? `## Additional Context\n${additionalContext}` : ''}
`;
    }

    // Write the file
    const fileName = `${fileId}-${slug}.md`;
    const filePath = path.join(directory, fileName);

    // Check if the file already exists with the same content
    let fileExists = false;
    let contentChanged = true;

    if (fs.existsSync(filePath)) {
      fileExists = true;
      const existingContent = fs.readFileSync(filePath, 'utf8');
      contentChanged = existingContent !== fileContent;
    }

    if (!fileExists || contentChanged) {
      fs.writeFileSync(filePath, fileContent);
      if (fileExists) {
        console.log(`Updated ${issueType} file: ${fileName}`);
      } else {
        console.log(`Created ${issueType} file: ${fileName}`);
        createdFiles.push(fileName);
      }
    } else {
      console.log(`${issueType} file already exists and content is unchanged: ${fileName}`);
    }

    // Mark this file as processed
    issueNumberToFileId[issueNumber] = fileId;

    // Add table entry
    tableEntries.push({
      id: fileId,
      file: fileName,
      title: issue.title.replace(/^\[(Bug|Feature)\]:\s*/i, ''),
      component: component || 'Not specified',
      severity: issueType === 'bug' ? severity || 'Medium' : undefined,
      priority: issueType === 'feature' ? priority || 'Medium' : undefined,
      dateReported: new Date(issue.created_at).toISOString().split('T')[0],
    });
  }

  // Remove files that don't correspond to open issues
  for (const file of existingFiles) {
    try {
      const filePath = path.join(directory, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const issueMatch = content.match(/\[GitHub Issue #(\d+)\]/);

      if (issueMatch) {
        const issueNumber = parseInt(issueMatch[1], 10);

        // Check if this issue is in our list of open issues
        const issueExists = issues.some(issue => issue.number === issueNumber);

        if (!issueExists) {
          // Issue is closed or no longer has the appropriate label, remove the file
          fs.unlinkSync(filePath);
          console.log(`Removed ${issueType} file: ${file}`);
          removedFiles.push(file);
        }
      } else {
        // No issue reference found, keep the file for now
        console.log(`No issue reference found in file: ${file}`);
      }
    } catch (error) {
      console.error(`Error processing file ${file}: ${error.message}`);
    }
  }

  return {
    createdFiles,
    removedFiles,
    tableEntries,
  };
}

/**
 * Updates the common ISSUES_TRACKING.md file with both bug and feature lists
 *
 * @param {object} params - Parameters
 * @param {object} params.fs - The Node.js fs module
 * @param {string} params.issuesTrackingFile - Path to the ISSUES_TRACKING.md file
 * @param {Array} params.bugEntries - Bug table entries
 * @param {Array} params.featureEntries - Feature table entries
 */
async function updateCommonReadme({ fs, issuesTrackingFile, bugEntries, featureEntries }) {
  // Sort entries by ID
  bugEntries.sort((a, b) => {
    const idA = parseInt(a.id, 10);
    const idB = parseInt(b.id, 10);
    return idA - idB;
  });

  featureEntries.sort((a, b) => {
    const idA = parseInt(a.id, 10);
    const idB = parseInt(b.id, 10);
    return idA - idB;
  });

  console.log(
    `Creating common README with ${bugEntries.length} bugs and ${featureEntries.length} features`
  );

  // Create the README.md content
  const readmeContent = `# Issue Tracking Index

This directory contains documentation for bugs and features in the Slack-Bitbucket Merge Control Chrome Extension.

## Open Bug List

| ID | Title | Component | Severity | Date Reported |
| -- | ----- | --------- | -------- | ------------- |
${
  bugEntries.length > 0
    ? bugEntries
        .map(
          entry =>
            `| [${entry.id}](./bugs/${entry.file}) | ${entry.title} | ${entry.component} | ${entry.severity} | ${entry.dateReported} |`
        )
        .join('\n')
    : '<!-- No bugs yet -->'
}

## Open Feature List

| ID | Title | Component | Priority | Date Requested |
| -- | ----- | --------- | -------- | -------------- |
${
  featureEntries.length > 0
    ? featureEntries
        .map(
          entry =>
            `| [${entry.id}](./features/${entry.file}) | ${entry.title} | ${entry.component} | ${entry.priority} | ${entry.dateReported} |`
        )
        .join('\n')
    : '<!-- No features yet -->'
}

## How to Add a New Issue

1. Create a GitHub issue with the appropriate label ('bug' or 'feature')
2. Fill out the issue template
3. The documentation file will be automatically created

## Bug Template

\`\`\`markdown
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
\`\`\`

## Feature Template

\`\`\`markdown
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
\`\`\`

## Severity/Priority Levels

### Severity (for bugs)
- **Critical**: Application crashes, data loss, security vulnerability
- **High**: Major functionality broken, no workaround available
- **Medium**: Functionality works but with issues, workaround available
- **Low**: Minor issues, cosmetic problems, edge cases

### Priority (for features)
- **High**: Core functionality, needed for next release
- **Medium**: Important but not critical, planned for upcoming releases
- **Low**: Nice to have, may be implemented in future releases`;

  // Write the updated content back to the file
  fs.writeFileSync(issuesTrackingFile, readmeContent);
  console.log(`Updated issues tracking file at ${issuesTrackingFile}`);
}
