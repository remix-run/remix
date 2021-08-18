import { promises as fsp } from "fs";
import * as path from "path";

import type { PartialMessage, Plugin } from "esbuild";
import type Postcss from "postcss";

import type { RemixConfig } from "../../config";
import { BuildMode } from "../../build";
import { getLoaderForFile } from "../loaders";
import { fileExists } from "../utils/fs";

export async function postcssPlugin(
  remixConfig: RemixConfig,
  mode?: BuildMode
): Promise<Plugin> {
  return {
    name: "postcss",
    async setup(build) {
      let root = remixConfig.rootDirectory;
      let postcssConfig = path.join(root, "postcss.config.js");
      let postcssConfigExists = await fileExists(postcssConfig);

      if (!postcssConfigExists) {
        return;
      }

      let rawConfig: string;
      let config: any;
      try {
        rawConfig = await fsp.readFile(postcssConfig, "utf-8");
        config = require(require.resolve(postcssConfig));
      } catch (err) {
        throw new Error(
          `Failed to load your postcss.config.js file: ${err.message}`
        );
      }

      let postcss: typeof Postcss;
      try {
        postcss = require("postcss");
      } catch (err) {
        throw new Error(
          "Looks like you have a postcss.config.js. Please double check you have postcss installed as a dev dependency."
        );
      }

      console.log(`Detected and using PostCSS config at ${postcssConfig}`);

      build.onLoad({ filter: /\.css/, namespace: "file" }, async args => {
        let contents = await fsp.readFile(args.path, "utf-8");

        try {
          let result = await postcss(
            (config && config.plugins) || undefined
          ).process(contents, {
            from: args.path,
            map:
              mode === BuildMode.Development
                ? {
                    inline: false,
                    sourcesContent: true
                  }
                : false
          });

          let warnings: PartialMessage[] | undefined = undefined;
          let watchFiles: string[] = [];
          for (let message of result.messages) {
            switch (message.type) {
              case "dependency":
                if (message.file) watchFiles.push(message.file);
                break;
              case "warning":
                warnings = warnings || [];
                warnings.push({
                  text: message.text,
                  notes: message.plugin
                    ? [
                        {
                          text: `This warning was triggered by postcss plugin "${message.plugin}"`
                        }
                      ]
                    : undefined,
                  location:
                    typeof message.line === "number"
                      ? {
                          file: args.path,
                          lineText: contents.split("\n")[message.line - 1],
                          column: message.column,
                          line: message.line
                        }
                      : undefined
                });
                break;
            }
          }

          let sourcemaps = result.map
            ? `\n/*# sourceMappingURL=data:application/json;base64,${Buffer.from(
                JSON.stringify(result.map.toJSON())
              ).toString("base64")} */\n`
            : "";

          return {
            contents: `${result.css.toString()}${sourcemaps}`,
            loader: getLoaderForFile(args.path),
            watchFiles,
            warnings
          };
        } catch (err) {
          return {
            errors: [
              {
                text: err.message
              }
            ]
          };
        }
      });
    }
  };
}
