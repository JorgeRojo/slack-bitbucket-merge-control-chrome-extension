import globals from 'globals';
import pluginJs from '@eslint/js';
import pluginPrettier from 'eslint-plugin-prettier';
import configPrettier from 'eslint-config-prettier';
import pluginImport from 'eslint-plugin-import';

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
    },
    plugins: {
      prettier: pluginPrettier,
      import: pluginImport,
    },
    rules: {
      ...pluginJs.configs.recommended.rules,
      ...configPrettier.rules,
      'prettier/prettier': 'error',
    },
  },
];