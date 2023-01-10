import path from "path";
import type { Plugin } from "esbuild";
import fse from "fs-extra";
import LRUCache from "lru-cache";
import { parse, type ParserOptions } from "@babel/parser";
import traverse from "@babel/traverse";
import generate from "@babel/generator";

const pluginName = "css-side-effects-plugin";
const namespace = `${pluginName}-ns`;
const cssSideEffectSuffix = "?__remix_sideEffect__";
const cssSideEffectFilter = new RegExp(
  `\\.css${cssSideEffectSuffix.replace("?", "\\?")}$`
);

export function isCssSideEffectImportPath(path: string): boolean {
  return cssSideEffectFilter.test(path);
}

const loaders = ["js", "jsx", "ts", "tsx"] as const;
const allJsFilesFilter = new RegExp(`\\.(${loaders.join("|")})$`);

type Loader = typeof loaders[number];
type Extension = `.${Loader}`;

const loaderForExtension: Record<Extension, Loader> = {
  ".js": "js",
  ".jsx": "jsx",
  ".ts": "ts",
  ".tsx": "tsx",
};

/**
 * This plugin detects side-effect imports of CSS files and adds a suffix
 * to the import path, e.g. `import "./styles.css"` is transformed to
 * `import "./styles.css?__remix_sideEffect__"`). This allows them to be
 * differentiated from non-side-effect imports so that they can be added
 * to the CSS bundle. This is primarily designed to support packages that
 * import plain CSS files directly within JS files.
 */
export const cssSideEffectImportsPlugin = (options: {
  rootDirectory: string;
}): Plugin => {
  return {
    name: pluginName,
    setup: async (build) => {
      build.onLoad(
        { filter: allJsFilesFilter, namespace: "file" },
        async (args) => {
          let code = await fse.readFile(args.path, "utf8");

          // Don't process file if it doesn't contain any references to CSS files
          if (!code.includes(".css")) {
            return null;
          }

          let loader = loaderForExtension[path.extname(args.path) as Extension];
          let contents = addSuffixToCssSideEffectImports(loader, code);

          return {
            contents,
            loader,
          };
        }
      );

      build.onResolve(
        { filter: cssSideEffectFilter, namespace: "file" },
        async (args) => {
          let resolvedPath = (
            await build.resolve(args.path, {
              resolveDir: args.resolveDir,
              kind: args.kind,
            })
          ).path;

          return {
            path: path.relative(options.rootDirectory, resolvedPath),
            namespace: resolvedPath.endsWith(".css") ? namespace : undefined,
          };
        }
      );

      build.onLoad({ filter: /\.css$/, namespace }, async (args) => {
        let contents = await fse.readFile(args.path, "utf8");

        return {
          contents,
          resolveDir: path.dirname(args.path),
          loader: "css",
        };
      });
    },
  };
};

const babelPluginsForLoader: Record<Loader, ParserOptions["plugins"]> = {
  js: [],
  jsx: ["jsx"],
  ts: ["typescript"],
  tsx: ["typescript", "jsx"],
};

const cache = new LRUCache<string, string>({ max: 1000 });
const getCacheKey = (loader: Loader, code: string) => `${loader}:${code}`;

export function addSuffixToCssSideEffectImports(
  loader: Loader,
  code: string
): string {
  let cacheKey = getCacheKey(loader, code);
  let cachedResult = cache.get(cacheKey);

  if (cachedResult) {
    return cachedResult;
  }

  let ast = parse(code, {
    sourceType: "module",
    plugins: babelPluginsForLoader[loader],
  });

  traverse(ast, {
    // Handle `import "./styles.css"`
    ImportDeclaration(path) {
      if (
        path.node.specifiers.length === 0 && // i.e. nothing was imported
        path.node.source.value.endsWith(".css")
      ) {
        path.node.source.value += cssSideEffectSuffix;
      }
    },

    // Handle `require("./styles.css")`
    CallExpression(path) {
      if (
        path.node.callee.type === "Identifier" &&
        path.node.callee.name === "require" &&
        // Require call must be its own statement,
        // not nested within another expression,
        (path.parent.type === "ExpressionStatement" ||
          // or, the statement must only consist of a
          // ternary or logical expression, without
          // assigning the result to a variable.
          ((path.parent.type === "ConditionalExpression" ||
            path.parent.type === "LogicalExpression") &&
            path.parentPath.parent.type === "ExpressionStatement"))
      ) {
        let specifier = path.node.arguments[0];

        if (
          specifier &&
          specifier.type === "StringLiteral" &&
          specifier.value.endsWith(".css")
        ) {
          specifier.value += cssSideEffectSuffix;
        }
      }
    },
  });

  let result = generate(ast, {
    retainLines: true,
    compact: false,
  }).code;

  cache.set(cacheKey, result);

  return result;
}
