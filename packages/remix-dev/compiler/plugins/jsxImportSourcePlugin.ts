import { promises as fsp } from "fs";
import type { Plugin } from "esbuild";
import { dirname } from "path";

export const jsxImportSourcePlugin = (
  importSource: string,
  rootDir: string
): Plugin => {
  let importSourcePath = require.resolve(importSource, {
    paths: [rootDir],
  });
  let pragma = `/** @jsx jsx */\nimport { jsx } from '${importSourcePath}';\n`;

  return {
    name: "jsxImportSource",
    setup(build) {
      build.onLoad({ filter: /\.[tj]sx$/ }, async ({ path }) => {
        let content = await fsp.readFile(path);

        return {
          contents: `${pragma}${content.toString()}`,
          loader: path.endsWith(".tsx") ? "tsx" : "jsx",
          resolveDir: dirname(path),
        };
      });
    },
  };
};
