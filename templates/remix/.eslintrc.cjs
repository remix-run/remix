// ESLint configuration recommended for Remix templates
// This is a minimal, modern example that works for both JavaScript and TypeScript projects.
// Adjust parser/plugins according to your project's needs.

module.exports = {
  root: true,
  env: {
    browser: true,
    node: true,
    es2024: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
    "plugin:jsx-a11y/recommended",
    "prettier"
  ],
  settings: {
    react: {
      version: "detect"
    }
  },
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module"
  },
  rules: {
    "react/react-in-jsx-scope": "off"
  },
  overrides: [
    {
      files: ["*.ts", "*.tsx"],
      parser: "@typescript-eslint/parser",
      extends: ["plugin:@typescript-eslint/recommended"],
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: __dirname,
      }
    },
    {
      files: [".eslintrc.cjs", "scripts/**/*.js"],
      env: { node: true }
    }
  ]
};
