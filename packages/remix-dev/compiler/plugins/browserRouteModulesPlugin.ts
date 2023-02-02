import * as fs from "node:fs";
import * as path from "node:path";
import type esbuild from "esbuild";
import ts from "typescript";

import type { RemixConfig } from "../../config";
import { applyHMR } from "./hmrPlugin";

const serverOnlyExports = new Set(["action", "loader"]);

type OnLoader = (filename: string, code: string) => void;

/**
 * This plugin loads route modules for the browser build, using module shims
 * that re-export only the route module exports that are safe for the browser.
 */
export function browserRouteModulesPlugin(
  config: RemixConfig,
  suffixMatcher: RegExp,
  onLoader: OnLoader
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

          let contents = removeServerExports(sourceCode, routeFile, onLoader);

          contents = await applyHMR(
            contents,
            {
              ...args,
              path: routeFile,
            },
            config,
            !!build.initialOptions.sourcemap
          );

          return {
            contents,
            loader: path.extname(routeFile).slice(1) as esbuild.Loader,
            resolveDir: path.dirname(routeFile),
          };
        }
      );
    },
  };
}

function removeServerExports(
  sourceCode: string,
  fileName: string,
  onLoader: OnLoader
) {
  let { outputText, sourceMapText } = ts.transpileModule(sourceCode, {
    fileName,
    compilerOptions: {
      jsx: ts.JsxEmit.Preserve,
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ESNext,
    },
    transformers: {
      before: [
        (context) => {
          let sourceFile: ts.SourceFile;
          let visit: ts.Visitor = (node) => {
            if (ts.isSourceFile(node)) {
              sourceFile = node;
            }
            let modifiers = ts.getModifiers(node as ts.HasModifiers);

            // TODO: if loader changes and its being re-exported or imported in some other route,
            // need to crawl import graph for all such routes and consider them to have changed their loader too.
            // consider diffing hashes from esbuild output files and comparing server to browser to prev browser etc.
            // ^ maybe we can use that to detect these cases
            if (ts.isExportDeclaration(node) && node.exportClause) {
              if ("elements" in node.exportClause) {
                let elements = node.exportClause.elements.filter(
                  (n) => !serverOnlyExports.has(n.name.escapedText as string)
                );
                if (elements.length === 0) {
                  return ts.factory.createEmptyStatement();
                }

                return ts.factory.createExportDeclaration(
                  ts.getModifiers(node),
                  node.isTypeOnly,
                  ts.factory.createNamedExports(elements),
                  node.moduleSpecifier,
                  node.assertClause
                );
              }
            }

            if (
              modifiers &&
              modifiers.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) &&
              !modifiers.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)
            ) {
              if (ts.isFunctionDeclaration(node) && node.name) {
                if (serverOnlyExports.has(node.name.escapedText as string)) {
                  if (node.name.escapedText === "loader") {
                    let printer = ts.createPrinter();
                    let code = printer.printNode(
                      ts.EmitHint.Unspecified,
                      node,
                      sourceFile
                    );
                    // printed = hash of loader
                    onLoader(fileName, code);
                  }
                  return ts.factory.createEmptyStatement();
                }
              }

              if (ts.isVariableStatement(node)) {
                let declarations = node.declarationList.declarations.filter(
                  (d) =>
                    !d.name ||
                    !("escapedText" in d.name) ||
                    !serverOnlyExports.has(d.name.escapedText as string)
                );

                if (declarations.length === 0) {
                  return ts.factory.createEmptyStatement();
                }

                return ts.factory.createVariableStatement(
                  node.modifiers,
                  ts.factory.createVariableDeclarationList(
                    declarations,
                    node.declarationList.flags
                  )
                );
              }
            }

            if (ts.isSourceFile(node)) {
              return ts.visitEachChild(node, (child) => visit(child), context);
            }
            return node;
          };
          return (node) => ts.visitNode(node, visit);
        },
      ],
    },
  });

  return outputText + (sourceMapText || "");
}
