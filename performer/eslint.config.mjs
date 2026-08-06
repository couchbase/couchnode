// eslint.config.mjs
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import prettierConfig from 'eslint-config-prettier'
import prettierPlugin from 'eslint-plugin-prettier'

export default tseslint.config(
  // Recommended ESLint rules
  js.configs.recommended,

  // TypeScript ESLint recommended rules
  ...tseslint.configs.recommended,

  // Apply to TypeScript files
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: './tsconfig.json',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      prettier: prettierPlugin,
    },
    rules: {
      // Prettier integration
      'prettier/prettier': 'error',

      // Your custom rules
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  // Prettier config (disables conflicting rules)
  prettierConfig,

  // Ignore patterns (equivalent to .eslintignore)
  {
    ignores: ['node_modules/**', 'src/build/**', 'src/proto/**'],
  }
)
