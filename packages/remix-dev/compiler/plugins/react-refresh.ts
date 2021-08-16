import { promises as fsp } from "fs";
import * as path from "path";

import esbuild from "esbuild";

import { RemixConfig } from "../../config";
import { getLoaderForFile } from "../loaders";

const IS_FAST_REFRESH_ENABLED = /\$RefreshReg\$\(/;

const refreshRuntime = `
window.$RefreshReg$ = prevRefreshReg;
window.$RefreshSig$ = prevRefreshSig;
import.meta.hot.accept(({ module }) => {
  window.$RefreshRuntime$.performReactRefresh();
});
`;

export function reactRefreshPlugin(config: RemixConfig): esbuild.Plugin {
  return {
    name: "react-refresh",
    setup(build) {
      let babel = require("@babel/core");

      build.onLoad({ filter: /\.[tj]sx?/, namespace: "file" }, async args => {
        let contents = await fsp.readFile(args.path, "utf-8");
        let relativeSrcPath = path.relative(config.rootDirectory, args.path);

        if (!args.path.startsWith(config.appDirectory)) {
          if (!args.path.endsWith("@remix-run/react/browser/components.js")) {
            return {};
          }

          return {
            contents: `import * as ______REACT_REFRESH______ from "@remix-run/dev/hmr-runtime";
import.meta.hot = ______REACT_REFRESH______.createHotContext(${JSON.stringify(
              relativeSrcPath
            )});

${contents}`,
            loader: getLoaderForFile(args.path)
          };
        }

        try {
          let transformed = (
            await esbuild.transform(contents, {
              loader: getLoaderForFile(args.path),
              format: "esm"
            })
          ).code;

          transformed = (
            await babel.transformAsync(transformed, {
              filename: args.path,
              ast: false,
              compact: false,
              sourceMaps: false,
              configFile: false,
              babelrc: false,
              plugins: [
                [require("react-refresh/babel"), { skipEnvCheck: true }]
              ]
            })
          ).code;

          // console.log(args.path);
          // let rel

          if (IS_FAST_REFRESH_ENABLED.test(transformed)) {
            const refreshPrefix = `
import * as ______REACT_REFRESH______ from "@remix-run/dev/hmr-runtime";
import.meta.hot = ______REACT_REFRESH______.createHotContext(${JSON.stringify(
              relativeSrcPath
            )});

if (!window.$RefreshReg$ || !window.$RefreshSig$ || !window.$RefreshRuntime$) {
  console.warn('@remix-run/react-refresh: HTML setup script not run. React Fast Refresh only works when Snowpack serves your HTML routes. You may want to remove this plugin.');
} else {
  var prevRefreshReg = window.$RefreshReg$;
  var prevRefreshSig = window.$RefreshSig$;
  window.$RefreshReg$ = (type, id) => {
    window.$RefreshRuntime$.register(type, ${JSON.stringify(
      relativeSrcPath
    )} + id);
  }
  window.$RefreshSig$ = window.$RefreshRuntime$.createSignatureFunctionForTransform;
}

`;

            transformed = refreshPrefix + transformed + refreshRuntime;
          }

          if (
            args.path ===
            "/Users/jacob/git/remix/fixtures/tutorial/app/routes/index.tsx"
          ) {
            fsp.writeFile("./test-output.js", transformed);
            // console.log(transformed.code)
          }

          // TODO: add sourcemaps
          return {
            contents: transformed,
            loader: getLoaderForFile(args.path)
          };
        } catch (err) {
          console.error(err);
        }

        return {
          contents,
          loader: getLoaderForFile(args.path),
          warnings: [
            {
              text: `Failed to enabled react-refresh for ${args.path}`
            }
          ]
        };
      });
    }
  };
}
