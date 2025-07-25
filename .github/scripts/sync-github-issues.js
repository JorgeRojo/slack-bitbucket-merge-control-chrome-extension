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

  // Define table header templates
  const TABLE_HEADER_TEMPLATE = columns => {
    const headers = columns.map(col => col.name);
    const separators = columns.map(() => '--');

    return `| ${headers.join(' | ')} |
| ${separators.join(' | ')} |`;
  };

  const BUG_COLUMNS = [
    { name: 'ID', width: 2 },
    { name: 'Title', width: 5 },
    { name: 'Component', width: 9 },
    { name: 'Severity', width: 8 },
    { name: 'Date Reported', width: 13 },
  ];

  const FEATURE_COLUMNS = [
    { name: 'ID', width: 2 },
    { name: 'Title', width: 5 },
    { name: 'Component', width: 9 },
    { name: 'Priority', width: 8 },
    { name: 'Date Requested', width: 14 },
  ];

  const BUG_TABLE_HEADER = TABLE_HEADER_TEMPLATE(BUG_COLUMNS);
  const FEATURE_TABLE_HEADER = TABLE_HEADER_TEMPLATE(FEATURE_COLUMNS);

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
    bugTableHeader: BUG_TABLE_HEADER,
    featureTableHeader: FEATURE_TABLE_HEADER,
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
 * @param {string} params.bugTableHeader - Bug table header template
 * @param {string} params.featureTableHeader - Feature table header template
 */
async function updateCommonReadme({
  fs,
  issuesTrackingFile,
  bugEntries,
  featureEntries,
  bugTableHeader,
  featureTableHeader,
}) {
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
    `Updating issues tracking file with ${bugEntries.length} bugs and ${featureEntries.length} features`
  );

  // Read the existing content
  let existingContent = '';
  try {
    existingContent = fs.readFileSync(issuesTrackingFile, 'utf8');
  } catch (error) {
    console.error(`Error reading ${issuesTrackingFile}: ${error.message}`);
    console.log('Creating new file with default content');
    // If file doesn't exist, we'll create it with default content later
  }

  // Create the bug list content
  const bugListContent =
    bugEntries.length > 0
      ? bugEntries
          .map(
            entry =>
              `| [${entry.id}](./bugs/${entry.file}) | ${entry.title} | ${entry.component} | ${entry.severity} | ${entry.dateReported} |`
          )
          .join('\n')
      : '<!-- No bugs yet -->';

  // Create the feature list content
  const featureListContent =
    featureEntries.length > 0
      ? featureEntries
          .map(
            entry =>
              `| [${entry.id}](./features/${entry.file}) | ${entry.title} | ${entry.component} | ${entry.priority} | ${entry.dateReported} |`
          )
          .join('\n')
      : '<!-- No features yet -->';

  // If the file exists, update only the bug and feature lists
  if (existingContent) {
    // Define the markers for the bug list section
    const bugListStartMarker = '## Open Bug List';
    const bugListEndMarker = '## Open Feature List';

    // Define the markers for the feature list section
    const featureListStartMarker = '## Open Feature List';
    const featureListEndMarker = '## How to Add a New Issue';

    // Find the bug list section
    const bugListStartIndex = existingContent.indexOf(bugListStartMarker);
    const bugListEndIndex = existingContent.indexOf(bugListEndMarker);

    // Find the feature list section
    const featureListStartIndex = existingContent.indexOf(featureListStartMarker);
    const featureListEndIndex = existingContent.indexOf(featureListEndMarker);

    // Check if we found all the markers
    if (
      bugListStartIndex === -1 ||
      bugListEndIndex === -1 ||
      featureListStartIndex === -1 ||
      featureListEndIndex === -1
    ) {
      console.error('Could not find all section markers in the file. Using default template.');
      createDefaultFile();
      return;
    }

    // Extract the header before the bug list
    const headerContent = existingContent.substring(
      0,
      bugListStartIndex + bugListStartMarker.length
    );

    // Extract the content between bug list and feature list
    const betweenListsContent = existingContent.substring(
      bugListEndIndex,
      featureListStartIndex + featureListStartMarker.length
    );

    // Extract the footer after the feature list
    const footerContent = existingContent.substring(featureListEndIndex);

    // Construct the new content
    const newContent = `${headerContent}

${bugTableHeader}
${bugListContent}

${betweenListsContent}

${featureTableHeader}
${featureListContent}

${footerContent}`;

    // Write the updated content back to the file
    fs.writeFileSync(issuesTrackingFile, newContent);
    console.log(`Updated issues tracking file at ${issuesTrackingFile}`);
  } else {
    // If the file doesn't exist or we couldn't find the markers, create it with default content
    createDefaultFile();
  }

  // Function to create the default file if needed
  function createDefaultFile() {
    const defaultContent = `# Issue Tracking Index

This directory contains documentation for bugs and features in the Slack-Bitbucket Merge Control Chrome Extension.

## Open Bug List

${bugTableHeader}
${bugListContent}

## Open Feature List

${featureTableHeader}
${featureListContent}

## How to Add a New Issue

1. Create a GitHub issue with the appropriate label ('bug' or 'feature')
2. Fill out the issue template
3. The documentation file will be automatically created`;

    fs.writeFileSync(issuesTrackingFile, defaultContent);
    console.log(`Created new issues tracking file with minimal content at ${issuesTrackingFile}`);
  }
}
