import path from "path";
import { promises as fsp } from "fs";
import pluginutils from "@rollup/pluginutils";
import * as chokidar from "chokidar";
import * as rollup from "rollup";
import tmp from "tmp";

import babelTransform from "./babelTransform";
import { rewriteIds, enableMetaHot } from "./babelPlugins";

function isMagicModuleId(id: string): boolean {
  return id.startsWith("\0");
}

function isBareModuleId(id: string): boolean {
  return !id.startsWith(".") && !id.startsWith("/");
}

function getLibraryVarName(id: string): string {
  let name = pluginutils.makeLegalIdentifier(
    path.basename(id, path.extname(id))
  );

  if (name !== "index") return name;

  let segments = path.dirname(id).split(path.sep);
  return pluginutils.makeLegalIdentifier(segments[segments.length - 1]);
}

function autoDetectExports(id: string): string[] {
  try {
    return Object.keys(require(id));
  } catch (error) {
    console.error(error);
    console.error(`Unable to auto-detect exports for "${id}"`);
    return [];
  }
}

function hasCjsKeywords(code: string): boolean {
  return /\b(require|module|exports)\b/.test(code);
}

function hasDefaultExport(code: string): boolean {
  return /\bexport default\b/.test(code);
}

/**
 * Creates a module that proxies through all exports of the underlying module.
 */
async function createProxyModule(id: string, file: string): Promise<string> {
  let code = await fsp.readFile(file, "utf-8");

  let codeBlocks = [];
  if (hasCjsKeywords(code)) {
    // Assume the source is CommonJS. Proxy through the default export as
    // well as named exports for all its properties. This is necessary
    // because this module is loaded by the browser in a separate request,
    // so named exports are not able to be determined at build time by
    // Rollup using syntheticNamedExports.
    let namedExports = autoDetectExports(id);
    let name = getLibraryVarName(id);
    codeBlocks.push(
      `import ${name} from ${JSON.stringify(id)}`,
      `export default ${name}`,
      ...namedExports.map(ex => `var ${ex} = ${name}.${ex}`),
      `export {${namedExports.join(`,`)}}`
    );
  } else {
    // The source is ESM. Proxy through whatever exports it already has.
    if (hasDefaultExport(code)) {
      codeBlocks.push(`export {default} from ${JSON.stringify(id)}`);
    }
    codeBlocks.push(`export * from ${JSON.stringify(id)}`);
  }

  return codeBlocks.join(`\n`);
}

/**
 * Enables setting the compiler's input dynamically via a hook function.
 */
export function watchInput({
  watchFile,
  getInput
}: {
  watchFile: string;
  getInput: (options: rollup.InputOptions) => rollup.InputOption;
}): rollup.Plugin {
  let tmpfile = tmp.fileSync();
  let startedWatcher = false;

  return {
    name: "watch-input",
    options(options: rollup.InputOptions) {
      return {
        ...options,
        input: getInput(options)
      };
    },
    buildStart() {
      // This is a workaround for a bug in Rollup where this.addWatchFile does
      // not correctly listen for files that are added to a directory.
      // See https://github.com/rollup/rollup/issues/3704
      if (!startedWatcher) {
        chokidar.watch(watchFile).on("add", async () => {
          let now = new Date();
          await fsp.utimes(tmpfile.name, now, now);
        });

        startedWatcher = true;
      }

      this.addWatchFile(tmpfile.name);
    }
  };
}

/**
 * Enables hot module reloading by transforming all chunks that contain a
 * reference to `import.meta.hot` to enable that API.
 */
export function enableHmr({
  fileName,
  hmrClientCode,
  include,
  exclude
}: {
  fileName: string;
  hmrClientCode: string;
  include?: string | RegExp | (string | RegExp)[];
  exclude?: string | RegExp | (string | RegExp)[];
}): rollup.Plugin {
  let filter = pluginutils.createFilter(include, exclude);
  let hmrClientModuleId = "\0__HMR_CLIENT_MODULE_ID__";

  return {
    name: "enable-hmr",
    buildStart() {
      this.emitFile({ type: "chunk", id: hmrClientModuleId, fileName });
    },
    resolveId(id: string) {
      if (id === hmrClientModuleId) return id;
      return null;
    },
    load(id: string) {
      if (id === hmrClientModuleId) return hmrClientCode;
      return null;
    },
    async transform(code: string, id: string) {
      if (!filter(id)) return null;

      let result = await babelTransform(code, {
        configFile: false,
        plugins: [enableMetaHot(hmrClientModuleId)]
      });

      return {
        code: result.code!,
        map: result.map
      };
    }
  };
}

