import eslintPluginTypescript from '@typescript-eslint/eslint-plugin';
import eslintParserTypescript from '@typescript-eslint/parser';
import eslintConfigPrettier from 'eslint-config-prettier';
import eslintPluginPrettier from 'eslint-plugin-prettier';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', '.eslintrc.js'],
  },
  {
    files: ['src/**/*.ts', 'apps/**/*.ts', 'libs/**/*.ts', 'test/**/*.ts'],
    languageOptions: {
      parser: eslintParserTypescript,
      parserOptions: {
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
  },
  eslintConfigPrettier,
];
