// eslint.config.js
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import js from '@eslint/js'
import prettierPlugin from 'eslint-plugin-prettier'
import tsParser from '@typescript-eslint/parser'
import tsPlugin from '@typescript-eslint/eslint-plugin'

import globals from 'globals'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const prettierConfigPath = path.join(__dirname, '.prettierrc.json')
const prettierOptions = JSON.parse(fs.readFileSync(prettierConfigPath, 'utf8'))

export default [
  js.configs.recommended,

  // Global ignores
  {
    ignores: ['dist/**', 'node_modules/**', '*.tgz', '*.d.ts'],
  },

  // TypeScript and JavaScript files
  {
    files: ['**/*.js', '**/*.ts', '**/*.jsx', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      prettier: prettierPlugin,
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...tsPlugin.configs['recommended'].rules,
      'prettier/prettier': ['error', prettierOptions],

      'no-unused-vars': 'off', // let typescript handle this
      'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
      'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
      'no-undef': 'off', // let typescript handle this
      'no-empty': 'warn',
      'no-unreachable': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-shadow': 'off',
      '@typescript-eslint/no-shadow': ['error', { ignoreTypeValueShadow: true }],
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      'no-redeclare': 'off',
    },
  },
]
