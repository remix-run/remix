import * as fs from "node:fs";
import * as path from "node:path";
import type esbuild from "esbuild";
import generate from "@babel/generator";

import type { RemixConfig } from "../../config";
import { applyHMR } from "./hmrPlugin";
import type { CompileOptions } from "../options";
import { getLoaderForFile } from "../loaders";
import * as Transform from "../../transform";

const serverOnlyExports = new Set(["action", "loader"]);

let removeServerExports = (onLoader: (loader: string) => void) =>
  Transform.create(({ types: t }) => {
    return {
      visitor: {
        ExportNamedDeclaration: (path) => {
          let { node } = path;
          if (node.source) {
            let specifiers = node.specifiers.filter(({ exported }) => {
              let name = t.isIdentifier(exported)
                ? exported.name
                : exported.value;
              return !serverOnlyExports.has(name);
            });
            if (specifiers.length === node.specifiers.length) return;
            if (specifiers.length === 0) return path.remove();
            path.replaceWith(
              t.exportNamedDeclaration(
                node.declaration,
                specifiers,
                node.source
              )
            );
          }
          if (t.isFunctionDeclaration(node.declaration)) {
            let name = node.declaration.id?.name;
            if (!name) return;
            if (name === "loader") {
              let { code } = generate(node);
              onLoader(code);
            }
            if (serverOnlyExports.has(name)) return path.remove();
          }
          if (t.isVariableDeclaration(node.declaration)) {
            let declarations = node.declaration.declarations.filter((d) => {
              let name = t.isIdentifier(d.id) ? d.id.name : undefined;
              if (!name) return false;
              if (name === "loader") {
                let { code } = generate(node);
                onLoader(code);
              }
              return !serverOnlyExports.has(name);
            });
            if (declarations.length === 0) return path.remove();
            if (declarations.length === node.declaration.declarations.length)
              return;
            path.replaceWith(
              t.variableDeclaration(node.declaration.kind, declarations)
            );
          }
        },
      },
    };
  });

/**
 * This plugin loads route modules for the browser build, using module shims
 * that re-export only the route module exports that are safe for the browser.
 */
export function browserRouteModulesPlugin(
  config: RemixConfig,
  suffixMatcher: RegExp,
  onLoader: (filename: string, code: string) => void,
  mode: CompileOptions["mode"]
): esbuild.Plugin {
  return {
    name: "browser-route-modules",
    async setup(build) {
      build.onResolve({ filter: suffixMatcher }, (args) => {
        return {
          path: args.path,
          namespace: "browser-route-module",
        };
      });

      build.onLoad(
        { filter: suffixMatcher, namespace: "browser-route-module" },
        async (args) => {
          let file = args.path.replace(suffixMatcher, "");
          let routeFile = path.join(config.appDirectory, file);

          let sourceCode = fs.readFileSync(routeFile, "utf8");

          let transform = removeServerExports((loader: string) =>
            onLoader(routeFile, loader)
          );
          let contents = transform(sourceCode, routeFile);

          if (mode === "development" && config.future.unstable_dev) {
            contents = await applyHMR(
              contents,
              {
                ...args,
                path: routeFile,
              },
              config,
              !!build.initialOptions.sourcemap
            );
          }

          return {
            contents,
            loader: getLoaderForFile(routeFile),
            resolveDir: path.dirname(routeFile),
          };
        }
      );
    },
  };
}
