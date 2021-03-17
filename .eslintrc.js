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

module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:node/recommended',
    'plugin:mocha/recommended',
    'plugin:jsdoc/recommended',
    'prettier',
  ],
  settings: {
    jsdoc: {
      ignorePrivate: true,
      ignoreInternal: true,
    },
  },
  rules: {
    // We intentionally use `any` in a few places for user values.
    '@typescript-eslint/explicit-module-boundary-types': [
      'error',
      {
        allowArgumentsExplicitlyTypedAsAny: true,
      },
    ],

    // We use the typescript compiler to transpile import statements into
    // require statements, so this isn't actually valid
    'node/no-unsupported-features/es-syntax': [
      'error',
      {
        ignores: ['modules'],
      },
    ],

    // Reconfigure the checker to include ts files.
    'node/no-missing-import': [
      'error',
      {
        tryExtensions: ['.js', '.ts'],
      },
    ],
    'node/no-missing-require': [
      'error',
      {
        tryExtensions: ['.js', '.ts'],
      },
    ],

    // Add the category and internal tags that we use.
    'jsdoc/check-tag-names': [
      'warn',
      {
        definedTags: ['category', 'internal'],
      },
    ],

    // Reconfigure jsdoc to require doc blocks for anything which we do
    // not have marked as private or protected.
    'jsdoc/require-jsdoc': [
      'warn',
      {
        contexts: needsDocsContexts,
      },
    ],

    // Reconfigure jsdoc to require descriptions for all doc blocks.  This is
    // really an extension of the above requirement.
    'jsdoc/require-description': [
      'warn',
      {
        contexts: needsDocsContexts,
      },
    ],
    'jsdoc/require-description-complete-sentence': 'warn',

    // We get type information from typescript.
    'jsdoc/require-returns': 'off',
    'jsdoc/require-param-type': 'off',

    // We intentionally use `any` in a few places for user values.
    '@typescript-eslint/no-explicit-any': 'off',

    // There are a number of places we need to do this for code clarity,
    // especially around handling backwards-compatibility.
    'prefer-rest-params': 'off',
  },
}
