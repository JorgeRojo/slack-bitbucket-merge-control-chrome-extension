import fs from 'fs';
import { glob } from 'glob';

// Find all test files
async function main() {
  const testFiles = await glob('tests/modules/**/*.ts');

  // Process each file
  testFiles.forEach(file => {
    console.log(`Processing ${file}...`);

    // Read the file content
    let content = fs.readFileSync(file, 'utf8');
    let modified = false;

    // Update imports from ./setup
    const setupImportRegex = /from\s+['"]\.\/(setup)['"]/g;
    if (setupImportRegex.test(content)) {
      content = content.replace(setupImportRegex, `from '@src/../tests/setup'`);
      modified = true;
      console.log(`  Updated ./setup import in ${file}`);
    }

    // Update imports from ../setup
    const parentSetupImportRegex = /from\s+['"]\.\.\/+(setup)['"]/g;
    if (parentSetupImportRegex.test(content)) {
      content = content.replace(parentSetupImportRegex, `from '@src/../tests/setup'`);
      modified = true;
      console.log(`  Updated ../setup import in ${file}`);
    }

    // Update imports from ../../setup
    const grandparentSetupImportRegex = /from\s+['"]\.\.\/\.\.\/+(setup)['"]/g;
    if (grandparentSetupImportRegex.test(content)) {
      content = content.replace(grandparentSetupImportRegex, `from '@src/../tests/setup'`);
      modified = true;
      console.log(`  Updated ../../setup import in ${file}`);
    }

    // Update imports from ../../../setup
    const greatGrandparentSetupImportRegex = /from\s+['"]\.\.\/\.\.\/\.\.\/+(setup)['"]/g;
    if (greatGrandparentSetupImportRegex.test(content)) {
      content = content.replace(greatGrandparentSetupImportRegex, `from '@src/../tests/setup'`);
      modified = true;
      console.log(`  Updated ../../../setup import in ${file}`);
    }

    // Update imports from ../../../../setup
    const greatGreatGrandparentSetupImportRegex =
      /from\s+['"]\.\.\/\.\.\/\.\.\/\.\.\/+(setup)['"]/g;
    if (greatGreatGrandparentSetupImportRegex.test(content)) {
      content = content.replace(
        greatGreatGrandparentSetupImportRegex,
        `from '@src/../tests/setup'`
      );
      modified = true;
      console.log(`  Updated ../../../../setup import in ${file}`);
    }

    if (modified) {
      // Write the updated content back to the file
      fs.writeFileSync(file, content, 'utf8');
      console.log(`Updated ${file}`);
    } else {
      console.log(`No changes needed for ${file}`);
    }
  });

  console.log('All setup imports updated successfully!');
}

main().catch(console.error);
