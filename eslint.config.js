import globals from 'globals';
import pluginJs from '@eslint/js';
import pluginPrettier from 'eslint-plugin-prettier';
import configPrettier from 'eslint-config-prettier';
import pluginImport from 'eslint-plugin-import';
import pluginJest from 'eslint-plugin-jest';

export default [
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.jest,
        chrome: 'readonly',
      },
      ecmaVersion: 2020,
      sourceType: 'module',
    },
    plugins: {
      prettier: pluginPrettier,
      import: pluginImport,
      jest: pluginJest,
    },
    rules: {
      ...pluginJs.configs.recommended.rules,
      ...configPrettier.rules,
      ...pluginJest.configs.recommended.rules,
      'prettier/prettier': 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
];
