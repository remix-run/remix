/**
 * @see https://github.com/eslint/eslint/issues/3458
 * @see https://www.npmjs.com/package/@rushstack/eslint-patch
 */
require("@rushstack/eslint-patch/modern-module-resolution");

const OFF = 0;
const WARN = 1;
const ERROR = 2;

module.exports = {
  plugins: ["jest"],
  overrides: [
    {
      files: ["**/__tests__/**/*", "**/*.{spec,test}.*"],
      env: {
        "jest/globals": true
      },
      rules: {
        // https://github.com/jest-community/eslint-plugin-jest
        "jest/no-conditional-expect": OFF,
        "jest/no-identical-title": WARN,
        "jest/no-interpolation-in-snapshots": WARN,
        "jest/no-jasmine-globals": ERROR,
        "jest/no-jest-import": WARN,
        "jest/no-mocks-import": WARN,
        "jest/valid-describe-callback": ERROR,
        "jest/valid-expect": ERROR,
        "jest/valid-expect-in-promise": ERROR
      }
    }
  ]
};
