import fs from 'fs';

// Read the file content
const filePath = 'tests/background.test.ts';
let content = fs.readFileSync(filePath, 'utf8');

// Fix problematic imports
content = content.replace(
  /import\("@src\/modules\/background\/background"\)'\);/g,
  "import('@src/modules/background/background');"
);
content = content.replace(
  /vi\.importActual\("@src\/modules\/background\/background"\)'\);/g,
  "vi.importActual('@src/modules/background/background');"
);
content = content.replace(
  /vi\.doMock\('\.\.\/src\/modules\/background\/background'/g,
  "vi.doMock('@src/modules/background/background'"
);

// Write the updated content back to the file
fs.writeFileSync(filePath, content, 'utf8');

console.log('Fixed imports in background.test.ts');
