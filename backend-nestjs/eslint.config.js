const eslintPluginTypescript = require('@typescript-eslint/eslint-plugin');
const eslintParserTypescript = require('@typescript-eslint/parser');
const eslintConfigPrettier = require('eslint-config-prettier');
const eslintPluginPrettier = require('eslint-plugin-prettier');

module.exports = [
  {
    files: ['{src,apps,libs,test}/**/*.ts'],
    languageOptions: {
      parser: eslintParserTypescript,
      parserOptions: {
        project: 'tsconfig.json',
        tsconfigRootDir: __dirname,
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': eslintPluginTypescript,
      prettier: eslintPluginPrettier,
    },
    rules: {
      '@typescript-eslint/interface-name-prefix': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'prettier/prettier': 'error',
    },
    ignores: ['.eslintrc.js'],
  },
  eslintConfigPrettier, // Add eslint-config-prettier to disable conflicting rules
];