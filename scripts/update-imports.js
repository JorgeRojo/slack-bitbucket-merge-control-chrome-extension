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

    // Replace relative imports with @src alias
    content = content.replace(/from\s+['"]\.\.\/src\/(.*?)['"]/g, "from '@src/$1'");
    content = content.replace(/import\(['"]\.\.\/src\/(.*?)['"]\)/g, "import('@src/$1')");
    content = content.replace(/vi\.mock\(['"]\.\.\/src\/(.*?)['"]\)/g, "vi.mock('@src/$1')");
    content = content.replace(
      /vi\.importActual\(['"]\.\.\/src\/(.*?)['"]\)/g,
      "vi.importActual('@src/$1')"
    );

    // Write the updated content back to the file
    fs.writeFileSync(file, content, 'utf8');

    console.log(`Updated ${file}`);
  });

  console.log('All imports updated successfully!');
}

main().catch(console.error);
