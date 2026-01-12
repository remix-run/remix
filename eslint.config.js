import tseslint from 'typescript-eslint'
import importPlugin from 'eslint-plugin-import'
import jsdoc from 'eslint-plugin-jsdoc'
import preferLet from 'eslint-plugin-prefer-let'

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: [
      '**/*.d.ts',
      '**/dist/**',
      '**/docs/**',
      '**/demos/bookstore/public/assets/**',
      '**/demos/sse/public/assets/**',
      '**/coverage/**',
      '**/bench/**',
      '**/examples/**',
      '**/*.min.js',
      '**/*.bundled.*',
      '**/public/assets/**',
      'node_modules/**',
      'reference/**',
      'packages/multipart-parser/demos/deno/**',
      'packages/remix/src/lib/**',
    ],
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        sourceType: 'module',
        ecmaVersion: 'latest',
        // Enable typed linting across the monorepo without listing every tsconfig
        projectService: true,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      import: importPlugin,
    },
    rules: {
      // Always use `import type { X }` and keep type imports separate from value imports
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
          fixStyle: 'separate-type-imports',
        },
      ],

      // Always use `export type { X }`; avoid mixing type and value exports
      '@typescript-eslint/consistent-type-exports': [
        'error',
        {
          // false => prefer splitting into separate `export type {}` and `export {}`
          fixMixedExportsWithInlineTypeSpecifier: false,
        },
      ],

      // Prefer native public and #private over TS accessibility modifiers
      // Disallow `public`/`private`/`protected` on class fields, methods, and parameter properties
      'no-restricted-syntax': [
        'error',
        {
          selector: 'PropertyDefinition[accessibility]',
          message: "Use native class fields: omit 'public' and use '#private' for private state.",
        },
        {
          selector: 'MethodDefinition[accessibility]:not([kind="constructor"])',
          message:
            "Use native methods: omit 'public'; for private behavior use '#private' fields/methods.",
        },
        {
          selector: 'MethodDefinition[accessibility="public"][kind="constructor"]',
          message: "Omit 'public' on constructors; it's the default.",
        },
        {
          selector: 'TSParameterProperty[accessibility]',
          message:
            "Avoid TS parameter properties; declare fields explicitly and use '#private' when needed.",
        },
      ],

      // Ensure no rule asks for explicit member accessibility
      '@typescript-eslint/explicit-member-accessibility': 'off',

      // Require file extensions on imports
      'import/extensions': [
        'error',
        'always',
        {
          ignorePackages: true,
        },
      ],
    },
  },
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    plugins: {
      'prefer-let': preferLet,
    },
    rules: {
      // Prefer `let` for locals; allow `const` only at module scope
      'prefer-let/prefer-let': 'error',
      // Disallow `var` entirely
      'no-var': 'error',
    },
  },
  {
    files: ['packages/**/*.{ts,tsx}'],
    ignores: ['packages/**/*.test.ts'],
    plugins: { jsdoc },
    settings: {
      jsdoc: {
        // Set our own contexts at the root to identify the types of things we care
        // to enforce JSDoc rules on.  Mostly we care about:
        // - exported public APIs
        // - not private class methods
        // - not private class properties
        // - not anything marked `@private` (`ignorePrivate` setting)
        contexts: [
          // function foo() {}
          'ClassDeclaration',
          // function foo() {}
          'FunctionDeclaration',
          // let foo = function () {}
          ':not(MethodDefinition) > FunctionExpression',
          // Class{ foo() {} } but not Class{ #foo() {} } or Class { get foo() {} }
          'MethodDefinition:not([kind=get]):not([key.type=PrivateIdentifier]) FunctionExpression',
          // let foo = () => {}
          ':not(PropertyDefinition) > ArrowFunctionExpression',
          // Class{ foo = () => {} } but not Class{ #foo = () => {} }
          'PropertyDefinition:not([key.type=PrivateIdentifier]) ArrowFunctionExpression',
        ],
        ignorePrivate: true,
        tagNamePreference: {
          // TODO: Temporarily allow both `@returns` and `@return`, but
          // eventually we can find/replace to the standard `@returns` and
          // remove this setting
          return: 'return',
        },
      },
    },
    rules: {
      // Using modified base rulesets from:
      // https://github.com/gajus/eslint-plugin-jsdoc?tab=readme-ov-file#granular-flat-configs

      // Modified version of jsdoc/flat/contents-typescript-error
      'jsdoc/informative-docs': 'off',
      'jsdoc/match-description': 'off',
      'jsdoc/no-blank-block-descriptions': 'error',
      'jsdoc/no-blank-blocks': 'error',
      'jsdoc/text-escaping': 'off',

      // Modified version of jsdoc/flat/logical-typescript-error
      'jsdoc/check-access': 'error',
      'jsdoc/check-param-names': 'error',
      'jsdoc/check-property-names': 'error',
      'jsdoc/check-syntax': 'error',
      'jsdoc/check-tag-names': ['error'],
      'jsdoc/check-template-names': 'error',
      'jsdoc/check-types': 'error',
      'jsdoc/check-values': 'error',
      'jsdoc/empty-tags': 'error',
      'jsdoc/escape-inline-tags': 'error',
      'jsdoc/implements-on-classes': 'error',
      'jsdoc/require-returns-check': 'error',
      'jsdoc/require-yields-check': 'error',
      'jsdoc/no-bad-blocks': 'error',
      'jsdoc/no-defaults': 'error',
      'jsdoc/no-types': 'error',
      'jsdoc/no-undefined-types': 'error',
      'jsdoc/valid-types': 'error',

      // Modified version of jsdoc/flat/stylistic-typescript-error
      'jsdoc/check-alignment': 'error',
      'jsdoc/check-line-alignment': 'error',
      'jsdoc/lines-before-block': 'off',
      'jsdoc/multiline-blocks': 'error',
      'jsdoc/no-multi-asterisks': 'error',
      'jsdoc/require-asterisk-prefix': 'error',
      'jsdoc/require-hyphen-before-param-description': ['error', 'never'],
      'jsdoc/tag-lines': 'off',

      // Additional rules we manually added
      'jsdoc/require-param': 'error',
      'jsdoc/require-param-description': 'error',
      'jsdoc/require-param-name': 'error',
      'jsdoc/require-returns': 'error',
      'jsdoc/require-returns-description': 'error',
    },
  },
]
