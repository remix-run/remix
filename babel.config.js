module.exports = {
  presets: [
    [
      "@babel/preset-env",
      {
        targets: {
          node: "18",
        },
      },
    ],
    "@babel/preset-react",
    "@babel/preset-typescript",
  ],
  plugins: [
    // Strip console.debug calls unless REMIX_DEBUG=true
    ...(process.env.REMIX_DEBUG === "true"
      ? []
      : [
          [
            "transform-remove-console",
            { exclude: ["error", "warn", "log", "info"] },
          ],
        ]),
  ],
};
