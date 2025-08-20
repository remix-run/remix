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
