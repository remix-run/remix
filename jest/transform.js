let { default: babelJest } = require("babel-jest");

module.exports = babelJest.createTransformer({
  babelrc: false,
  configFile: require.resolve("../babel.config"),
});
