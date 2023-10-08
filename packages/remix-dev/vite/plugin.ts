import { type BinaryLike, createHash } from "node:crypto";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { existsSync as fsExistsSync } from "node:fs";
import { execSync } from "node:child_process";
import babel from "@babel/core";
import PackageJson from "@npmcli/package-json";
import { type ServerBuild } from "@remix-run/server-runtime";
import {
  type Plugin,
  type Manifest as ViteManifest,
  type ResolvedConfig as ResolvedViteConfig,
  type ViteDevServer,
  type UserConfig as ViteUserConfig,
  normalizePath as viteNormalizePath,
  createServer as createViteDevServer,
} from "vite";
import {
  init as initEsModuleLexer,
  parse as esModuleLexer,
} from "es-module-lexer";
import jsesc from "jsesc";

import { defineRoutes, type RouteManifest } from "../config/routes";
import {
  type AppConfig as RemixUserConfig,
  type RemixConfig as ResolvedRemixConfig,
} from "../config";
import { flatRoutes } from "../config/flat-routes";
import { detectPackageManager } from "../cli/detectPackageManager";
import { type Manifest } from "../manifest";
import { createRequestHandler } from "./node/adapter";
import { getStylesForUrl, isCssModulesFile } from "./styles";
import * as VirtualModule from "./vmod";
import { removeExports } from "./remove-exports";
import { transformLegacyCssImports } from "./legacy-css-imports";
import { replaceImportSpecifier } from "./replace-import-specifier";

export type RemixVitePluginOptions = Pick<
  RemixUserConfig,
  | "appDirectory"
  | "assetsBuildDirectory"
  | "ignoredRouteFiles"
  | "publicPath"
  | "routes"
  | "serverBuildPath"
  | "serverModuleFormat"
>;

type ResolvedRemixVitePluginConfig = Pick<
  ResolvedRemixConfig,
  | "appDirectory"
  | "rootDirectory"
  | "assetsBuildDirectory"
  | "entryClientFilePath"
  | "entryServerFilePath"
  | "future"
  | "publicPath"
  | "relativeAssetsBuildDirectory"
  | "routes"
  | "serverBuildPath"
  | "serverModuleFormat"
>;

let serverEntryId = VirtualModule.id("server-entry");
let serverManifestId = VirtualModule.id("server-manifest");
let browserManifestId = VirtualModule.id("browser-manifest");
let remixReactProxyId = VirtualModule.id("remix-react-proxy");
let hmrRuntimeId = VirtualModule.id("hmr-runtime");

const normalizePath = (p: string) => {
  let unixPath = p.replace(/[\\/]+/g, "/").replace(/^([a-zA-Z]+:|\.\/)/, "");
  return viteNormalizePath(unixPath);
};

const resolveFileUrl = (
  { rootDirectory }: Pick<ResolvedRemixVitePluginConfig, "rootDirectory">,
  filePath: string
) => {
  let relativePath = path.relative(rootDirectory, filePath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error(
      `Cannot resolve asset path "${filePath}" outside of root directory "${rootDirectory}".`
    );
  }

  return `/${normalizePath(relativePath)}`;
};

const isJsFile = (filePath: string) => /\.[cm]?[jt]sx?$/i.test(filePath);

type Route = RouteManifest[string];
const resolveRelativeRouteFilePath = (
  route: Route,
  pluginConfig: ResolvedRemixVitePluginConfig
) => {
  let file = route.file;
  let fullPath = path.resolve(pluginConfig.appDirectory, file);

  return normalizePath(fullPath);
};

let vmods = [serverEntryId, serverManifestId, browserManifestId];

const getHash = (source: BinaryLike, maxLength?: number): string => {
  let hash = createHash("sha256").update(source).digest("hex");
  return typeof maxLength === "number" ? hash.slice(0, maxLength) : hash;
};

