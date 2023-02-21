import { pathToFileURL } from "url";
import { relative } from "path";
import { setAdapter, removeAdapter } from "@vanilla-extract/css/adapter";
import { transformCss } from "@vanilla-extract/css/transformCss";
import type { IdentifierOption } from "@vanilla-extract/integration";
import {
  cssFileFilter,
  getPackageInfo,
  transform,
} from "@vanilla-extract/integration";
import { resolvePath } from "mlly";
import type { AliasOptions, ModuleNode, Plugin as VitePlugin } from "vite";
import { createServer } from "vite";
import { ViteNodeRunner } from "vite-node/client";
import { ViteNodeServer } from "vite-node/server";
import type { Adapter } from "@vanilla-extract/css";

import { lock } from "./lock";
import { serializeVanillaModule } from "./processVanillaFile";

type Css = Parameters<Adapter["appendCss"]>[0];
type Composition = Parameters<Adapter["registerComposition"]>[0];

const scanModule = (entryModule: ModuleNode, root: string) => {
  let queue = [entryModule];
  let cssDeps = new Set<string>();
  let watchFiles = new Set<string>();

  for (let moduleNode of queue) {
    let relativePath = moduleNode.id && relative(root, moduleNode.id);

    if (relativePath) {
      cssDeps.add(relativePath);
    }

    if (moduleNode.file) {
      watchFiles.add(moduleNode.file);
    }

    for (let importedModule of moduleNode.importedModules) {
      queue.push(importedModule);
    }
  }

  // This ensures the root module's styles are last in terms of CSS ordering. We
  // should probably find a way to avoid the need for this.
  let [head, ...tail] = cssDeps;

  return { cssDeps: [...tail, head], watchFiles };
};

const createViteServer = async ({
  root,
  identOption,
  alias,
  vitePlugins = [],
}: {
  root: string;
  identOption: IdentifierOption;
  alias?: AliasOptions;
  vitePlugins?: Array<VitePlugin>;
}) => {
  let pkg = getPackageInfo(root);

  let server = await createServer({
    root,
    server: {
      hmr: false,
    },
    logLevel: "silent",
    optimizeDeps: {
      disabled: true,
    },
    ssr: {
      noExternal: true,
    },
    resolve: {
      alias,
    },
    plugins: [
      {
        name: "vanilla-extract-externalize",
        enforce: "pre",
        async resolveId(source, importer) {
          if (source.startsWith("@vanilla-extract/")) {
            return {
              external: true,
              id: await resolvePath(source, { url: pathToFileURL(importer!) }),
            };
          }
        },
      },
      {
        name: "vanilla-extract-transform",
        async transform(code, id) {
          if (cssFileFilter.test(id)) {
            let filescopedCode = await transform({
              source: code,
              rootPath: root,
              filePath: id,
              packageName: pkg.name,
              identOption,
            });

            return filescopedCode;
          }
        },
      },
      ...vitePlugins,
    ],
  });

  // this is need to initialize the plugins
  await server.pluginContainer.buildStart({});

  let node = new ViteNodeServer(server);

  let runner = new ViteNodeRunner({
    root,
    base: server.config.base,
    fetchModule(id) {
      return node.fetchModule(id);
    },
    resolveId(id, importer) {
      return node.resolveId(id, importer);
    },
  });

  server.watcher.on("change", (filePath) => {
    runner.moduleCache.invalidateDepTree([filePath]);
  });

  return {
    server,
    runner,
  };
};

export interface Compiler {
  processVanillaFile(
    filePath: string,
    outputCss: boolean
  ): Promise<{ source: string; watchFiles: Set<string> }>;
  getCssForFile(virtualCssFilePath: string): { filePath: string; css: string };
  close(): Promise<void>;
}

