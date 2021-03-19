import { builtinModules as nodeBuiltins } from "module";
import * as esbuild from "esbuild";
import * as path from "path";
import chokidar from "chokidar";
// @ts-expect-error
import readPackageJson from "read-package-json-fast";

import { BuildMode, BuildTarget } from "./build";
import type { RemixConfig } from "./config";
import { getHash } from "./utils/crypto";
import {
  writeFileSafe,
  writeFilesSafe,
  createTemporaryDirectory
} from "./utils/fs";
import invariant from "./invariant";

// When we build Remix, this shim file is copied directly into the output
// directory in the same place relative to this file. It is eventually injected
// as a source file when building the app.
const reactShim = path.resolve(__dirname, "compiler2/shims/react.ts");

/*
Stuff to do still:
- make a decision about mdx
- support for css:
- get url: imports working

- hash route modules for production
- watch mode for dev
*/

const loaders: esbuild.BuildOptions["loader"] = {
  ".aac": "file",
  ".css": "file",
  ".eot": "file",
  ".flac": "file",
  ".gif": "file",
  ".jpeg": "file",
  ".jpg": "file",
  ".json": "json",
  ".md": "text",
  ".mdx": "text",
  ".mp3": "file",
  ".mp4": "file",
  ".ogg": "file",
  ".otf": "file",
  ".png": "file",
  ".svg": "file",
  ".ttf": "file",
  ".wav": "file",
  ".webm": "file",
  ".webp": "file",
  ".woff": "file",
  ".woff2": "file"
};

interface BuildOptions {
  mode: BuildMode;
  target: BuildTarget;
}

export async function build(
  config: RemixConfig,
  {
    mode = BuildMode.Production,
    target = BuildTarget.Node14
  }: Partial<BuildOptions> = {}
) {
  let exports = await getExports(
    Object.keys(config.routeManifest).map(
      key => config.routeManifest[key].moduleFile
    ),
    config.appDirectory,
    target,
    config.publicPath
  );
  let tmpdir = await createTemporaryDirectory(path.resolve("pre-build"));
  let clientEntryPoint = await getClientEntryPoint(config, tmpdir);
  let routeEntryPoints = await getRouteEntryPoints(config, tmpdir, exports);

  await buildEverything(
    config,
    { mode, target },
    clientEntryPoint,
    routeEntryPoints
  );
}

interface WatchOptions extends BuildOptions {
  onRebuild({ ms }: { ms: number }): void;
}

