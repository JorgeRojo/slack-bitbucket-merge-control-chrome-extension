import pluginJs from '@eslint/js';
import typescriptEslint from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import configPrettier from 'eslint-config-prettier';
import pluginImport from 'eslint-plugin-import';
import pluginPrettier from 'eslint-plugin-prettier';
import globals from 'globals';

// Reglas compartidas para ordenar imports
const importOrderRules = {
  'import/order': [
    'error',
    {
      groups: [
        'builtin', // Módulos integrados de Node.js como 'fs', 'path', etc.
        'external', // Paquetes npm
        'internal', // Imports con alias como '@src/'
        'parent', // Imports que comienzan con '..'
        'sibling', // Imports que comienzan con './'
        'index', // Imports del mismo directorio
        'object', // Imports de objetos
        'type', // Imports de tipos
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
      ignoreDeclarationSort: true, // Ignoramos esto porque lo maneja import/order
      ignoreMemberSort: false, // Ordenar miembros en imports con llaves
    },
  ],
};

export default [
  {
    ignores: [
      'dist/**',
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
  // Configuración para archivos JavaScript
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
  // Configuración para archivos TypeScript
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
      // Desactivamos la regla nativa de ESLint para variables no utilizadas
      'no-unused-vars': 'off',
      // Activamos la regla de TypeScript para variables y parámetros no utilizados
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
  // Configuración específica para archivos de prueba
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
