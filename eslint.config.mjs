import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import pluginN from 'eslint-plugin-n'
import pluginMocha from 'eslint-plugin-mocha'
import pluginJsdoc from 'eslint-plugin-jsdoc'
import prettierConfig from 'eslint-config-prettier'
import globals from 'globals'

/**
 * Defines the AST nodes we expect to have documentation for.  It includes
 * most publicly defined stuff with the following exceptions:
 * - No need for descriptions on Options interfaces.
 * - No need to document setters.
 * - No need to document protected or private.
 * - No need to document inline types in function parameters.
 */
const needsDocsContexts = [
  'TSInterfaceDeclaration[id.name!=/.*Options/]',
  'TSTypeAliasDeclaration',
  'TSEnumDeclaration',
  'TSEnumMember',
  'TSMethodSignature[accessibility!=/(private|protected)/]',
  'ClassBody > TSPropertySignature[accessibility!=/(private|protected)/]',
  'TSInterfaceBody > TSPropertySignature[accessibility!=/(private|protected)/]',
  'FunctionDeclaration',
  'ClassDeclaration',
  'MethodDefinition[accessibility!=/(private|protected)/][kind!=/(set|constructor)/]',
  'ClassBody > ClassProperty[accessibility!=/(private|protected)/]',
]

export default [
  // Global ignores
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      '**/*.d.ts',
      'deps/**',
      'scripts/**',
      'tools/**',
    ],
  },

  // Base ESLint recommended rules
  js.configs.recommended,

  // TypeScript ESLint recommended rules
  ...tseslint.configs.recommended,

  // Main configuration for lib/ and test/
  {
    files: ['lib/**/*.ts', 'test/**/*.{js,ts}'],

    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: {
        ...globals.node,
        ...globals.es2021,
        ...globals.mocha,
      },
    },

    plugins: {
      '@typescript-eslint': tseslint.plugin,
      n: pluginN,
      mocha: pluginMocha,
      jsdoc: pluginJsdoc,
    },

    settings: {
      jsdoc: {
        ignorePrivate: true,
        ignoreInternal: true,
      },
    },

    rules: {
      // TypeScript rules
      '@typescript-eslint/explicit-module-boundary-types': [
        'error',
        {
          allowArgumentsExplicitlyTypedAsAny: true,
        },
      ],
      '@typescript-eslint/no-explicit-any': 'off',

      // TypeScript ESLint v8 new rules - allow empty interfaces for extending
      '@typescript-eslint/no-empty-object-type': [
        'error',
        {
          allowInterfaces: 'always',
        },
      ],

      // Allow unused vars if prefixed with underscore
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],

      // Node.js rules (migrated from eslint-plugin-node to eslint-plugin-n)
      'n/no-unsupported-features/es-syntax': [
        'error',
        {
          ignores: ['modules'],
        },
      ],
      'n/no-missing-import': [
        'error',
        {
          tryExtensions: ['.js', '.ts'],
        },
      ],
      'n/no-missing-require': [
        'error',
        {
          tryExtensions: ['.js', '.ts'],
        },
      ],

      // JSDoc rules
      'jsdoc/check-tag-names': [
        'warn',
        {
          definedTags: ['category', 'internal', 'experimental'],
        },
      ],
      'jsdoc/require-jsdoc': [
        'warn',
        {
          contexts: needsDocsContexts,
        },
      ],
      'jsdoc/require-description': [
        'warn',
        {
          contexts: needsDocsContexts,
        },
      ],
      'jsdoc/require-description-complete-sentence': 'warn',
      'jsdoc/require-returns': 'off',
      'jsdoc/require-param-type': 'off',
      'jsdoc/tag-lines': [
        'warn',
        'any',
        {
          startLines: 1,
        },
      ],
      'jsdoc/no-undefined-types': [
        'warn',
        {
          definedTypes: [
            'durabilityLevel',
            'effectiveRoles',
            'GetOptions',
            'IBucketSettings',
            'MutationState',
            'StorageBackend',
          ],
        },
      ],

      // Other rules
      'prefer-rest-params': 'off',
    },
  },

  // Test-specific overrides
  {
    files: ['test/**/*.{js,ts}'],
    rules: {
      '@typescript-eslint/no-var-requires': 'off',
      '@typescript-eslint/no-require-imports': 'off', // Tests use CommonJS
      'jsdoc/require-jsdoc': 'off',
    },
  },

  // Prettier config (must be last to override conflicting rules)
  prettierConfig,
]
