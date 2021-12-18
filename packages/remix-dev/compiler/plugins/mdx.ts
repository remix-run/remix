import { promises as fsp } from "fs";
import * as path from "path";
import type * as esbuild from "esbuild";
import { remarkMdxFrontmatter } from "remark-mdx-frontmatter";

import type { RemixConfig } from "../../config";
import { getLoaderForFile } from "../loaders";

export function mdxPlugin(config: RemixConfig): esbuild.Plugin {
  return {
    name: "remix-mdx",
    async setup(build) {
      const [xdm, { default: remarkFrontmatter }] = await Promise.all([
        import("xdm"),
        import("remark-frontmatter") as any
      ]);

      build.onResolve({ filter: /\.mdx?$/ }, args => {
        return {
          path: args.path.startsWith("~/")
            ? path.resolve(config.appDirectory, args.path.replace(/^~\//, ""))
            : path.resolve(args.resolveDir, args.path),
          namespace: "mdx"
        };
      });

      build.onLoad({ filter: /\.mdx?$/ }, async args => {
        try {
          let contents = await fsp.readFile(args.path, "utf-8");

          const rehypePlugins = [];
          const remarkPlugins = [
            remarkFrontmatter,
            [remarkMdxFrontmatter, { name: "attributes" }]
          ];

          switch (typeof config.mdx) {
            case "object":
              rehypePlugins.push(...(config.mdx.rehypePlugins || []));
              remarkPlugins.push(...(config.mdx.remarkPlugins || []));

              break;
            case "function":
              const mdxConfig = await config.mdx(args.path);
              rehypePlugins.push(...(mdxConfig?.rehypePlugins || []));
              remarkPlugins.push(...(mdxConfig?.remarkPlugins || []));
              break;
          }

          const remixExports = `
export const filename = ${JSON.stringify(path.basename(args.path))};
export const headers = typeof attributes !== "undefined" && attributes.headers;
export const meta = typeof attributes !== "undefined" && attributes.meta;
export const links = undefined;
          `;

          const compiled = await xdm.compile(contents, {
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
          const warnings: esbuild.PartialMessage[] = [];

          compiled.messages.forEach(message => {
            const toPush = message.fatal ? errors : warnings;
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
