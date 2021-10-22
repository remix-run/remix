import { promises as fsp } from "fs";
import fs from "fs";
import * as path from "path";
import type * as esbuild from "esbuild";
import { remarkMdxFrontmatter } from "remark-mdx-frontmatter";

import type { RemixConfig } from "../../config";
import { getLoaderForFile } from "../loaders";

function resolvePath({
  alias,
  aliasPaths,
  config,
  filepath
}: {
  /**
   * seems self explanatory
   */
  config: RemixConfig;
  /**
   * The filepath, `args.path`.
   */
  filepath: string;
  /**
   * the path alias actual paths from tsconfig.compilerOptions.paths
   */
  aliasPaths: string[];
  /**
   * the path alias from tsconfig.compilerOptions.paths
   */
  alias: string;
}): string | undefined {
  // we have no aliases, let's bounce
  if (!aliasPaths) {
    return undefined;
  }

  // tsconfig aliases end in a `*`, so we need to remove it
  let aliasPath = alias.replace(/\*$/, "");
  let aliasRegexp = new RegExp(`^${aliasPath}`);

  // path isn't an alias, let's bounce
  if (!aliasRegexp.test(filepath)) return undefined;

  let aliasActualPath = aliasPaths[0].replace(/\*$/, "");

  let maybePath = path.resolve(
    config.rootDirectory,
    aliasActualPath,
    filepath.replace(aliasRegexp, "")
  );

  // check if the file exists at path
  if (fs.existsSync(maybePath)) {
    // we exist, let's return it
    return maybePath;
  }

  // we dont exist, let's try again
  return resolvePath({
    alias,
    aliasPaths: aliasPaths.slice(1),
    config,
    filepath
  });
}

export function mdxPlugin(config: RemixConfig): esbuild.Plugin {
  let tsconfig = config.tsconfig;

  return {
    name: "remix-mdx",
    async setup(build) {
      let [xdm, { default: remarkFrontmatter }] = await Promise.all([
        import("xdm"),
        import("remark-frontmatter") as any
      ]);

      build.onResolve({ filter: /\.mdx?$/ }, args => {
        if (tsconfig?.compilerOptions?.paths) {
          for (const [alias, paths] of Object.entries(
            tsconfig.compilerOptions.paths
          )) {
            let path = resolvePath({
              alias,
              aliasPaths: paths,
              config,
              filepath: args.path
            });

            if (path) {
              return { path, namespace: "mdx" };
            }
          }
        }

        // no aliases matched, use the path as is
        return {
          path: path.resolve(args.resolveDir, args.path),
          namespace: "mdx"
        };
      });

      build.onLoad({ filter: /\.mdx?$/ }, async args => {
        try {
          let contents = await fsp.readFile(args.path, "utf-8");

          let rehypePlugins = [];
          let remarkPlugins = [
            remarkFrontmatter,
            [remarkMdxFrontmatter, { name: "attributes" }]
          ];

          switch (typeof config.mdx) {
            case "object":
              rehypePlugins.push(...(config.mdx.rehypePlugins || []));
              remarkPlugins.push(...(config.mdx.remarkPlugins || []));

              break;
            case "function":
              let mdxConfig = await config.mdx(args.path);
              rehypePlugins.push(...(mdxConfig?.rehypePlugins || []));
              remarkPlugins.push(...(mdxConfig?.remarkPlugins || []));
              break;
          }

          let remixExports = `
export const filename = ${JSON.stringify(path.basename(args.path))};
export const headers = typeof attributes !== "undefined" && attributes.headers;
export const meta = typeof attributes !== "undefined" && attributes.meta;
export const links = undefined;
          `;

          let compiled = await xdm.compile(contents, {
            jsx: true,
            jsxRuntime: "classic",
            pragma: "React.createElement",
            pragmaFrag: "React.Fragment",
            rehypePlugins,
            remarkPlugins
          });

          contents = `
${compiled.value}
${remixExports}`;

          let errors: esbuild.PartialMessage[] = [];
          let warnings: esbuild.PartialMessage[] = [];

          compiled.messages.forEach(message => {
            let toPush = message.fatal ? errors : warnings;
            toPush.push({
              location:
                message.line || message.column
                  ? {
                      column:
                        typeof message.column === "number"
                          ? message.column
                          : undefined,
                      line:
                        typeof message.line === "number"
                          ? message.line
                          : undefined
                    }
                  : undefined,
              text: message.message,
              detail:
                typeof message.note === "string" ? message.note : undefined
            });
          });

          return {
            errors: errors.length ? errors : undefined,
            warnings: warnings.length ? warnings : undefined,
            contents,
            resolveDir: path.dirname(args.path),
            loader: getLoaderForFile(args.path)
          };
        } catch (err: any) {
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
