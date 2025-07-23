import fs from 'fs';
import { glob } from 'glob';

// Find all test files
async function main() {
  const testFiles = await glob('tests/**/*.ts');

  // Process each file
  testFiles.forEach(file => {
    console.log(`Processing ${file}...`);

    // Read the file content
    let content = fs.readFileSync(file, 'utf8');
    let modified = false;

    // Update imports from @src/../tests/setup
    const setupImportRegex = /from\s+['"]@src\/\.\.\/tests\/([^'"]+)['"]/g;
    let match;

    while ((match = setupImportRegex.exec(content)) !== null) {
      const fullImport = match[0];
      const importPath = match[1];
      const newImport = `from '@tests/${importPath}'`;

      content = content.replace(fullImport, newImport);
      modified = true;

      console.log(`  Updated: ${fullImport} -> ${newImport}`);
    }

    // Update dynamic imports from @src/../tests/setup
    const dynamicSetupImportRegex = /import\(['"]@src\/\.\.\/tests\/([^'"]+)['"]\)/g;

    while ((match = dynamicSetupImportRegex.exec(content)) !== null) {
      const fullImport = match[0];
      const importPath = match[1];
      const newImport = `import('@tests/${importPath}')`;

      content = content.replace(fullImport, newImport);
      modified = true;

      console.log(`  Updated dynamic: ${fullImport} -> ${newImport}`);
    }

    if (modified) {
      // Write the updated content back to the file
      fs.writeFileSync(file, content, 'utf8');
      console.log(`Updated ${file}`);
    } else {
      console.log(`No changes needed for ${file}`);
    }
  });

  console.log('All test imports updated successfully!');
}

main().catch(console.error);
