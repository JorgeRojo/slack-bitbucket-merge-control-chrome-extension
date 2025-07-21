import globals from 'globals';
import pluginJs from '@eslint/js';
import pluginPrettier from 'eslint-plugin-prettier';
import configPrettier from 'eslint-config-prettier';
import pluginImport from 'eslint-plugin-import';
import tseslint from 'typescript-eslint';

export default [
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        chrome: 'readonly',
      },
      ecmaVersion: 2020,
      sourceType: 'module',
      parserOptions: {
        project: './tsconfig.json',
      },
    },
    plugins: {
      prettier: pluginPrettier,
      import: pluginImport,
      '@typescript-eslint': tseslint.plugin,
    },
    rules: {
      ...pluginJs.configs.recommended.rules,
      ...configPrettier.rules,
      ...tseslint.configs.recommended.rules,
      'prettier/prettier': 'error',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    ...tseslint.configs.recommended,
  },
];
