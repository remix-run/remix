module.exports = {
  extends: "../../.eslintrc.js",
  rules: {
    // we have an example where we need this
    "no-undef": 0,
  },
  overrides: [
    {
      files: ["rollup.config.js"],
      rules: {
        "no-undef": 2,
      },
    },
  ],
};
