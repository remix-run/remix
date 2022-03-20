module.exports = {
  extends: ["@remix-run/eslint-config"],
  overrides: [
    {
      // all ```jsx & ```tsx code blocks in .md files
      files: ["**/*.md/*.jsx", "**/*.md/*.tsx"],
      rules: {
        "react/jsx-no-undef": "off",
      },
    },
  ],
};
