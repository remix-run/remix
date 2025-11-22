import tseslint from 'typescript-eslint'
import preferLet from 'eslint-plugin-prefer-let'

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: [
      '**/*.d.ts',
      '**/dist/**',
      '**/coverage/**',
      '**/bench/**',
      '**/examples/**',
      '**/*.min.js',
      'node_modules/**',
      'reference/**',
      'packages/multipart-parser/demos/deno/**',
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
          selector: 'MethodDefinition[accessibility]',
          message:
            "Use native methods: omit 'public'; for private behavior use '#private' fields/methods.",
        },
        {
          selector: 'TSParameterProperty[accessibility]',
          message:
            "Avoid TS parameter properties; declare fields explicitly and use '#private' when needed.",
        },
      ],

      // Ensure no rule asks for explicit member accessibility
      '@typescript-eslint/explicit-member-accessibility': 'off',
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
]
