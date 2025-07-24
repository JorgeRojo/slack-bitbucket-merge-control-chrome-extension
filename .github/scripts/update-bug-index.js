/**
 * Script to update the bug index README.md with all existing bug files
 *
 * @param {object} fs - The Node.js fs module
 * @param {object} path - The Node.js path module
 */
export default async ({ fs, path }) => {
  const bugsDir = 'documentation/bugs';
  
  // Ensure the bugs directory exists
  if (!fs.existsSync(bugsDir)) {
    console.log(`Creating bugs directory: ${bugsDir}`);
    fs.mkdirSync(bugsDir, { recursive: true });
  }

  // Get all bug files
  const bugFiles = fs.readdirSync(bugsDir)
    .filter(f => f.match(/^\d{3}-.+\.md$/) && f !== 'README.md')
    .sort((a, b) => {
      // Sort by bug ID (numeric)
      const idA = parseInt(a.match(/^(\d{3})/)[1], 10);
      const idB = parseInt(b.match(/^(\d{3})/)[1], 10);
      return idA - idB;
    });

  console.log(`Found ${bugFiles.length} bug files`);

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
      
      // Extract status
      const statusMatch = content.match(/## Status\s+([^\n]+)/);
      const status = statusMatch ? statusMatch[1].trim() : 'Unknown';
      
      // Extract severity
      const severityMatch = content.match(/## Severity\s+([^\n]+)/);
      const severity = severityMatch ? severityMatch[1].trim() : 'Unknown';
      
      // Extract date reported
      const dateReportedMatch = content.match(/## Date Reported\s+([^\n]+)/);
      const dateReported = dateReportedMatch ? dateReportedMatch[1].trim() : '';
      
      // Try to extract date fixed if status is Fixed
      let dateFixed = '';
      if (status.toLowerCase() === 'fixed') {
        const dateFixedMatch = content.match(/## Date Fixed\s+([^\n]+)/);
        dateFixed = dateFixedMatch ? dateFixedMatch[1].trim() : '';
      }
      
      // Add table entry
      tableEntries.push({
        id: bugId,
        file,
        title,
        component,
        status,
        severity,
        dateReported,
        dateFixed
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

This directory contains documentation for bugs that have been identified and fixed in the Slack-Bitbucket Merge Control Chrome Extension.

## Bug List

| ID | Title | Component | Status | Severity | Date Reported | Date Fixed |
| --- | ----- | --------- | ------ | -------- | ------------ | --------- |
${tableEntries.map(entry => 
  `| [${entry.id}](./${entry.file}) | ${entry.title} | ${entry.component} | ${entry.status} | ${entry.severity} | ${entry.dateReported} | ${entry.dateFixed} |`
).join('\n')}

## How to Add a New Bug

1. Create a new file in this directory with the format: \`XXX-brief-description.md\` where XXX is the next available bug number
2. Use the template below for the bug documentation
3. Add an entry to the table above

## Bug Template

\`\`\`markdown
# Bug XXX: Brief Title

## Component

Which component/file contains the bug

## Date Reported

YYYY-MM-DD

## Status

[Open/Fixed/Won't Fix]

## Severity

[Critical/High/Medium/Low]

## Reproduce

Steps to reproduce the bug

## Current wrong behavior

Description of the incorrect behavior

## Expected right behavior

Description of what should happen

## Root Cause

Analysis of what caused the bug

## Fix Summary

How the bug was fixed (if applicable)

## Tests Added/Modified

What tests were added or changed to prevent regression

## Related Files

- List of files affected by the bug or the fix
\`\`\`

## Severity Levels

- **Critical**: Application crashes, data loss, security vulnerability
- **High**: Major functionality broken, no workaround available
- **Medium**: Functionality works but with issues, workaround available
- **Low**: Minor issues, cosmetic problems, edge cases`;

  // Write the updated content back to the file
  fs.writeFileSync(indexPath, indexContent);
  console.log(`Updated bug index at ${indexPath}`);

  return {
    bugsProcessed: tableEntries.length,
    indexPath
  };
};
