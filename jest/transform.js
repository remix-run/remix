let { default: babelJest } = require("babel-jest");

let baseConfig = require("../babel.config.js");

/**
 * Replace `import.meta` with `undefined`
 *
 * Needed to support server-side CJS in Jest
 * that access `@remix-run/react`, where `import.meta.hot`
 * is used for HMR.
 */
let metaPlugin = ({ types: t }) => ({
  visitor: {
    MetaProperty: (path) => {
      path.replaceWith(t.identifier("undefined"));
    },
  },
});

module.exports = babelJest.createTransformer({
  babelrc: false,
  ...baseConfig,
  plugins: [...baseConfig.plugins, metaPlugin],
});
