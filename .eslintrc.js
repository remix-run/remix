module.exports = {
  root: true,
  extends: [
    require.resolve("./packages/remix-eslint-config/internal.js"),
    "plugin:markdown/recommended",
  ],
  plugins: ["markdown"],
  rules: {
    "prefer-let/prefer-let": "off",
  },
  overrides: [
    {
      files: [
        "packages/create-remix/templates/cloudflare-workers/**/*.js",
        "packages/remix-cloudflare-workers/**/*.ts",
      ],
      rules: {
        "no-restricted-globals": "off",
      },
    },
    {
      files: [
        "packages/remix-server-runtime/**/*.js?(x)",
        "packages/remix-server-runtime/**/*.ts?(x)",
      ],
      rules: {
        "node/no-unsupported-features/node-builtins": [
          "error",
          {
            version: ">=14.0.0",
            ignores: [],
          },
        ],
      },
    },
  ],
};
