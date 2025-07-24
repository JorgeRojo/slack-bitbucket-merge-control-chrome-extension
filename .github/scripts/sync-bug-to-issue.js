/**
 * Script to create a GitHub issue from a bug documentation file
 * 
 * @param {object} github - The GitHub API client
 * @param {object} context - The GitHub Actions context
 * @param {object} core - The GitHub Actions core library
 * @param {object} exec - The GitHub Actions exec library
 * @param {object} fs - The Node.js fs module
 * @param {object} path - The Node.js path module
 * @param {string} file - The path to the bug documentation file
 */
export default async ({ github, context, core, exec, fs, path, file }) => {
  console.log(`Processing bug file: ${file}`);
  
  // Read the bug file content
  const content = fs.readFileSync(file, 'utf8');
  
  // Check if this bug already has a GitHub issue linked
  if (content.includes('GitHub Issue #')) {
    console.log(`Bug in ${file} already has a GitHub issue linked. Skipping.`);
    return null;
  }
  
  // Extract bug details using regex
  const titleMatch = content.match(/# Bug (\d{3}): (.+)/);
  if (!titleMatch) {
    console.log(`Could not extract bug ID and title from ${file}. Skipping.`);
    return null;
  }
  
  const bugId = titleMatch[1];
  const title = titleMatch[2];
  
  const componentMatch = content.match(/## Component\s+`(.+)`/);
  const component = componentMatch ? componentMatch[1] : 'Unknown';
  
  const severityMatch = content.match(/## Severity\s+(.+)/);
  let severity = 'medium';
  if (severityMatch) {
    // Extract just the severity level (Critical, High, Medium, Low)
    const severityText = severityMatch[1].trim();
    if (severityText.toLowerCase().startsWith('critical')) {
      severity = 'critical';
    } else if (severityText.toLowerCase().startsWith('high')) {
      severity = 'high';
    } else if (severityText.toLowerCase().startsWith('medium')) {
      severity = 'medium';
    } else if (severityText.toLowerCase().startsWith('low')) {
      severity = 'low';
    }
  }
  
  const reproduceMatch = content.match(/## Reproduce\s+([\s\S]*?)(?=##|$)/);
  const reproduce = reproduceMatch ? reproduceMatch[1].trim() : '';
  
  const currentMatch = content.match(/## Current wrong behavior\s+([\s\S]*?)(?=##|$)/);
  const current = currentMatch ? currentMatch[1].trim() : '';
  
  const expectedMatch = content.match(/## Expected right behavior\s+([\s\S]*?)(?=##|$)/);
  const expected = expectedMatch ? expectedMatch[1].trim() : '';
  
  const contextMatch = content.match(/## Additional Context\s+([\s\S]*?)(?=##|$)/);
  const additionalContext = contextMatch ? contextMatch[1].trim() : '';
  
  // Create issue body
  const body = `This issue was automatically created from a bug report in the project's documentation.

[View full bug report](https://github.com/${context.repo.owner}/${context.repo.repo}/blob/master/${file})

### Component
${component}

### Severity
${severityMatch ? severityMatch[1] : 'Medium'}

### Steps to Reproduce
${reproduce}

### Current Behavior
${current}

### Expected Behavior
${expected}

${additionalContext ? `### Additional Context\n${additionalContext}` : ''}`;
  
  let issue;
  try {
    // Create the GitHub issue with valid labels
    issue = await github.rest.issues.create({
      owner: context.repo.owner,
      repo: context.repo.repo,
      title: `Bug #${bugId}: ${title}`,
      body: body,
      labels: ['bug', `severity:${severity}`]
    });
    
    console.log(`Created issue #${issue.data.number} for bug #${bugId}`);
  } catch (error) {
    console.log(`Error creating issue for bug #${bugId}: ${error.message}`);
    if (error.status === 422 && error.message.includes('Label')) {
      console.log('This is likely due to invalid label names. Using only "bug" label.');
      // Try again with just the bug label
      try {
        issue = await github.rest.issues.create({
          owner: context.repo.owner,
          repo: context.repo.repo,
          title: `Bug #${bugId}: ${title}`,
          body: body,
          labels: ['bug']
        });
        console.log(`Created issue #${issue.data.number} for bug #${bugId} with only "bug" label`);
      } catch (retryError) {
        console.log(`Failed to create issue even with just "bug" label: ${retryError.message}`);
        core.setFailed(`Failed to create issue: ${retryError.message}`);
        throw retryError;
      }
    } else {
      core.setFailed(`Failed to create issue: ${error.message}`);
      throw error;
    }
  }
  
  // Update the bug file to include the issue link
  const updatedContent = content.replace(
    `# Bug ${bugId}: ${title}`,
    `# Bug ${bugId}: ${title}\n\n[GitHub Issue #${issue.data.number}](https://github.com/${context.repo.owner}/${context.repo.repo}/issues/${issue.data.number})`
  );
  
  fs.writeFileSync(file, updatedContent);
  
  try {
    // Set up git user
    await exec.exec('git', ['config', 'user.name', 'GitHub Action']);
    await exec.exec('git', ['config', 'user.email', 'action@github.com']);
    
    // Configure Git to pull with merge strategy
    await exec.exec('git', ['config', 'pull.rebase', 'false']);
    
    // Pull changes from remote
    await exec.exec('git', ['pull', 'origin', 'master']);
    
    // Commit the updated bug file with a special message
    await exec.exec('git', ['add', file]);
    await exec.exec('git', ['commit', '-m', `[AUTOMATED] Link bug #${bugId} to GitHub issue #${issue.data.number}`]);
    await exec.exec('git', ['push']);
  } catch (error) {
    console.log(`Warning: Could not push changes: ${error.message}`);
    console.log('The issue was still created successfully, but the bug file was not updated with the issue link.');
    core.setFailed(`Failed to push changes: ${error.message}`);
    throw error;
  }
  
  return {
    bugId,
    issueNumber: issue.data.number
  };
};
