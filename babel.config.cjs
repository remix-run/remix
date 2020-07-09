// This config is used by Jest to run Babel over our tests and
// source files. It is not used for running the build or publishing.

// This is a CommonJS module because when we run Babel inside
// of Jest, it complains that it needs to be run in asynchronous
// mode. No idea why...

module.exports = {
  presets: [
    [
      "@babel/preset-env",
      {
        targets: {
          node: "current"
        }
      }
    ],
    "@babel/preset-react",
    "@babel/preset-typescript"
  ]
};
