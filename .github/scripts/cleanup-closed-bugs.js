/**
 * Script to remove bug files that are not in "Open" status
 *
 * @param {object} _github - The GitHub API client (unused)
 * @param {object} _context - The GitHub Actions context (unused)
 * @param {object} _core - The GitHub Actions core library (unused)
 * @param {object} _exec - The GitHub Actions exec library (unused)
 * @param {object} fs - The Node.js fs module
 * @param {object} path - The Node.js path module
 * @param {boolean} dryRun - If true, don't actually delete files, just report what would be deleted
 */
export default async ({ _github, _context, _core, _exec, fs, path, dryRun = false }) => {
  const bugsDir = 'documentation/bugs';

  // Ensure the bugs directory exists
  if (!fs.existsSync(bugsDir)) {
    console.log(`Bugs directory not found: ${bugsDir}`);
    return { removedFiles: [] };
  }

  // Get all bug files
  const bugFiles = fs
    .readdirSync(bugsDir)
    .filter(f => f.match(/^\d{3}-.+\.md$/) && f !== 'README.md');

  console.log(`Found ${bugFiles.length} bug files`);

  // Track files to be removed
  const filesToRemove = [];

  // Check each bug file
  for (const file of bugFiles) {
    try {
      const filePath = path.join(bugsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');

      // Extract status
      const statusMatch = content.match(/## Status\s+([^\n]+)/);
      const status = statusMatch ? statusMatch[1].trim() : '';

      // If status is not "Open", mark for removal
      if (status && status.toLowerCase() !== 'open') {
        console.log(`Bug file ${file} has status "${status}" - marking for removal`);
        filesToRemove.push({ file, filePath, status });
      }
    } catch (error) {
      console.error(`Error processing file ${file}: ${error.message}`);
    }
  }

  // If dry run, just return what would be removed
  if (dryRun) {
    console.log(`Dry run - would remove ${filesToRemove.length} files`);
    return {
      removedFiles: filesToRemove.map(f => ({ file: f.file, status: f.status })),
      dryRun: true,
    };
  }

  // Remove the files
  for (const fileInfo of filesToRemove) {
    try {
      fs.unlinkSync(fileInfo.filePath);
      console.log(`Removed bug file: ${fileInfo.file}`);
    } catch (error) {
      console.error(`Error removing file ${fileInfo.file}: ${error.message}`);
    }
  }

  // If any files were removed, update the bug index
  if (filesToRemove.length > 0) {
    try {
      // Import the update-bug-index script
      const updateBugIndexPath = path.join(
        process.env.GITHUB_WORKSPACE || '.',
        '.github',
        'scripts',
        'update-bug-index.js'
      );
      console.log(`Loading update-bug-index script from: ${updateBugIndexPath}`);

      const updateBugIndexModule = await import(`file://${updateBugIndexPath}`);
      const updateBugIndex = updateBugIndexModule.default;

      // Execute the script to update the bug index
      await updateBugIndex({ fs, path });
      console.log('Bug index updated successfully');
    } catch (error) {
      console.error(`Error updating bug index: ${error.message}`);
    }
  }

  return {
    removedFiles: filesToRemove.map(f => ({ file: f.file, status: f.status })),
    dryRun: false,
  };
};
