import { builtinModules as nodeBuiltins } from "module";
import * as esbuild from "esbuild";
import * as path from "path";
// @ts-expect-error
import readPackageJson from "read-package-json-fast";

import { BuildMode, BuildTarget } from "./build";
import type { RemixConfig } from "./config";
import { getHash } from "./utils/crypto";
import { writeFileSafe, createTemporaryDirectory } from "./utils/fs";
import virtualJsonPlugin from "./compiler2/virtualJsonPlugin";
import invariant from "./invariant";

// When we build Remix, this shim file is copied directly into the output
// directory in the same place relative to this file. It is eventually injected
// as a source file when building the app.
const reactShim = path.resolve(__dirname, "compiler2/shims/react.ts");

/*
Stuff to do still:
- make a decision about mdx
- get url: imports working
- hash route modules for production
- support for css:
- watch mode for dev
*/

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
  // Generate a prebuild so we can know the route exports. This is similar to
  // the actual server build we generate later, except the format is ESM so we
  // can get the route's exports from the metafile. If we ever end up building
  // apps to run as ESM on node, we may actually use this build.
  let preResult = await esbuild.build({
    entryPoints: Object.keys(config.routeManifest).map(key =>
      path.join(config.appDirectory, config.routeManifest[key].moduleFile)
    ),
    platform: "node",
    target: target,
    format: "esm",
    bundle: true,
    metafile: true,
    outdir: ".",
    write: false
  });

  let tmpdir = await createTemporaryDirectory(path.resolve("pre-build"));
  let clientEntryPoint = await getClientEntryPoint(config, tmpdir);
  let routeEntryPoints = await getRouteEntryPoints(
    config,
    tmpdir,
    preResult.metafile!
  );

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

  console.log("#### RUNNING THE CLIENT BUILD ####");

  let clientResult = await esbuild.build({
    entryPoints: [
      clientEntryPoint.file,
      ...routeEntryPoints.map(entryPoint => entryPoint.file)
    ],
    outdir: config.assetsBuildDirectory,
    format: "esm",
    bundle: true,
    splitting: true,
    metafile: true,
    minify: mode === BuildMode.Production,
    external: clientExternals,
    inject: [reactShim],
    define: {
      "process.env.NODE_ENV": JSON.stringify(mode)
    }
  });

  console.log("#### CREATING THE ASSET MANIFEST ####");

  let assetsManifest = createAssetsManifest(
    config,
    clientEntryPoint,
    routeEntryPoints,
    clientResult.metafile!
  );

  let manifestFilename = `manifest-${assetsManifest.version}.js`;
  assetsManifest.url = config.publicPath + manifestFilename;
  await writeFileSafe(
    path.join(config.assetsBuildDirectory, manifestFilename),
    `window.__remixManifest=${JSON.stringify(assetsManifest)}`
  );

  console.log("#### RUNNING THE SERVER BUILD ####");

  let serverEntryPointModule = getServerEntryPointModule(config);
  let serverExternals = nodeBuiltins.concat(Array.from(appDependencies));

  await esbuild.build({
    // TODO: Figure out how to get it into ./build instead of ./build/app
    stdin: {
      contents: serverEntryPointModule,
      resolveDir: config.appDirectory,
      sourcefile: "index.js"
    },
    outfile: path.resolve(config.serverBuildDirectory, "index.js"),
    format: "cjs",
    platform: "node",
    target: target,
    external: serverExternals,
    inject: [reactShim],
    bundle: true,
    plugins: [virtualJsonPlugin(assetsManifestVirtualModuleId, assetsManifest)]
  });
}

///////////////////////////////////////////////////////////////////////////////

const assetsManifestVirtualModuleId = "__ASSETS_MANIFEST__";

async function getPackageDependencies(
  packageJsonFile: string
): Promise<string[]> {
  return Object.keys((await readPackageJson(packageJsonFile)).dependencies);
}

interface ClientEntryPoint {
  file: string;
  module: string;
}

interface RouteEntryPoint extends ClientEntryPoint {
  routeId: string;
  sourceExports: string[];
}

async function getClientEntryPoint(
  config: RemixConfig,
  tmpdir: string
): Promise<ClientEntryPoint> {
  let file = path.join(tmpdir, "entry.client.mjs");
  let proxyModule = createProxyModule(config.entryClientFile);
  await writeFileSafe(file, proxyModule);
  return { file, module: proxyModule };
}

const validClientRouteExports = [
  "ErrorBoundary",
  "default",
  "handle",
  "links",
  "meta"
];

async function getRouteEntryPoints(
  config: RemixConfig,
  tmpdir: string,
  metafile: esbuild.Metafile
): Promise<RouteEntryPoint[]> {
  let entryPoints: RouteEntryPoint[] = [];

  await Promise.all(
    Object.keys(config.routeManifest).map(async key => {
      let route = config.routeManifest[key];
      let file = path.join(tmpdir, key) + ".mjs";

      let metafilePath = route.moduleFile.replace(/(\.\w+)?$/, ".js");
      let metafileOutput = metafile.outputs[metafilePath];
      let sourceExports = metafileOutput.exports;
      let clientExports = sourceExports.filter(symbol =>
        validClientRouteExports.includes(symbol)
      );
      let proxyModule = createProxyModule(
        path.join(config.appDirectory, route.moduleFile),
        clientExports.join(", ")
      );

      await writeFileSafe(file, proxyModule);

      entryPoints.push({
        file,
        module: proxyModule,
        routeId: key,
        sourceExports
      });
    })
  );

  return entryPoints;
}

function createProxyModule(file: string, symbols = "*") {
  let specifiers = symbols === "*" ? "*" : `{ ${symbols} }`;
  return `export ${specifiers} from ${JSON.stringify(file)}`;
}

/*
/path/to/app/entry.server.tsx
/path/to/app/routes/index.tsx
__ASSETS_MANIFEST__

resolveDir: /path/to/app
*/

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
export const version = "not really";
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
export { default as assets } from ${JSON.stringify(
    assetsManifestVirtualModuleId
  )};
  `;
}

function createUrl(publicPath: string, file: string): string {
  return publicPath + file.split(path.win32.sep).join("/");
}

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
        let { routeId, sourceExports } = routeEntryPoint;
        let route = config.routeManifest[routeId];

        routes[routeId] = {
          id: routeId,
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
