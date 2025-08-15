import pluginJs from '@eslint/js';
import typescriptEslint from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import configPrettier from 'eslint-config-prettier';
import pluginImport from 'eslint-plugin-import';
import pluginPrettier from 'eslint-plugin-prettier';
import globals from 'globals';

// Shared rules for import ordering
const importOrderRules = {
  'import/order': [
    'error',
    {
      groups: [
        'builtin', // Built-in Node.js modules like 'fs', 'path', etc.
        'external', // npm packages
        'internal', // Imports with aliases like '@src/'
        'parent', // Imports that start with '..'
        'sibling', // Imports that start with './'
        'index', // Imports from the same directory
        'object', // Object imports
        'type', // Type imports
      ],
      pathGroups: [
        {
          pattern: '@src/**',
          group: 'internal',
          position: 'before',
        },
        {
          pattern: '@tests/**',
          group: 'internal',
          position: 'before',
        },
      ],
      'newlines-between': 'always',
      alphabetize: {
        order: 'asc',
        caseInsensitive: true,
      },
    },
  ],
  'sort-imports': [
    'error',
    {
      ignoreDeclarationSort: true, // We ignore this because it's handled by import/order
      ignoreMemberSort: false, // Sort members in imports with braces
    },
  ],
};

export default [
  {
    ignores: [
      'dist/**',
      'tmp/**',
      'coverage/**',
      'node_modules/**',
      '*.log',
      '.DS_Store',
      'Thumbs.db',
      '.vscode/**',
      '.idea/**',
      '*.tmp',
      '*.temp',
    ],
  },
  // Configuration for JavaScript files
  {
    files: ['**/*.js', '**/*.cjs', '**/*.mjs'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        chrome: 'readonly',
      },
      ecmaVersion: 2020,
      sourceType: 'module',
    },
    plugins: {
      prettier: pluginPrettier,
      import: pluginImport,
    },
    rules: {
      ...pluginJs.configs.recommended.rules,
      ...configPrettier.rules,
      ...importOrderRules,
      'prettier/prettier': 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  // Configuration for TypeScript files
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        chrome: 'readonly',
      },
      ecmaVersion: 2020,
      sourceType: 'module',
      parser: typescriptParser,
      parserOptions: {
        project: './tsconfig.eslint.json',
      },
    },
    plugins: {
      prettier: pluginPrettier,
      import: pluginImport,
      '@typescript-eslint': typescriptEslint,
    },
    rules: {
      ...pluginJs.configs.recommended.rules,
      ...configPrettier.rules,
      ...importOrderRules,
      'prettier/prettier': 'error',
      // Disable the native ESLint rule for unused variables
      'no-unused-vars': 'off',
      // Enable the TypeScript rule for unused variables and parameters
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          vars: 'all',
          args: 'all',
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
    },
  },
  // Specific configuration for test files
  {
    files: ['**/*.test.ts', '**/*.test.js', '**/tests/**/*.ts', '**/tests/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.jest,
        ...globals.browser,
        ...globals.node,
        chrome: 'readonly',
        vi: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        jest: 'readonly',
      },
    },
  },
];