/**
 * Emits a separate chunk for each unique import id.
 */
export function npmChunks({
  getChunkName = (id: string) => `_npm/${id}`
}: {
  getChunkName?: (id: string) => string;
} = {}): rollup.Plugin {
  let npmChunkIds = new Set<string>();

  return {
    name: "npm-chunks",
    resolveId(id: string) {
      if (isMagicModuleId(id)) return null;
      if (isBareModuleId(id)) npmChunkIds.add(id);
      return null;
    },
    outputOptions(options: rollup.OutputOptions) {
      let chunks: Record<string, string[]> = Object.create(null);

      Array.from(npmChunkIds).forEach(id => {
        chunks[getChunkName(id)] = [id];
      });

      return {
        ...options,
        manualChunks: chunks
      };
    }
  };
}

/**
 * Externalizes all bare (npm) imports and optionally rewrites them to something
 * else in the output bundle.
 */
export function npmExternals({
  rewriteId
}: {
  rewriteId?: (id: string) => string;
}): rollup.Plugin {
  return {
    name: "npm-externals",
    resolveId(id: string) {
      if (isMagicModuleId(id)) return null;
      if (isBareModuleId(id)) return { id, external: true };
      return null;
    },
    async generateBundle(
      _options: rollup.OutputOptions,
      bundle: rollup.OutputBundle
    ) {
      if (!rewriteId) return;
      await rewriteChunkIds(bundle, id =>
        isBareModuleId(id) ? rewriteId(id) : id
      );
    }
  };
}

/**
 * Converts all imports of npm packages to ESM, including packages that are
 * published as CommonJS. This can be useful when shipping npm packages to the
 * browser using <script type=module>.
 */
export function npmEsm(): rollup.Plugin {
  let magicProxyPrefix = "\0npm-esm-proxy:";

  return {
    name: "npm-esm",
    resolveId(id: string, importer?: string) {
      if (id.startsWith(magicProxyPrefix)) {
        // This an import of one of our magic proxy ids from a ?commonjs-proxy
        // module which for some reason imports it as an external...
        //
        // Error:
        // 'npm-esm-proxy:object-assign' is imported as an external by
        // npm-esm-proxy:object-assign?commonjs-proxy, but is already an
        // existing non-external module id.
        return id;
      }

      if (
        importer &&
        importer.startsWith(magicProxyPrefix) &&
        importer.slice(magicProxyPrefix.length) === id
      ) {
        // This is an import of the original id from the proxy module that was
        // created in load(). Return null here to defer id resolution and avoid
        // creating another proxy for it.
        return null;
      }

      if (isMagicModuleId(id)) {
        return null;
      }

      if (isBareModuleId(id)) {
        return magicProxyPrefix + id;
      }

      return null;
    },
    async load(id: string) {
      if (!id.startsWith(magicProxyPrefix)) {
        return null;
      }

      let bareId = id.slice(magicProxyPrefix.length);
      let source = await this.resolve(bareId, id, { skipSelf: true });
      if (!source) {
        throw new Error(`Missing source module for id "${bareId}"`);
      }

      return createProxyModule(bareId, source.id);
    }
  };
}

/**
 * Rewrites all bare module identifiers in the output chunks using the given
 * function transform. This is useful for rewriting these ids to point back to
 * the server in development.
 */
export function rewriteBareIds(
  rewriteId: (id: string) => string
): rollup.Plugin {
  return {
    name: "rewrite-bare-ids",
    async generateBundle(
      _options: rollup.OutputOptions,
      bundle: rollup.OutputBundle
    ) {
      await rewriteChunkIds(bundle, id =>
        isBareModuleId(id) ? rewriteId(id) : id
      );
    }
  };
}

async function rewriteChunkIds(
  bundle: rollup.OutputBundle,
  rewriteId: (id: string) => string
) {
  for (let fileName of Object.keys(bundle)) {
    let chunk = bundle[fileName];
    if (chunk.type !== "chunk") continue;

    let changedIds: Record<string, string> = {};
    let { code, map } = await babelTransform(chunk.code, {
      configFile: false,
      plugins: [
        rewriteIds(id => {
          let newId = rewriteId(id);
          if (id !== newId) changedIds[id] = newId;
          return newId;
        })
      ],
      inputSourceMap: chunk.map,
      sourceFileName: fileName,
      sourceMaps: true,
      // Avoid trying to style this module since it can take a while.
      comments: false,
      compact: true
    });

    chunk.code = code as string;
    chunk.map = map as rollup.SourceMap;
    chunk.imports = chunk.imports.map(id => changedIds[id] || id);
  }
}
