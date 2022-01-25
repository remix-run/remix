module.exports = {
  plugins: [
    require("postcss-import"),
    require("postcss-preset-env")({
      stage: 1
    }),
    require("postcss-100vh-fix"),
    require("postcss-focus-visible")
  ]
};