export async function watch(
  config: RemixConfig,
  {
    mode = BuildMode.Development,
    target = BuildTarget.Node14,
    onRebuild
  }: Partial<WatchOptions> = {}
) {
  let tmpdir = await createTemporaryDirectory(path.resolve("pre-build"));

  let exports = await getExports(
    Object.keys(config.routeManifest).map(
      key => config.routeManifest[key].moduleFile
    ),
    config.appDirectory,
    target,
    config.publicPath
  );
  let clientEntryPoint = getClientEntryPoint(config, tmpdir);
  let routeEntryPoints = getRouteEntryPoints(config, tmpdir, exports);

  await writeFilesSafe([clientEntryPoint, ...routeEntryPoints]);

  let [clientBuild, serverBuild] = await buildEverything(
    config,
    { mode, target },
    clientEntryPoint,
    routeEntryPoints,
    true
  );

  async function rebuildEverything() {
    let start = Date.now();

    await Promise.all([clientBuild.rebuild!(), serverBuild.rebuild!()]);

    if (onRebuild) {
      onRebuild({ ms: Date.now() - start });
    }
  }

  async function rebuildRoute(routeId: string): Promise<void> {
    let route = config.routeManifest[routeId];
    let exports = await getExports(
      [route.moduleFile],
      config.appDirectory,
      target,
      config.publicPath
    );
    let sourceExports = exports.get(route.moduleFile);

    invariant(sourceExports, `Missing source exports for route ${route.id}`);

    // TODO: Don't rewrite the proxy file if the exports didn't change. That's
    // the only thing it has in it.
    let routeEntryPoint = getRouteEntryPoint(
      config.appDirectory,
      tmpdir,
      route,
      sourceExports
    );

    await writeFileSafe(routeEntryPoint.file, routeEntryPoint.contents);
    await rebuildEverything();
  }

  // TODO: Add an empty file
  let watcher = chokidar
    .watch(config.appDirectory, {
      persistent: true,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 100
      }
    })
    .on("error", error => console.error(error))
    .on("change", async file => {
      let relativeFile = path.relative(config.appDirectory, file);
      let routeId = Object.keys(config.routeManifest).find(
        key => config.routeManifest[key].moduleFile === relativeFile
      );

      if (routeId != null) {
        await rebuildRoute(routeId);
      } else {
        await rebuildEverything();
      }
    });

  // let timer = setInterval(rebuildEverything, 2000);

  // let exports = getAllRoutesExports();
  // let builder = await buildEverything(exports);

  // onRouteModuleChange(async routeModule => {
  //   let newExports = await getRouteExports(routeModule);
  //   await builder.rebuildFromRouteChange(newExports);
  //   onRebuild()
  // });

  // onRandomFileChange(async () => {
  //   await builder.rebuild();
  //   onRebuild()
  // });

  // onRouteModuleAddedOrDeleted(() => {
  //   await builder.reset();
  //   let exports = getAllRoutesExports();
  //   builder = buildEverything()
  //   onRebuild()
  // });

  // when the server first boots:
  // - get all routes' exports
  // - build client/assets/server

  // when a route module changes:
  // - get its exports
  // - rebuild client/assets/server

  // when anything else changes:
  // - rebuild client/assets/server

  // when route module is added/deleted:
  // - dispose + setup

  return async () => {
    await watcher.close();
    await Promise.all([
      clientBuild.rebuild?.dispose(),
      serverBuild.rebuild?.dispose()
    ]);
  };
}

///////////////////////////////////////////////////////////////////////////////

type RouteExports = Map<string, string[]>;

async function getExports(
  relativeEntryPoints: string[],
  rootDir: string,
  target: BuildTarget,
  publicPath: string
): Promise<RouteExports> {
  let result = await esbuild.build({
    entryPoints: relativeEntryPoints.map(ep => path.resolve(rootDir, ep)),
    platform: "node",
    target,
    format: "esm",
    bundle: true,
    splitting: true,
    loader: loaders,
    publicPath,
    metafile: true,
    outdir: ".",
    write: false
  });
  let metafile = result.metafile!;

  let exports: RouteExports = new Map();

  for (let key in metafile.outputs) {
    let output = metafile.outputs[key];
    if (output.entryPoint) {
      exports.set(
        path.relative(rootDir, path.resolve(output.entryPoint)),
        output.exports
      );
    }
  }

  return exports;
}

