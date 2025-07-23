import fs from 'fs';
import { glob } from 'glob';

// Find all test files
async function main() {
  const testFiles = await glob('tests/**/*.ts');

  // Process each file
  testFiles.forEach(file => {
    console.log(`Processing ${file}...`);

    // Skip setup.ts and alias-example.test.ts
    if (file === 'tests/setup.ts' || file === 'tests/alias-example.test.ts') {
      console.log(`Skipping ${file}`);
      return;
    }

    // Read the file content
    let content = fs.readFileSync(file, 'utf8');

    // Update imports from setup.ts
    const setupImportRegex = /from\s+['"]\.\.\/setup['"]/g;
    if (setupImportRegex.test(content)) {
      // Calculate the relative path to setup.ts
      const depth = file.split('/').length - 2; // -2 for 'tests' and the file itself
      const relativePath = '../'.repeat(depth) + 'setup';

      content = content.replace(setupImportRegex, `from '${relativePath}'`);
      console.log(`  Updated setup import in ${file}`);
    }

    // Write the updated content back to the file
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Updated ${file}`);
  });

  console.log('All test imports updated successfully!');
}

main().catch(console.error);
