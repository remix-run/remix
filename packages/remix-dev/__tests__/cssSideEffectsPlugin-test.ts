import dedent from "dedent";

import {
  addSuffixToCssSideEffectImports,
  cssSideEffectSuffix,
} from "../compiler/plugins/cssSideEffectsPlugin";

const SUFFIX_PLACEHOLDER = "{{SUFFIX_PLACEHOLDER}}";
const suffixPlaceholderRegExp = new RegExp(SUFFIX_PLACEHOLDER, "g");

const testCase = (input: string) => {
  let contents = dedent(input);

  return {
    withoutSuffix: contents.replace(suffixPlaceholderRegExp, ""),
    withSuffix: contents.replace(suffixPlaceholderRegExp, cssSideEffectSuffix),
  } as const;
};

describe("cssSideEffectsPlugin", () => {
  describe("addSuffixToCssSideEffectImports", () => {
    test("require - double quotes", () => {
      let { withoutSuffix, withSuffix } = testCase(
        `require("./foo.css${SUFFIX_PLACEHOLDER}")`
      );

      expect(addSuffixToCssSideEffectImports(withoutSuffix)).toBe(withSuffix);
    });

    test("require - single quotes", () => {
      let { withoutSuffix, withSuffix } = testCase(
        `require('./foo.css${SUFFIX_PLACEHOLDER}')`
      );

      expect(addSuffixToCssSideEffectImports(withoutSuffix)).toBe(withSuffix);
    });

    test("import - double quotes", () => {
      let { withoutSuffix, withSuffix } = testCase(
        `import "./foo.css${SUFFIX_PLACEHOLDER}"`
      );

      expect(addSuffixToCssSideEffectImports(withoutSuffix)).toBe(withSuffix);
    });

    test("import - single quotes", () => {
      let { withoutSuffix, withSuffix } = testCase(
        `import './foo.css${SUFFIX_PLACEHOLDER}'`
      );

      expect(addSuffixToCssSideEffectImports(withoutSuffix)).toBe(withSuffix);
    });

    test("multiple requires", () => {
      let { withoutSuffix, withSuffix } = testCase(`
          const path = require('path');
          require('./foo.css${SUFFIX_PLACEHOLDER}');
          const fs = require('fs');
      `);

      expect(addSuffixToCssSideEffectImports(withoutSuffix)).toBe(withSuffix);
    });

    test("multiple imports", () => {
      let { withoutSuffix, withSuffix } = testCase(`
          import path from 'path';
          import './foo.css${SUFFIX_PLACEHOLDER}';
          import fs from 'fs';
      `);

      expect(addSuffixToCssSideEffectImports(withoutSuffix)).toBe(withSuffix);
    });

    test("multiple requires with other CSS formats", () => {
      let { withoutSuffix, withSuffix } = testCase(`
        const fooHref = require("./foo.css");
        require("./foo.css${SUFFIX_PLACEHOLDER}");
        const barStyles = require("./bar.module.css");
      `);

      expect(addSuffixToCssSideEffectImports(withoutSuffix)).toBe(withSuffix);
    });

    test("mutliple imports with other CSS formats", () => {
      let { withoutSuffix, withSuffix } = testCase(`
        import fooHref from "./foo.css";
        import "./foo.css${SUFFIX_PLACEHOLDER}";
        import barStyles from "./bar.module.css";
      `);

      expect(addSuffixToCssSideEffectImports(withoutSuffix)).toBe(withSuffix);
    });

    test("multiple requires with other CSS formats on a single line", () => {
      let { withoutSuffix, withSuffix } = testCase(
        [
          `const fooHref=require("./foo.css");`,
          `require("./foo.css${SUFFIX_PLACEHOLDER}");`,
          `const barStyles=require("./bar.module.css");`,
        ].join("")
      );

      expect(addSuffixToCssSideEffectImports(withoutSuffix)).toBe(withSuffix);
    });

    test("multiple imports with other CSS formats on a single line", () => {
      let { withoutSuffix, withSuffix } = testCase(
        [
          `import fooHref from "./foo.css";`,
          `import "./foo.css${SUFFIX_PLACEHOLDER}";`,
          `import barStyles from "./bar.module.css";`,
        ].join("")
      );

      expect(addSuffixToCssSideEffectImports(withoutSuffix)).toBe(withSuffix);
    });

    test("conditional requires with other CSS formats", () => {
      let { withoutSuffix, withSuffix } = testCase(`
        if (process.env.NODE_ENV === 'production') {
          require("./foo.min.css${SUFFIX_PLACEHOLDER}")
        } else {
          require("./foo.css${SUFFIX_PLACEHOLDER}")
        }

        const barStylesHref =
          process.env.NODE_ENV === "production"
            ? require("./bar.min.css")
            : require("./bar.css");
        
        let bazStylesHref;
        if (process.env.NODE_ENV === 'production') {
          bazStylesHref = require("./baz.min.css")
        } else {
          bazStylesHref = require("./baz.css")
        }
      `);

      expect(addSuffixToCssSideEffectImports(withoutSuffix)).toBe(withSuffix);
    });

    test("conditional requires with other CSS formats on a single line", () => {
      let { withoutSuffix, withSuffix } = testCase(
        [
          `if(process.env.NODE_ENV==='production'){require("./foo.min.css${SUFFIX_PLACEHOLDER}")}else{require("./foo.css${SUFFIX_PLACEHOLDER}")}`,
          `const barStylesHref=process.env.NODE_ENV==='production'?require("./bar.min.css"):require("./bar.css");`,
          `let bazStylesHref;if(process.env.NODE_ENV==='production'){bazStylesHref=require("./baz.min.css")}else{bazStylesHref=require("./baz.css")}`,
        ].join("")
      );

      expect(addSuffixToCssSideEffectImports(withoutSuffix)).toBe(withSuffix);
    });
  });
});