async function buildEverything(
  config: RemixConfig,
  options: BuildOptions,
  clientEntryPoint: ClientEntryPoint,
  routeEntryPoints: RouteEntryPoint[],
  incremental = false
): Promise<[esbuild.BuildResult, esbuild.BuildResult]> {
  let appPackageJsonFile = path.join(config.rootDirectory, "package.json");
  let appDependencies = new Set(
    await getPackageDependencies(appPackageJsonFile)
  );

  // Exclude node built-ins that don't have a browser-safe alternative installed
  // as a dependency. Nothing should *actually* be external in the browser build
  // (we want to bundle all deps) so this is really just making sure we don't
  // accidentally have any dependencies on node built-ins in browser bundles.
  let clientExternals = [
    ...new Set(nodeBuiltins.filter(mod => !appDependencies.has(mod)))
  ];

  let serverEntryPointModule = getServerEntryPointModule(config);
  let serverExternals = nodeBuiltins.concat(Array.from(appDependencies));

  return Promise.all([
    esbuild
      .build({
        entryPoints: [
          clientEntryPoint.file,
          ...routeEntryPoints.map(entryPoint => entryPoint.file)
        ],
        outdir: config.assetsBuildDirectory,
        format: "esm",
        bundle: true,
        splitting: true,
        metafile: true,
        minify: options.mode === BuildMode.Production,
        loader: loaders,
        publicPath: config.publicPath,
        external: clientExternals,
        inject: [reactShim],
        incremental,
        define: {
          "process.env.NODE_ENV": JSON.stringify(options.mode)
        }
      })
      .then(async clientBuild => {
        let assetsManifest = createAssetsManifest(
          config,
          clientEntryPoint,
          routeEntryPoints,
          clientBuild.metafile!
        );

        let manifestFilename = `manifest-${assetsManifest.version}.js`;
        assetsManifest.url = config.publicPath + manifestFilename;
        await writeFileSafe(
          path.join(config.assetsBuildDirectory, manifestFilename),
          `window.__remixManifest=${JSON.stringify(assetsManifest)}`
        );
        await writeFileSafe(
          path.join(config.serverBuildDirectory, "assets.json"),
          JSON.stringify(assetsManifest, null, 2)
        );

        return clientBuild;
      }),
    esbuild.build({
      stdin: {
        contents: serverEntryPointModule,
        resolveDir: "/",
        sourcefile: "index.js"
      },
      outfile: path.resolve(config.serverBuildDirectory, "index.js"),
      format: "cjs",
      platform: "node",
      target: options.target,
      loader: loaders,
      publicPath: config.publicPath,
      external: serverExternals,
      inject: [reactShim],
      bundle: true,
      incremental,
      plugins: [
        {
          name: "ignore-assets-json",
          setup(build) {
            build.onResolve({ filter: /assets\.json$/ }, args => {
              return { path: args.path, external: true };
            });
          }
        }
      ]
    })
  ]);
}

async function getPackageDependencies(
  packageJsonFile: string
): Promise<string[]> {
  return Object.keys((await readPackageJson(packageJsonFile)).dependencies);
}

interface ClientEntryPoint {
  file: string;
  contents: string;
}

interface RouteEntryPoint extends ClientEntryPoint {
  route: any;
  sourceExports: string[];
}

function getClientEntryPoint(
  config: RemixConfig,
  dir: string
): ClientEntryPoint {
  return {
    file: path.resolve(dir, "entry.client.mjs"),
    contents: createProxyModule(config.entryClientFile)
  };
}

const validClientRouteExports = [
  "ErrorBoundary",
  "default",
  "handle",
  "links",
  "meta"
];

function getRouteEntryPoints(
  config: RemixConfig,
  tmpdir: string,
  exports: RouteExports
): RouteEntryPoint[] {
  return Object.keys(config.routeManifest).map(key => {
    let route = config.routeManifest[key];
    let sourceExports = exports.get(route.moduleFile);

    invariant(
      sourceExports,
      `Cannot find source exports for route ${route.id}`
    );

    return getRouteEntryPoint(
      config.appDirectory,
      tmpdir,
      route,
      sourceExports
    );
  });
}

function getRouteEntryPoint(
  appDirectory: string,
  tmpdir: string,
  route: RemixConfig["routeManifest"][string],
  sourceExports: string[]
): RouteEntryPoint {
  let file = path.resolve(tmpdir, `${route.moduleFile}.mjs`);
  let clientExports = sourceExports.filter(symbol =>
    validClientRouteExports.includes(symbol)
  );
  let contents = createProxyModule(
    path.resolve(appDirectory, route.moduleFile),
    clientExports.join(", ")
  );

  return { file, contents, route, sourceExports };
}

function createProxyModule(file: string, symbols = "*") {
  let specifiers = symbols === "*" ? "*" : `{ ${symbols} }`;
  return `export ${specifiers} from ${JSON.stringify(file)}`;
}

function getServerEntryPointModule(config: RemixConfig): string {
  return `
import * as entryServer from ${JSON.stringify(config.entryServerFile)};
${Object.keys(config.routeManifest)
  .map((key, index) => {
    return `import * as route${index} from ${JSON.stringify(
      path.join(config.appDirectory, config.routeManifest[key].moduleFile)
    )};`;
  })
  .join("\n")}
export { default as assets } from "./assets.json";
export const entry = { module: entryServer };
export const routes = {
  ${Object.keys(config.routeManifest)
    .map((key, index) => {
      let route = config.routeManifest[key];
      return `${JSON.stringify(key)}: {
  id: ${JSON.stringify(route.id)},
  parentId: ${JSON.stringify(route.parentId)},
  path: ${JSON.stringify(route.path)},
  caseSensitive: ${JSON.stringify(route.caseSensitive)},
  module: route${index}
}`;
    })
    .join(",\n  ")}
};
  `;
}

