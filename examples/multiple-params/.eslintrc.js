module.exports = {
  extends: ["@remix-run/eslint-config"],
  overrides: [
    {
      // all ```jsx & ```tsx code blocks in .md files
      files: ["**/*.md/*.js", "**/*.md/*.jsx", "**/*.md/*.ts", "**/*.md/*.tsx"],
      rules: {
        "no-unreachable": "off",
        "jsx-a11y/alt-text": "off",
        "jsx-a11y/anchor-has-content": "off",
        "react/jsx-no-comment-textnodes": "off",
        "react/jsx-no-undef": "off",
      },
    },
    {
      // all ```ts & ```tsx code blocks in .md files
      files: ["**/*.md/*.ts", "**/*.md/*.tsx"],
      rules: {
        "@typescript-eslint/no-unused-expressions": "off",
        "@typescript-eslint/no-unused-vars": "off",
      },
    },
  ],
};