const resolveBuildAssetPaths = (
  pluginConfig: ResolvedRemixVitePluginConfig,
  manifest: ViteManifest,
  absoluteFilePath: string
): Manifest["entry"] & { css: string[] } => {
  let rootRelativeFilePath = path.relative(
    pluginConfig.rootDirectory,
    absoluteFilePath
  );
  let manifestKey = normalizePath(rootRelativeFilePath);
  let manifestEntry = manifest[manifestKey];

  if (!manifestEntry) {
    let knownManifestKeys = Object.keys(manifest)
      .map((key) => '"' + key + '"')
      .join(", ");
    throw new Error(
      `No manifest entry found for "${manifestKey}". Known manifest keys: ${knownManifestKeys}`
    );
  }

  return {
    module: `${pluginConfig.publicPath}${manifestEntry.file}`,
    imports:
      manifestEntry.imports?.map((imported) => {
        return `${pluginConfig.publicPath}${manifest[imported].file}`;
      }) ?? [],
    css:
      manifestEntry.css?.map((href) => {
        return `${pluginConfig.publicPath}${href}`;
      }) ?? [],
  };
};

const writeFileSafe = async (file: string, contents: string): Promise<void> => {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, contents);
};

const getRouteModuleExports = async (
  viteChildCompiler: ViteDevServer | null,
  pluginConfig: ResolvedRemixVitePluginConfig,
  routeFile: string
): Promise<string[]> => {
  if (!viteChildCompiler) {
    throw new Error("Vite child compiler not found");
  }

  // We transform the route module code with the Vite child compiler so that we
  // can parse the exports from non-JS files like MDX. This ensures that we can
  // understand the exports from anything that Vite can compile to JS, not just
  // the route file formats that the Remix compiler historically supported.

  let ssr = true;
  let { pluginContainer, moduleGraph } = viteChildCompiler;
  let routePath = path.join(pluginConfig.appDirectory, routeFile);
  let url = resolveFileUrl(pluginConfig, routePath);

  let resolveId = async () => {
    let result = await pluginContainer.resolveId(url, undefined, { ssr });
    if (!result) throw new Error(`Could not resolve module ID for ${url}`);
    return result.id;
  };

  let [id, code] = await Promise.all([
    resolveId(),
    fs.readFile(routePath, "utf-8"),
    // pluginContainer.transform(...) fails if we don't do this first:
    moduleGraph.ensureEntryFromUrl(url, ssr),
  ]);

  let transformed = await pluginContainer.transform(code, id, { ssr });
  let [, exports] = esModuleLexer(transformed.code);
  let exportNames = exports.map((e) => e.n);

  return exportNames;
};

const entryExts = [".js", ".jsx", ".ts", ".tsx"];
const findEntry = (dir: string, basename: string): string | undefined => {
  for (let ext of entryExts) {
    let file = path.resolve(dir, basename + ext);
    if (fsExistsSync(file)) return path.relative(dir, file);
  }

  return undefined;
};

const addTrailingSlash = (path: string): string =>
  path.endsWith("/") ? path : path + "/";