function createUrl(publicPath: string, file: string): string {
  return publicPath + file.split(path.win32.sep).join("/");
}

////////////////////////////////////////////////////////////////////////////////

interface AssetsManifest {
  version: string;
  url?: string;
  entry: {
    module: string;
    imports: string[];
  };
  routes: {
    [routeId: string]: {
      id: string;
      parentId?: string;
      path: string;
      caseSensitive?: boolean;
      module: string;
      imports?: string[];
      hasAction?: boolean;
      hasLoader?: boolean;
    };
  };
}

function createAssetsManifest(
  config: RemixConfig,
  clientEntryPoint: ClientEntryPoint,
  routeEntryPoints: RouteEntryPoint[],
  metafile: esbuild.Metafile
): AssetsManifest {
  function resolveUrl(outputPath: string): string {
    return createUrl(
      config.publicPath,
      path.relative(config.assetsBuildDirectory, path.resolve(outputPath))
    );
  }

  function resolveImports(
    imports: esbuild.Metafile["outputs"][string]["imports"]
  ): string[] {
    return imports
      .filter(im => im.kind === "import-statement")
      .map(im => resolveUrl(im.path));
  }

  let entry: AssetsManifest["entry"] | undefined;
  let routes: AssetsManifest["routes"] = {};

  for (let key of Object.keys(metafile.outputs).sort()) {
    let output = metafile.outputs[key];

    if (!output.entryPoint) continue;

    let entryPoint = path.resolve(output.entryPoint);

    if (clientEntryPoint.file === entryPoint) {
      entry = {
        module: resolveUrl(key),
        imports: resolveImports(output.imports)
      };
    } else {
      let routeEntryPoint = routeEntryPoints.find(ep => ep.file === entryPoint);

      if (routeEntryPoint) {
        let { route, sourceExports } = routeEntryPoint;

        routes[route.id] = {
          id: route.id,
          parentId: route.parentId,
          path: route.path,
          caseSensitive: route.caseSensitive,
          module: resolveUrl(key),
          imports: resolveImports(output.imports),
          hasAction: sourceExports.includes("action"),
          hasLoader: sourceExports.includes("loader")
        };
      }
    }
  }

  invariant(entry, `Missing output for entry point`);

  optimizeRoutes(routes, entry.imports);

  let version = getHash(JSON.stringify({ entry, routes })).slice(0, 8);

  return { version, entry, routes };
}

type ImportsCache = { [routeId: string]: string[] };

function optimizeRoutes(
  routes: AssetsManifest["routes"],
  entryImports: string[]
): void {
  // This cache is an optimization that allows us to avoid pruning the same
  // route's imports more than once.
  let importsCache: ImportsCache = Object.create(null);

  for (let key in routes) {
    optimizeRouteImports(key, routes, entryImports, importsCache);
  }
}

function optimizeRouteImports(
  routeId: string,
  routes: AssetsManifest["routes"],
  parentImports: string[],
  importsCache: ImportsCache
): string[] {
  if (importsCache[routeId]) return importsCache[routeId];

  let route = routes[routeId];

  if (route.parentId) {
    parentImports = parentImports.concat(
      optimizeRouteImports(route.parentId, routes, parentImports, importsCache)
    );
  }

  let routeImports = (route.imports || []).filter(
    url => !parentImports.includes(url)
  );

  // Setting `route.imports = undefined` prevents `imports: []` from showing up
  // in the manifest JSON when there are no imports.
  route.imports = routeImports.length > 0 ? routeImports : undefined;

  // Cache so the next lookup for this route is faster.
  importsCache[routeId] = routeImports;

  return routeImports;
}
