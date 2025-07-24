/**
 * Script to create a bug documentation file from a GitHub issue
 * 
 * @param {object} github - The GitHub API client
 * @param {object} context - The GitHub Actions context
 * @param {object} core - The GitHub Actions core library
 * @param {object} exec - The GitHub Actions exec library
 * @param {object} fs - The Node.js fs module
 * @param {object} path - The Node.js path module
 */
export default async ({ github, context, core, exec, fs, path }) => {
  const issue = context.payload.issue;
  
  // Skip if this issue was created from a bug file (to avoid circular references)
  if (issue.body && issue.body.includes('This issue was automatically created from')) {
    console.log('Issue was created from a bug file, skipping to avoid circular reference');
    return;
  }
  
  // Find the next available bug ID
  const bugsDir = 'documentation/bugs';
  if (!fs.existsSync(bugsDir)) {
    fs.mkdirSync(bugsDir, { recursive: true });
  }
  
  const bugFiles = fs.readdirSync(bugsDir).filter(f => f.match(/^\d{3}-.+\.md$/));
  let maxId = 0;
  
  bugFiles.forEach(file => {
    const idMatch = file.match(/^(\d{3})/);
    if (idMatch) {
      const id = parseInt(idMatch[1], 10);
      if (id > maxId) maxId = id;
    }
  });
  
  const nextId = String(maxId + 1).padStart(3, '0');
  
  // Extract information from the issue body
  // These field IDs match those in your bug_report.yml template
  const extractField = (body, fieldId) => {
    const regex = new RegExp(`### ${fieldId}\\s+([\\s\\S]*?)(?=###|$)`, 'i');
    const match = body.match(regex);
    return match ? match[1].trim() : '';
  };
  
  const component = extractField(issue.body, 'Component');
  const severity = extractField(issue.body, 'Severity').split(' - ')[0]; // Get just the severity level
  const reproduceSteps = extractField(issue.body, 'Steps to Reproduce');
  const currentBehavior = extractField(issue.body, 'Current Behavior');
  const expectedBehavior = extractField(issue.body, 'Expected Behavior');
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
  const bugContent = `# Bug ${nextId}: ${issue.title.replace(/^\[Bug\]:\s*/i, '')}

[GitHub Issue #${issue.number}](${issue.html_url})

## Component
\`${component}\`

## Date Reported
${new Date().toISOString().split('T')[0]}

## Status
Open

## Severity
${severity}

## Reproduce
${reproduceSteps.split('\n').map(line => line.trim() ? `- ${line.trim()}` : '').filter(Boolean).join('\n')}

## Current wrong behavior
${currentBehavior}

## Expected right behavior
${expectedBehavior}

## Root Cause
Not yet determined

## Fix Summary
Not yet fixed

## Tests Added/Modified
None yet

## Related Files
- \`${component}\`

${additionalContext ? `## Additional Context\n${additionalContext}` : ''}
`;
  
  // Write the bug file
  const bugFilePath = path.join(bugsDir, `${nextId}-${slug}.md`);
  fs.writeFileSync(bugFilePath, bugContent);
  
  // Update the bug index file
  const indexPath = path.join(bugsDir, 'README.md');
  if (fs.existsSync(indexPath)) {
    let indexContent = fs.readFileSync(indexPath, 'utf8');
    
    // Find the table in the index file
    const tableMatch = indexContent.match(/\| ID \| Title \| Component \| Status \| Severity \| Date Reported \| Date Fixed \|\n\|[-\|]+\n([\s\S]*?)(?=\n\n## |$)/);
    
    if (tableMatch) {
      const tableStart = indexContent.indexOf(tableMatch[0]);
      
      // Add the new entry to the table
      const today = new Date().toISOString().split('T')[0];
      const newEntry = `| [${nextId}](./${nextId}-${slug}.md) | ${issue.title.replace(/^\[Bug\]:\s*/i, '')} | ${component} | Open | ${severity} | ${today} | |\n`;
      
      // Insert the new entry after the header rows
      const headerEnd = indexContent.indexOf('\n', indexContent.indexOf('|----|-------|', tableStart)) + 1;
      indexContent = indexContent.substring(0, headerEnd) + newEntry + indexContent.substring(headerEnd);
      
      fs.writeFileSync(indexPath, indexContent);
    }
  }
  
  // Set up git user
  await exec.exec('git', ['config', 'user.name', 'GitHub Action']);
  await exec.exec('git', ['config', 'user.email', 'action@github.com']);
  
  // Commit and push changes
  await exec.exec('git', ['add', bugFilePath]);
  if (fs.existsSync(indexPath)) {
    await exec.exec('git', ['add', indexPath]);
  }
  await exec.exec('git', ['commit', '-m', `Create bug file #${nextId} from GitHub issue #${issue.number}`]);
  await exec.exec('git', ['push']);
  
  // Add a comment to the issue linking to the bug file
  await github.rest.issues.createComment({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: issue.number,
    body: `I've created a bug documentation file for this issue: [Bug #${nextId}](https://github.com/${context.repo.owner}/${context.repo.repo}/blob/master/${bugFilePath})`
  });
  
  return {
    bugId: nextId,
    bugFilePath,
    slug
  };
};
