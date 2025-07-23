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

    // Update imports from ../../src/modules/...
    const srcImportRegex = /from\s+['"]\.\.\/\.\.\/src\/([^'"]+)['"]/g;
    let match;
    while ((match = srcImportRegex.exec(content)) !== null) {
      const fullImport = match[0];
      const importPath = match[1];
      const newImport = `from '@src/${importPath}'`;
      content = content.replace(fullImport, newImport);
      modified = true;
      console.log(`  Updated src import: ${fullImport} -> ${newImport}`);
    }

    // Update dynamic imports from ../../src/modules/...
    const dynamicSrcImportRegex = /import\(['"]\.\.\/\.\.\/src\/([^'"]+)['"]\)/g;
    while ((match = dynamicSrcImportRegex.exec(content)) !== null) {
      const fullImport = match[0];
      const importPath = match[1];
      const newImport = `import('@src/${importPath}')`;
      content = content.replace(fullImport, newImport);
      modified = true;
      console.log(`  Updated dynamic src import: ${fullImport} -> ${newImport}`);
    }

    // Update vi.mock calls for ../../src/modules/...
    const mockSrcImportRegex = /vi\.mock\(['"]\.\.\/\.\.\/src\/([^'"]+)['"]\)/g;
    while ((match = mockSrcImportRegex.exec(content)) !== null) {
      const fullImport = match[0];
      const importPath = match[1];
      const newImport = `vi.mock('@src/${importPath}')`;
      content = content.replace(fullImport, newImport);
      modified = true;
      console.log(`  Updated mock src import: ${fullImport} -> ${newImport}`);
    }

    // Update direct imports from ../../src/modules/...
    const directSrcImportRegex = /import\s+['"]\.\.\/\.\.\/src\/([^'"]+)['"]/g;
    while ((match = directSrcImportRegex.exec(content)) !== null) {
      const fullImport = match[0];
      const importPath = match[1];
      const newImport = `import '@src/${importPath}'`;
      content = content.replace(fullImport, newImport);
      modified = true;
      console.log(`  Updated direct src import: ${fullImport} -> ${newImport}`);
    }

    if (modified) {
      // Write the updated content back to the file
      fs.writeFileSync(file, content, 'utf8');
      console.log(`Updated ${file}`);
    } else {
      console.log(`No changes needed for ${file}`);
    }
  });

  console.log('All src imports updated successfully!');
}

main().catch(console.error);
