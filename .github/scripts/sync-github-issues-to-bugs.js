/**
 * Script to synchronize GitHub issues with bug documentation files
 * - Creates bug files for open issues with 'bug' label
 * - Removes bug files for closed issues or issues without 'bug' label
 * - Updates the bug index README.md
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

  // Ensure the bugs directory exists
  if (!fs.existsSync(bugsDir)) {
    fs.mkdirSync(bugsDir, { recursive: true });
  }

  // Get all open issues with 'bug' label
  const openBugIssues = await github.rest.issues.listForRepo({
    owner: context.repo.owner,
    repo: context.repo.repo,
    state: 'open',
    labels: 'bug',
  });

  console.log(`Found ${openBugIssues.data.length} open issues with 'bug' label`);

  // Get all existing bug files
  const existingBugFiles = fs
    .readdirSync(bugsDir)
    .filter(f => f.match(/^\d{3}-.+\.md$/) && f !== 'README.md');

  console.log(`Found ${existingBugFiles.length} existing bug files`);

  // Track created and removed files
  const createdFiles = [];
  const removedFiles = [];

  // Map to store issue number to bug ID mapping
  const issueNumberToBugId = {};

  // First pass: Extract issue numbers from existing bug files
  for (const file of existingBugFiles) {
    try {
      const content = fs.readFileSync(path.join(bugsDir, file), 'utf8');
      const issueMatch = content.match(/\[GitHub Issue #(\d+)\]/);
      if (issueMatch) {
        const issueNumber = parseInt(issueMatch[1], 10);
        const idMatch = file.match(/^(\d{3})/);
        if (idMatch) {
          issueNumberToBugId[issueNumber] = idMatch[1];
        }
      }
    } catch (error) {
      console.error(`Error processing file ${file}: ${error.message}`);
    }
  }

  // Find the next available bug ID
  let maxId = 0;
  existingBugFiles.forEach(file => {
    const idMatch = file.match(/^(\d{3})/);
    if (idMatch) {
      const id = parseInt(idMatch[1], 10);
      if (id > maxId) maxId = id;
    }
  });

  // Process open bug issues
  for (const issue of openBugIssues.data) {
    // Skip pull requests
    if (issue.pull_request) {
      continue;
    }

    const issueNumber = issue.number;
    let bugId = issueNumberToBugId[issueNumber];

    // If we don't have a bug ID for this issue, create a new one
    if (!bugId) {
      bugId = String(++maxId).padStart(3, '0');
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
    const reproduceSteps = extractField(issue.body, 'Steps to Reproduce');
    const currentBehavior = extractField(issue.body, 'Current Behavior');
    const expectedBehavior = extractField(issue.body, 'Expected Behavior');
    const rootCause = extractField(issue.body, 'Root Cause');
    const additionalContext = extractField(issue.body, 'Additional Context');

    // Create a slug from the title
    const slug = issue.title
      .toLowerCase()
      .replace(/^\[bug\]:\s*/, '')
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 50);

    // Format the bug file content
    const bugContent = `# Bug ${bugId}: ${issue.title.replace(/^\[Bug\]:\s*/i, '')}

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
${rootCause || 'Not yet determined'}

## Related Files
- \`${component || 'Not specified'}\`

${additionalContext ? `## Additional Context\n${additionalContext}` : ''}
`;

    // Write the bug file
    const bugFileName = `${bugId}-${slug}.md`;
    const bugFilePath = path.join(bugsDir, bugFileName);

    // Check if the file already exists with the same content
    let fileExists = false;
    let contentChanged = true;

    if (fs.existsSync(bugFilePath)) {
      fileExists = true;
      const existingContent = fs.readFileSync(bugFilePath, 'utf8');
      contentChanged = existingContent !== bugContent;
    }

    if (!fileExists || contentChanged) {
      fs.writeFileSync(bugFilePath, bugContent);
      if (fileExists) {
        console.log(`Updated bug file: ${bugFileName}`);
      } else {
        console.log(`Created bug file: ${bugFileName}`);
        createdFiles.push(bugFileName);
      }
    } else {
      console.log(`Bug file already exists and content is unchanged: ${bugFileName}`);
    }

    // Mark this file as processed
    issueNumberToBugId[issueNumber] = bugId;
  }

  // Remove bug files that don't correspond to open bug issues
  for (const file of existingBugFiles) {
    try {
      const filePath = path.join(bugsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const issueMatch = content.match(/\[GitHub Issue #(\d+)\]/);

      if (issueMatch) {
        const issueNumber = parseInt(issueMatch[1], 10);

        // Check if this issue is in our list of open bug issues
        const issueExists = openBugIssues.data.some(issue => issue.number === issueNumber);

        if (!issueExists) {
          // Issue is closed or no longer has the bug label, remove the file
          fs.unlinkSync(filePath);
          console.log(`Removed bug file: ${file}`);
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

  // Update the bug index README.md
  await updateBugIndex(fs, path, bugsDir);

  return {
    createdFiles,
    removedFiles,
  };
};

/**
 * Updates the bug index README.md file
 *
 * @param {object} fs - The Node.js fs module
 * @param {object} path - The Node.js path module
 * @param {string} bugsDir - Path to the bugs directory
 */
async function updateBugIndex(fs, path, bugsDir) {
  // Get all bug files
  const bugFiles = fs
    .readdirSync(bugsDir)
    .filter(f => f.match(/^\d{3}-.+\.md$/) && f !== 'README.md')
    .sort((a, b) => {
      // Sort by bug ID (numeric)
      const idA = parseInt(a.match(/^(\d{3})/)[1], 10);
      const idB = parseInt(b.match(/^(\d{3})/)[1], 10);
      return idA - idB;
    });

  console.log(`Found ${bugFiles.length} bug files for index`);

  // Create table entries for each bug file
  const tableEntries = [];

  for (const file of bugFiles) {
    try {
      const content = fs.readFileSync(path.join(bugsDir, file), 'utf8');

      // Extract bug ID from filename
      const idMatch = file.match(/^(\d{3})/);
      if (!idMatch) continue;
      const bugId = idMatch[1];

      // Extract title from content
      const titleMatch = content.match(/# Bug \d+: (.*)/);
      const title = titleMatch ? titleMatch[1].trim() : 'Unknown Title';

      // Extract component
      const componentMatch = content.match(/## Component\s+`?([^`\n]+)`?/);
      const component = componentMatch ? componentMatch[1].trim() : 'Unknown';

      // Extract severity
      const severityMatch = content.match(/## Severity\s+([^\n]+)/);
      const severity = severityMatch ? severityMatch[1].trim() : 'Unknown';

      // Extract date reported
      const dateReportedMatch = content.match(/## Date Reported\s+([^\n]+)/);
      const dateReported = dateReportedMatch ? dateReportedMatch[1].trim() : '';

      // Add table entry
      tableEntries.push({
        id: bugId,
        file,
        title,
        component,
        severity,
        dateReported,
      });

      console.log(`Processed bug #${bugId}: ${title}`);
    } catch (error) {
      console.error(`Error processing file ${file}: ${error.message}`);
    }
  }

  // Create the README.md content
  const indexPath = path.join(bugsDir, 'README.md');

  // Create the content with the updated table
  const indexContent = `# Bug Tracking Index

This directory contains documentation for bugs that have been identified in the Slack-Bitbucket Merge Control Chrome Extension.

## Bug List

| ID | Title | Component | Severity | Date Reported |
| -- | ----- | --------- | -------- | ------------- |
${tableEntries
  .map(
    entry =>
      `| [${entry.id}](./${entry.file}) | ${entry.title} | ${entry.component} | ${entry.severity} | ${entry.dateReported} |`
  )
  .join('\n')}

## How to Add a New Bug

1. Create a GitHub issue with the 'bug' label
2. Fill out the bug report template
3. The bug file will be automatically created

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

## Severity Levels

- **Critical**: Application crashes, data loss, security vulnerability
- **High**: Major functionality broken, no workaround available
- **Medium**: Functionality works but with issues, workaround available
- **Low**: Minor issues, cosmetic problems, edge cases`;

  // Write the updated content back to the file
  fs.writeFileSync(indexPath, indexContent);
  console.log(`Updated bug index at ${indexPath}`);
}