export let remix: (options?: RemixVitePluginOptions) => Plugin[] = (
  options = {}
) => {
  let viteCommand: ResolvedViteConfig["command"];
  let viteUserConfig: ViteUserConfig;

  let cssModulesManifest: Record<string, string> = {};
  let ssrBuildContext:
    | { isSsrBuild: false }
    | { isSsrBuild: true; getManifest: () => Promise<Manifest> };

  let viteChildCompiler: ViteDevServer | null = null;

  let resolvePluginConfig =
    async (): Promise<ResolvedRemixVitePluginConfig> => {
      let rootDirectory =
        viteUserConfig.root ?? process.env.REMIX_ROOT ?? process.cwd();
      let appDirectory = path.resolve(
        rootDirectory,
        options.appDirectory ?? "app"
      );
      let serverBuildPath = path.resolve(
        rootDirectory,
        options.serverBuildPath ?? "build/index.js"
      );
      let serverModuleFormat = options.serverModuleFormat ?? "esm";
      let relativeAssetsBuildDirectory =
        options.assetsBuildDirectory ?? path.join("public", "build");
      let assetsBuildDirectory = path.resolve(
        rootDirectory,
        relativeAssetsBuildDirectory
      );

      let defaultsDirectory = path.resolve(
        __dirname,
        "..",
        "config",
        "defaults"
      );

      let userEntryClientFile = findEntry(appDirectory, "entry.client");
      let entryClientFile = userEntryClientFile ?? "entry.client.tsx";

      let userEntryServerFile = findEntry(appDirectory, "entry.server");
      let entryServerFile: string;

      let pkgJson = await PackageJson.load(rootDirectory);
      let deps = pkgJson.content.dependencies ?? {};

      if (userEntryServerFile) {
        entryServerFile = userEntryServerFile;
      } else {
        let serverRuntime = deps["@remix-run/deno"]
          ? "deno"
          : deps["@remix-run/cloudflare"]
          ? "cloudflare"
          : deps["@remix-run/node"]
          ? "node"
          : undefined;

        if (!serverRuntime) {
          let serverRuntimes = [
            "@remix-run/deno",
            "@remix-run/cloudflare",
            "@remix-run/node",
          ];
          let disjunctionListFormat = new Intl.ListFormat("en", {
            style: "long",
            type: "disjunction",
          });
          let formattedList = disjunctionListFormat.format(serverRuntimes);
          throw new Error(
            `Could not determine server runtime. Please install one of the following: ${formattedList}`
          );
        }

        if (!deps["isbot"]) {
          console.log(
            "adding `isbot` to your package.json, you should commit this change"
          );

          pkgJson.update({
            dependencies: {
              ...pkgJson.content.dependencies,
              isbot: "latest",
            },
          });

          await pkgJson.save();

          let packageManager = detectPackageManager() ?? "npm";

          execSync(`${packageManager} install`, {
            cwd: rootDirectory,
            stdio: "inherit",
          });
        }

        entryServerFile = `entry.server.${serverRuntime}.tsx`;
      }

      let entryClientFilePath = userEntryClientFile
        ? path.resolve(appDirectory, userEntryClientFile)
        : path.resolve(defaultsDirectory, entryClientFile);

      let entryServerFilePath = userEntryServerFile
        ? path.resolve(appDirectory, userEntryServerFile)
        : path.resolve(defaultsDirectory, entryServerFile);

      let publicPath = addTrailingSlash(options.publicPath ?? "/build/");

      let rootRouteFile = findEntry(appDirectory, "root");
      if (!rootRouteFile) {
        throw new Error(`Missing "root" route file in ${appDirectory}`);
      }

      let routes: RouteManifest = {
        root: { path: "", id: "root", file: rootRouteFile },
      };

      if (fsExistsSync(path.resolve(appDirectory, "routes"))) {
        let fileRoutes = flatRoutes(appDirectory, options.ignoredRouteFiles);
        for (let route of Object.values(fileRoutes)) {
          routes[route.id] = { ...route, parentId: route.parentId || "root" };
        }
      }
      if (options.routes) {
        let manualRoutes = await options.routes(defineRoutes);
        for (let route of Object.values(manualRoutes)) {
          routes[route.id] = { ...route, parentId: route.parentId || "root" };
        }
      }

      return {
        appDirectory,
        rootDirectory,
        assetsBuildDirectory,
        entryClientFilePath,
        publicPath,
        routes,
        entryServerFilePath,
        serverBuildPath,
        serverModuleFormat,
        relativeAssetsBuildDirectory,
        future: {},
      };
    };

  let getServerEntry = async () => {
    let pluginConfig = await resolvePluginConfig();

    return `
    import * as entryServer from ${JSON.stringify(
      resolveFileUrl(pluginConfig, pluginConfig.entryServerFilePath)
    )};
    ${Object.keys(pluginConfig.routes)
      .map((key, index) => {
        let route = pluginConfig.routes[key]!;
        return `import * as route${index} from ${JSON.stringify(
          resolveFileUrl(
            pluginConfig,
            resolveRelativeRouteFilePath(route, pluginConfig)
          )
        )};`;
      })
      .join("\n")}
      export { default as assets } from ${JSON.stringify(serverManifestId)};
      export const assetsBuildDirectory = ${JSON.stringify(
        pluginConfig.relativeAssetsBuildDirectory
      )};
      ${
        pluginConfig.future
          ? `export const future = ${JSON.stringify(pluginConfig.future)}`
          : ""
      };
      export const publicPath = ${JSON.stringify(pluginConfig.publicPath)};
      export const entry = { module: entryServer };
      export const routes = {
        ${Object.keys(pluginConfig.routes)
          .map((key, index) => {
            let route = pluginConfig.routes[key]!;
            return `${JSON.stringify(key)}: {
          id: ${JSON.stringify(route.id)},
          parentId: ${JSON.stringify(route.parentId)},
          path: ${JSON.stringify(route.path)},
          index: ${JSON.stringify(route.index)},
          caseSensitive: ${JSON.stringify(route.caseSensitive)},
          module: route${index}
        }`;
          })
          .join(",\n  ")}
      };`;
  };

  let createBuildManifest = async (): Promise<Manifest> => {
    let pluginConfig = await resolvePluginConfig();
    let viteManifest = JSON.parse(
      await fs.readFile(
        path.resolve(pluginConfig.assetsBuildDirectory, "manifest.json"),
        "utf-8"
      )
    ) as ViteManifest;

    let entry: Manifest["entry"] = resolveBuildAssetPaths(
      pluginConfig,
      viteManifest,
      pluginConfig.entryClientFilePath
    );

    let routes: Manifest["routes"] = {};
    for (let [key, route] of Object.entries(pluginConfig.routes)) {
      let routeFilePath = path.join(pluginConfig.appDirectory, route.file);
      let sourceExports = await getRouteModuleExports(
        viteChildCompiler,
        pluginConfig,
        route.file
      );

      routes[key] = {
        id: route.id,
        parentId: route.parentId,
        path: route.path,
        index: route.index,
        caseSensitive: route.caseSensitive,
        hasAction: sourceExports.includes("action"),
        hasLoader: sourceExports.includes("loader"),
        hasErrorBoundary: sourceExports.includes("ErrorBoundary"),
        ...resolveBuildAssetPaths(pluginConfig, viteManifest, routeFilePath),
      };
    }

    let fingerprintedValues = { entry, routes };
    let version = getHash(JSON.stringify(fingerprintedValues), 8);
    let manifestFilename = `manifest-${version}.js`;
    let url = `${pluginConfig.publicPath}${manifestFilename}`;
    let nonFingerprintedValues = { url, version };

    let manifest: Manifest = {
      ...fingerprintedValues,
      ...nonFingerprintedValues,
    };

    await writeFileSafe(
      path.join(pluginConfig.assetsBuildDirectory, manifestFilename),
      `window.__remixManifest=${JSON.stringify(manifest)};`
    );

    return manifest;
  };

  let getDevManifest = async (): Promise<Manifest> => {
    let pluginConfig = await resolvePluginConfig();
    let routes: Manifest["routes"] = {};

    for (let [key, route] of Object.entries(pluginConfig.routes)) {
      let sourceExports = await getRouteModuleExports(
        viteChildCompiler,
        pluginConfig,
        route.file
      );

      routes[key] = {
        id: route.id,
        parentId: route.parentId,
        path: route.path,
        index: route.index,
        caseSensitive: route.caseSensitive,
        module: `${resolveFileUrl(
          pluginConfig,
          resolveRelativeRouteFilePath(route, pluginConfig)
        )}${
          isJsFile(route.file) ? "" : "?import" // Ensure the Vite dev server responds with a JS module
        }`,
        hasAction: sourceExports.includes("action"),
        hasLoader: sourceExports.includes("loader"),
        hasErrorBoundary: sourceExports.includes("ErrorBoundary"),
        imports: [],
      };
    }

    return {
      version: String(Math.random()),
      url: VirtualModule.url(browserManifestId),
      entry: {
        module: resolveFileUrl(pluginConfig, pluginConfig.entryClientFilePath),
        imports: [],
      },
      routes,
    };
  };

  return [
    {
      name: "remix",
      config: async (_viteUserConfig, viteConfigEnv) => {
        viteUserConfig = _viteUserConfig;
        viteCommand = viteConfigEnv.command;

        let pluginConfig = await resolvePluginConfig();

        return {
          appType: "custom",
          experimental: { hmrPartialAccept: true },
          ...(viteCommand === "build" && {
            base: pluginConfig.publicPath,
            build: {
              ...viteUserConfig.build,
              ...(!viteConfigEnv.ssrBuild
                ? {
                    manifest: true,
                    outDir: pluginConfig.assetsBuildDirectory,
                    rollupOptions: {
                      ...viteUserConfig.build?.rollupOptions,
                      preserveEntrySignatures: "exports-only",
                      input: [
                        pluginConfig.entryClientFilePath,
                        ...Object.values(pluginConfig.routes).map((route) =>
                          path.resolve(pluginConfig.appDirectory, route.file)
                        ),
                      ],
                    },
                  }
                : {
                    outDir: path.dirname(pluginConfig.serverBuildPath),
                    rollupOptions: {
                      ...viteUserConfig.build?.rollupOptions,
                      preserveEntrySignatures: "exports-only",
                      input: serverEntryId,
                      output: {
                        entryFileNames: path.basename(
                          pluginConfig.serverBuildPath
                        ),
                        format: pluginConfig.serverModuleFormat,
                      },
                    },
                  }),
            },
          }),
        };
      },
      async configResolved(viteConfig) {
        await initEsModuleLexer;

        viteChildCompiler = await createViteDevServer({
          ...viteUserConfig,
          configFile: false,
          envFile: false,
          plugins: [
            ...(viteUserConfig.plugins ?? [])
              .flat()
              // Exclude this plugin from the child compiler to prevent an
              // infinite loop (plugin creates a child compiler with the same
              // plugin that creates another child compiler, repeat ad
              // infinitum), and to prevent the manifest from being written to
              // disk from the child compiler. This is important in the
              // production build because the child compiler is a Vite dev
              // server and will generate incorrect manifests.
              .filter(
                (plugin) =>
                  typeof plugin === "object" &&
                  plugin !== null &&
                  "name" in plugin &&
                  plugin.name !== "remix" &&
                  plugin.name !== "remix-hmr-updates"
              ),
            {
              name: "no-hmr",
              handleHotUpdate() {
                // parent vite server is already sending HMR updates
                // do not send duplicate HMR updates from child server
                // which log confusing "page reloaded" messages that aren't true
                return [];
              },
            },
          ],
        });
        await viteChildCompiler.pluginContainer.buildStart({});

        ssrBuildContext =
          viteConfig.build.ssr && viteCommand === "build"
            ? { isSsrBuild: true, getManifest: createBuildManifest }
            : { isSsrBuild: false };
      },
      transform(code, id) {
        if (isCssModulesFile(id)) {
          cssModulesManifest[id] = code;
        }
      },
      configureServer(vite) {
        return () => {
          vite.middlewares.use(async (req, res, next) => {
            try {
              // Invalidate all virtual modules
              vmods.forEach((vmod) => {
                let mod = vite.moduleGraph.getModuleById(
                  VirtualModule.resolve(vmod)
                );

                if (mod) {
                  vite.moduleGraph.invalidateModule(mod);
                }
              });

              let { url } = req;
              let [pluginConfig, build] = await Promise.all([
                resolvePluginConfig(),
                vite.ssrLoadModule(serverEntryId) as Promise<ServerBuild>,
              ]);

              let handle = createRequestHandler(build, {
                mode: "development",
                criticalCss: await getStylesForUrl(
                  vite,
                  pluginConfig,
                  cssModulesManifest,
                  build,
                  url
                ),
              });

              await handle(req, res);
            } catch (error) {
              next(error);
            }
          });
        };
      },
      async buildEnd() {
        await viteChildCompiler?.close();
      },
    },
    {
      name: "remix-virtual-modules",
      enforce: "pre",
      resolveId(id) {
        if (vmods.includes(id)) return VirtualModule.resolve(id);
      },
      async load(id) {
        switch (id) {
          case VirtualModule.resolve(serverEntryId): {
            return await getServerEntry();
          }
          case VirtualModule.resolve(serverManifestId): {
            let manifest = ssrBuildContext.isSsrBuild
              ? await ssrBuildContext.getManifest()
              : await getDevManifest();

            return `export default ${jsesc(manifest, { es6: true })};`;
          }
          case VirtualModule.resolve(browserManifestId): {
            if (viteCommand === "build") {
              throw new Error("This module only exists in development");
            }

            let manifest = await getDevManifest();

            return `window.__remixManifest=${jsesc(manifest, { es6: true })};`;
          }
        }
      },
    },
    {
      name: "remix-empty-server-modules",
      enforce: "pre",
      async transform(_code, id, options) {
        if (!options?.ssr && /\.server(\.[cm]?[jt]sx?)?$/.test(id))
          return {
            code: "export default {}",
            map: null,
          };
      },
    },
    {
      name: "remix-empty-client-modules",
      enforce: "pre",
      async transform(_code, id, options) {
        if (options?.ssr && /\.client(\.[cm]?[jt]sx?)?$/.test(id))
          return {
            code: "export default {}",
            map: null,
          };
      },
    },
    {
      name: "remix-remove-server-exports",
      enforce: "post", // Ensure we're operating on the transformed code to support MDX etc.
      async transform(code, id, options) {
        if (options?.ssr) return;

        let pluginConfig = await resolvePluginConfig();

        let route = getRoute(pluginConfig, id);
        if (!route) return;

        let serverExports = ["loader", "action", "headers"];

        let routeExports = await getRouteModuleExports(
          viteChildCompiler,
          pluginConfig,
          route.file
        );

        // ignore resource routes that only have server exports
        // note: resource routes for fullstack components don't need a `default` export
        // but still need their server exports removed
        let browserExports = routeExports.filter(
          (x) => !serverExports.includes(x)
        );
        if (browserExports.length === 0) return;

        return {
          code: removeExports(code, serverExports),
          map: null,
        };
      },
    },
    {
      name: "remix-remix-react-proxy",
      enforce: "post", // Ensure we're operating on the transformed code to support MDX etc.
      resolveId(id) {
        if (id === remixReactProxyId) {
          return VirtualModule.resolve(remixReactProxyId);
        }
      },
      transform(code, id) {
        // Don't transform the proxy itself, otherwise it will import itself
        if (id === VirtualModule.resolve(remixReactProxyId)) {
          return;
        }

        // Don't transform files that don't need the proxy
        if (
          !code.includes("@remix-run/react") &&
          !code.includes("LiveReload")
        ) {
          return;
        }

        // Rewrite imports to use the proxy
        return replaceImportSpecifier({
          code,
          specifier: "@remix-run/react",
          replaceWith: remixReactProxyId,
        });
      },
      load(id) {
        if (id === VirtualModule.resolve(remixReactProxyId)) {
          // TODO: ensure react refresh is initialized before `<Scripts />`
          return [
            'import { createElement } from "react";',
            'export * from "@remix-run/react";',
            'export const LiveReload = process.env.NODE_ENV !== "development" ? () => null : ',
            '() => createElement("script", {',
            ' type: "module",',
            " suppressHydrationWarning: true,",
            " dangerouslySetInnerHTML: { __html: `",
            `   import RefreshRuntime from "${VirtualModule.url(
              hmrRuntimeId
            )}"`,
            "   RefreshRuntime.injectIntoGlobalHook(window)",
            "   window.$RefreshReg$ = () => {}",
            "   window.$RefreshSig$ = () => (type) => type",
            "   window.__vite_plugin_react_preamble_installed__ = true",
            " `}",
            "});",
          ].join("\n");
        }
      },
    },
    {
      name: "remix-hmr-runtime",
      enforce: "pre",
      resolveId(id) {
        if (id === hmrRuntimeId) return VirtualModule.resolve(hmrRuntimeId);
      },
      async load(id) {
        if (id !== VirtualModule.resolve(hmrRuntimeId)) return;

        let reactRefreshDir = path.dirname(
          require.resolve("react-refresh/package.json")
        );
        let reactRefreshRuntimePath = path.join(
          reactRefreshDir,
          "cjs/react-refresh-runtime.development.js"
        );

        return [
          "const exports = {}",
          await fs.readFile(reactRefreshRuntimePath, "utf8"),
          await fs.readFile(
            require.resolve("./static/refresh-utils.cjs"),
            "utf8"
          ),
          "export default exports",
        ].join("\n");
      },
    },
    {
      name: "remix-react-refresh-babel",
      enforce: "post",
      async transform(code, id, options) {
        if (viteCommand !== "serve") return;
        if (id.includes("/node_modules/")) return;

        let [filepath] = id.split("?");
        if (!/.[tj]sx?$/.test(filepath)) return;

        let devRuntime = "react/jsx-dev-runtime";
        let ssr = options?.ssr === true;
        let isJSX = filepath.endsWith("x");
        let useFastRefresh = !ssr && (isJSX || code.includes(devRuntime));
        if (!useFastRefresh) return;

        let result = await babel.transformAsync(code, {
          filename: id,
          sourceFileName: filepath,
          parserOpts: {
            sourceType: "module",
            allowAwaitOutsideFunction: true,
            plugins: ["jsx", "typescript"],
          },
          plugins: ["react-refresh/babel"],
          sourceMaps: true,
        });
        if (result === null) return;

        code = result.code!;
        let refreshContentRE = /\$Refresh(?:Reg|Sig)\$\(/;
        if (refreshContentRE.test(code)) {
          let pluginConfig = await resolvePluginConfig();
          code = addRefreshWrapper(pluginConfig, code, id);
        }
        return { code, map: result.map };
      },
    },
    {
      name: "remix-hmr-updates",
      async handleHotUpdate({ server, file, modules }) {
        let pluginConfig = await resolvePluginConfig();
        let route = getRoute(pluginConfig, file);
        if (route) {
          server.ws.send({
            type: "custom",
            event: "remix:hmr-route",
            data: {
              route: await getRouteMetadata(
                pluginConfig,
                viteChildCompiler,
                route
              ),
            },
          });
          return modules;
        }
        return modules;
      },
    },
  ];
};

function addRefreshWrapper(
  pluginConfig: ResolvedRemixVitePluginConfig,
  code: string,
  id: string
): string {
  let isRoute = getRoute(pluginConfig, id);
  let acceptExports = isRoute ? ["meta", "links", "shouldRevalidate"] : [];
  return (
    REACT_REFRESH_HEADER.replace("__SOURCE__", JSON.stringify(id)) +
    code +
    REACT_REFRESH_FOOTER.replace("__SOURCE__", JSON.stringify(id)).replace(
      "__ACCEPT_EXPORTS__",
      JSON.stringify(acceptExports)
    )
  );
}

const REACT_REFRESH_HEADER = `
import RefreshRuntime from "${hmrRuntimeId}";

const inWebWorker = typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope;
let prevRefreshReg;
let prevRefreshSig;

if (import.meta.hot && !inWebWorker) {
  if (!window.__vite_plugin_react_preamble_installed__) {
    throw new Error(
      "@vitejs/plugin-react can't detect preamble. Something is wrong. " +
      "See https://github.com/vitejs/vite-plugin-react/pull/11#discussion_r430879201"
    );
  }

  prevRefreshReg = window.$RefreshReg$;
  prevRefreshSig = window.$RefreshSig$;
  window.$RefreshReg$ = (type, id) => {
    RefreshRuntime.register(type, __SOURCE__ + " " + id)
  };
  window.$RefreshSig$ = RefreshRuntime.createSignatureFunctionForTransform;
}`.replace(/\n+/g, "");

const REACT_REFRESH_FOOTER = `
if (import.meta.hot && !inWebWorker) {
  window.$RefreshReg$ = prevRefreshReg;
  window.$RefreshSig$ = prevRefreshSig;
  RefreshRuntime.__hmr_import(import.meta.url).then((currentExports) => {
    RefreshRuntime.registerExportsForReactRefresh(__SOURCE__, currentExports);
    import.meta.hot.accept((nextExports) => {
      if (!nextExports) return;
      const invalidateMessage = RefreshRuntime.validateRefreshBoundaryAndEnqueueUpdate(currentExports, nextExports, __ACCEPT_EXPORTS__);
      if (invalidateMessage) import.meta.hot.invalidate(invalidateMessage);
    });
  });
}`;

export let legacyCssImportSemantics: () => Plugin[] = () => {
  return [
    {
      name: "remix-legacy-css-import-semantics",
      enforce: "pre",
      transform(code) {
        if (code.includes('.css"') || code.includes(".css'")) {
          return transformLegacyCssImports(code);
        }
      },
    },
  ];
};

function getRoute(
  pluginConfig: ResolvedRemixVitePluginConfig,
  file: string
): Route | undefined {
  if (!file.startsWith(pluginConfig.appDirectory)) return;
  let routePath = path.relative(pluginConfig.appDirectory, file);
  let route = Object.values(pluginConfig.routes).find(
    (r) => r.file === routePath
  );
  return route;
}

async function getRouteMetadata(
  pluginConfig: ResolvedRemixVitePluginConfig,
  viteChildCompiler: ViteDevServer | null,
  route: Route
) {
  let sourceExports = await getRouteModuleExports(
    viteChildCompiler,
    pluginConfig,
    route.file
  );

  let info = {
    id: route.id,
    parentId: route.parentId,
    path: route.path,
    index: route.index,
    caseSensitive: route.caseSensitive,
    url:
      "/" +
      path.relative(
        pluginConfig.rootDirectory,
        resolveRelativeRouteFilePath(route, pluginConfig)
      ),
    module: `${resolveFileUrl(
      pluginConfig,
      resolveRelativeRouteFilePath(route, pluginConfig)
    )}?import`, // Ensure the Vite dev server responds with a JS module
    hasAction: sourceExports.includes("action"),
    hasLoader: sourceExports.includes("loader"),
    hasErrorBoundary: sourceExports.includes("ErrorBoundary"),
    imports: [],
  };
  return info;
}