export interface CreateCompilerParams {
  root: string;
  identOption: IdentifierOption;
  toCssImport: (filePath: string) => string;
  alias?: AliasOptions;
  vitePlugins?: Array<VitePlugin>;
}
export const createVanillaExtractCompiler = ({
  root,
  identOption,
  toCssImport,
  alias,
  vitePlugins,
}: CreateCompilerParams): Compiler => {
  let vitePromise = createViteServer({
    root,
    identOption,
    alias,
    vitePlugins,
  });

  let adapterResultCache = new Map<
    string,
    {
      css: string;
      localClassNames: Set<string>;
      composedClassLists: Array<Composition>;
      usedCompositions: Set<string>;
    }
  >();

  return {
    async processVanillaFile(filePath, outputCss) {
      let { server, runner } = await vitePromise;

      let cssByFileScope = new Map<string, Array<Css>>();
      let localClassNames = new Set<string>();
      let composedClassLists: Array<Composition> = [];
      let usedCompositions = new Set<string>();

      let cssAdapter: Adapter = {
        appendCss: (css, fileScope) => {
          let fileScopeCss = cssByFileScope.get(fileScope.filePath) ?? [];
          fileScopeCss.push(css);
          cssByFileScope.set(fileScope.filePath, fileScopeCss);
        },
        registerClassName: (className) => {
          localClassNames.add(className);
        },
        registerComposition: (composedClassList) => {
          composedClassLists.push(composedClassList);
        },
        markCompositionUsed: (identifier) => {
          usedCompositions.add(identifier);
        },
        onEndFileScope: () => {},
        getIdentOption: () => identOption,
      };

      let { fileExports, cssImports, watchFiles } = await lock(async () => {
        setAdapter(cssAdapter);

        let fileExports = await runner.executeFile(filePath);

        let moduleNode = server.moduleGraph.getModuleById(filePath);

        if (!moduleNode) {
          throw new Error(`Can't find ModuleNode for ${filePath}`);
        }

        let cssImports = [];

        let { cssDeps, watchFiles } = scanModule(moduleNode, root);

        for (let moduleId of cssDeps) {
          let cssObjs = cssByFileScope.get(moduleId);
          let cachedAdapterResult = adapterResultCache.get(moduleId);

          if (!cssObjs && !cachedAdapterResult) {
            continue;
          }

          if (cssObjs) {
            let css = transformCss({
              localClassNames: Array.from(localClassNames),
              composedClassLists,
              cssObjs,
            }).join("\n");

            adapterResultCache.set(moduleId, {
              localClassNames,
              composedClassLists,
              usedCompositions,
              css,
            });
          } else if (cachedAdapterResult) {
            cachedAdapterResult.localClassNames.forEach((localClassName) => {
              localClassNames.add(localClassName);
            });
            cachedAdapterResult.usedCompositions.forEach((usedComposition) => {
              usedCompositions.add(usedComposition);
            });
            composedClassLists.push(...cachedAdapterResult.composedClassLists);
          }

          cssImports.push(`import '${toCssImport(moduleId)}';`);
        }

        removeAdapter();

        return {
          fileExports,
          cssImports: outputCss ? cssImports : [],
          watchFiles,
        };
      });

      let unusedCompositions = composedClassLists
        .filter(({ identifier }) => !usedCompositions.has(identifier))
        .map(({ identifier }) => identifier);

      let unusedCompositionRegex =
        unusedCompositions.length > 0
          ? RegExp(`(${unusedCompositions.join("|")})\\s`, "g")
          : null;

      return {
        source: serializeVanillaModule(
          cssImports,
          fileExports,
          unusedCompositionRegex
        ),
        watchFiles,
      };
    },
    getCssForFile(filePath: string) {
      let rootRelativePath = relative(root, filePath);
      let result = adapterResultCache.get(rootRelativePath);

      if (!result) {
        throw new Error(`No CSS for file: ${filePath}`);
      }

      return {
        css: result.css,
        filePath: rootRelativePath,
        resolveDir: root,
      };
    },
    async close() {
      let { server } = await vitePromise;

      await server.close();
    },
  };
};
