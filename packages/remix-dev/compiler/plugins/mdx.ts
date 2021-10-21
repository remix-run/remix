import { promises as fsp } from "fs";
import fs from "fs";
import * as path from "path";
import type * as esbuild from "esbuild";
import { remarkMdxFrontmatter } from "remark-mdx-frontmatter";
import type { TsConfigJson } from "type-fest";
import { ResolverFactory, CachedInputFileSystem } from "enhanced-resolve";

import type { RemixConfig } from "../../config";
import { getLoaderForFile } from "../loaders";

let ignore = ["node_modules", ".cache", ".vscode", "public", "build"];

function getDirectories(source: string, directories: string[] = []): string[] {
  let currentDirectories = fs
    .readdirSync(source, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .filter(dirent => !ignore.includes(dirent.name))
    .map(dirent => path.join(source, dirent.name));

  for (const directory of currentDirectories) {
    directories.push(directory);
    getDirectories(directory, directories);
  }

  return directories;
}

function convertTsConfigAliasesToEnhancedResolvedAliases(
  aliases?: Record<string, string[]>
): Record<string, string> {
  if (!aliases) return {};
  return Object.entries(aliases).reduce((acc, [alias, paths]) => {
    let properAlias = alias.endsWith("/*") ? alias.slice(0, -1) : alias;
    let properPaths = paths.map(p => (p.endsWith("/*") ? p.slice(0, -1) : p));

    return {
      ...acc,
      [properAlias]: properPaths
    };
  }, {});
}

export function mdxPlugin(
  config: RemixConfig,
  tsconfig: TsConfigJson | undefined
): esbuild.Plugin {
  return {
    name: "remix-mdx",
    async setup(build) {
      let [xdm, { default: remarkFrontmatter }] = await Promise.all([
        import("xdm"),
        import("remark-frontmatter") as any
      ]);

      build.onResolve({ filter: /\.mdx?$/ }, args => {
        let tsconfigAliases = convertTsConfigAliasesToEnhancedResolvedAliases(
          tsconfig?.compilerOptions?.paths
        );

        let directories = getDirectories(config.rootDirectory);

        const resolver = ResolverFactory.createResolver({
          alias: tsconfigAliases,
          useSyncFileSystemCalls: true,
          modules: ["node_modules", ...directories],
          fileSystem: new CachedInputFileSystem(fs),
          preferAbsolute: true,
          extensions: [
            ".js",
            ".json",
            ".node",
            ".jsx",
            ".ts",
            ".tsx",
            ".mdx",
            ".md"
          ]
        });

        let result = resolver.resolveSync(
          {},
          config.rootDirectory,
          path.basename(args.path, path.extname(args.path))
        );

        return {
          path: result,
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
