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
    let modified = false;

    // Update imports from setup.ts
    const setupImportRegex = /from\s+['"]\.\.\/+setup['"]/g;
    if (setupImportRegex.test(content)) {
      content = content.replace(setupImportRegex, `from '@src/../tests/setup'`);
      modified = true;
      console.log(`  Updated setup import in ${file}`);
    }

    // Update direct imports of setup.ts
    const directSetupImportRegex = /import\s+['"]\.\.\/+setup['"]/g;
    if (directSetupImportRegex.test(content)) {
      content = content.replace(directSetupImportRegex, `import '@src/../tests/setup'`);
      modified = true;
      console.log(`  Updated direct setup import in ${file}`);
    }

    // Update dynamic imports of setup.ts
    const dynamicSetupImportRegex = /import\(['"]\.\.\/+setup['"]\)/g;
    if (dynamicSetupImportRegex.test(content)) {
      content = content.replace(dynamicSetupImportRegex, `import('@src/../tests/setup')`);
      modified = true;
      console.log(`  Updated dynamic setup import in ${file}`);
    }

    // Update dynamic imports of setup.ts with ./ prefix
    const localSetupImportRegex = /import\(['"]\.\/setup['"]\)/g;
    if (localSetupImportRegex.test(content)) {
      content = content.replace(localSetupImportRegex, `import('@src/../tests/setup')`);
      modified = true;
      console.log(`  Updated local setup import in ${file}`);
    }

    // Update relative imports to src files
    const relativeImportRegex = /from\s+['"]\.\.\/+src\/([^'"]+)['"]/g;
    let match;
    while ((match = relativeImportRegex.exec(content)) !== null) {
      const fullImport = match[0];
      const importPath = match[1];
      const newImport = `from '@src/${importPath}'`;
      content = content.replace(fullImport, newImport);
      modified = true;
      console.log(`  Updated relative src import: ${fullImport} -> ${newImport}`);
    }

    // Update dynamic imports to src files
    const dynamicImportRegex = /import\(['"]\.\.\/+src\/([^'"]+)['"]\)/g;
    while ((match = dynamicImportRegex.exec(content)) !== null) {
      const fullImport = match[0];
      const importPath = match[1];
      const newImport = `import('@src/${importPath}')`;
      content = content.replace(fullImport, newImport);
      modified = true;
      console.log(`  Updated dynamic src import: ${fullImport} -> ${newImport}`);
    }

    // Update vi.mock calls
    const mockImportRegex = /vi\.mock\(['"]\.\.\/+src\/([^'"]+)['"]\)/g;
    while ((match = mockImportRegex.exec(content)) !== null) {
      const fullImport = match[0];
      const importPath = match[1];
      const newImport = `vi.mock('@src/${importPath}')`;
      content = content.replace(fullImport, newImport);
      modified = true;
      console.log(`  Updated mock import: ${fullImport} -> ${newImport}`);
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
