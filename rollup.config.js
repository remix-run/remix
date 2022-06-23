import path from "path";
import babel from "@rollup/plugin-babel";
import nodeResolve from "@rollup/plugin-node-resolve";
import copy from "rollup-plugin-copy";
import fse from "fs-extra";
import fs from "fs";
import camelCase from "lodash/camelCase";

const executableBanner = "#!/usr/bin/env node\n";

let activeOutputDir = "build";

if (process.env.REMIX_LOCAL_DEV_OUTPUT_DIRECTORY) {
  let appDir = path.join(
    process.cwd(),
    process.env.REMIX_LOCAL_DEV_OUTPUT_DIRECTORY
  );
  try {
    fse.readdirSync(path.join(appDir, "node_modules"));
  } catch (e) {
    console.error(
      "Oops! You pointed REMIX_LOCAL_DEV_OUTPUT_DIRECTORY to a directory that " +
        "does not have a node_modules/ folder. Please `npm install` in that " +
        "directory and try again."
    );
    process.exit(1);
  }
  console.log("Writing rollup output to", appDir);
  activeOutputDir = appDir;
}

function getOutputDir(pkg) {
  return path.join(activeOutputDir, "node_modules", pkg);
}

function createBanner(packageName, version) {
  return `/**
 * ${packageName} v${version}
 *
 * Copyright (c) Remix Software Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.md file in the root directory of this source tree.
 *
 * @license MIT
 */`;
}

function getVersion(packageDir) {
  return require(`./${packageDir}/package.json`).version;
}

function isBareModuleId(id) {
  return !id.startsWith(".") && !path.isAbsolute(id);
}

/** @returns {import("rollup").RollupOptions[]} */
function createRemix() {
  let sourceDir = "packages/create-remix";
  let outputDir = getOutputDir("create-remix");
  let outputDist = path.join(outputDir, "dist");
  let version = getVersion(sourceDir);

  return [
    {
      external() {
        return true;
      },
      input: `${sourceDir}/cli.ts`,
      output: {
        format: "cjs",
        dir: outputDist,
        banner: executableBanner + createBanner("create-remix", version),
      },
      plugins: [
        babel({
          babelHelpers: "bundled",
          exclude: /node_modules/,
          extensions: [".ts"],
        }),
        nodeResolve({ extensions: [".ts"] }),
        copy({
          targets: [
            { src: `LICENSE.md`, dest: [outputDir, sourceDir] },
            { src: `${sourceDir}/package.json`, dest: outputDir },
            { src: `${sourceDir}/README.md`, dest: outputDir },
          ],
        }),
        copyToPlaygrounds(),
      ],
    },
  ];
}

/** @returns {import("rollup").RollupOptions[]} */
function remix() {
  let sourceDir = "packages/remix";
  let outputDir = getOutputDir("remix");
  let outputDist = path.join(outputDir, "dist");
  let version = getVersion(sourceDir);

  return [
    {
      external() {
        return true;
      },
      input: `${sourceDir}/index.ts`,
      output: {
        format: "cjs",
        dir: outputDist,
        banner: createBanner("remix", version),
      },
      plugins: [
        babel({
          babelHelpers: "bundled",
          exclude: /node_modules/,
          extensions: [".ts"],
        }),
        copy({
          targets: [
            { src: `LICENSE.md`, dest: [outputDir, sourceDir] },
            { src: `${sourceDir}/package.json`, dest: outputDir },
            { src: `${sourceDir}/README.md`, dest: outputDir },
          ],
        }),
        copyToPlaygrounds(),
      ],
    },
    {
      external() {
        return true;
      },
      input: `${sourceDir}/index.ts`,
      output: {
        banner: createBanner("remix", version),
        dir: `${outputDist}/esm`,
        format: "esm",
      },
      plugins: [
        babel({
          babelHelpers: "bundled",
          exclude: /node_modules/,
          extensions: [".ts"],
        }),
        copyToPlaygrounds(),
      ],
    },
  ];
}

/** @returns {import("rollup").RollupOptions[]} */
function remixDev() {
  let sourceDir = "packages/remix-dev";
  let outputDir = getOutputDir("@remix-run/dev");
  let outputDist = path.join(outputDir, "dist");
  let version = getVersion(sourceDir);

  return [
    {
      external(id, parent) {
        if (
          id === "../package.json" &&
          parent === path.resolve(__dirname, "packages/remix-dev/cli/create.ts")
        ) {
          return true;
        }

        return isBareModuleId(id);
      },
      input: `${sourceDir}/index.ts`,
      output: {
        banner: createBanner("@remix-run/dev", version),
        dir: outputDist,
        format: "cjs",
        preserveModules: true,
        exports: "named",
      },
      plugins: [
        babel({
          babelHelpers: "bundled",
          exclude: /node_modules/,
          extensions: [".ts"],
        }),
        nodeResolve({ extensions: [".ts"] }),
        copy({
          targets: [
            { src: `LICENSE.md`, dest: [outputDir, sourceDir] },
            { src: `${sourceDir}/package.json`, dest: [outputDir, outputDist] },
            { src: `${sourceDir}/README.md`, dest: outputDir },
            {
              src: `${sourceDir}/compiler/shims`,
              dest: [`${outputDir}/compiler`, `${outputDist}/compiler`],
            },
          ],
        }),
        // Allow dynamic imports in CJS code to allow us to utilize
        // ESM modules as part of the compiler.
        {
          name: "dynamic-import-polyfill",
          renderDynamicImport() {
            return {
              left: "import(",
              right: ")",
            };
          },
        },
        copyToPlaygrounds(),
      ],
    },
    {
      external() {
        return true;
      },
      input: `${sourceDir}/cli.ts`,
      output: {
        banner: executableBanner + createBanner("@remix-run/dev", version),
        dir: outputDist,
        format: "cjs",
      },
      plugins: [
        babel({
          babelHelpers: "bundled",
          exclude: /node_modules/,
          extensions: [".ts"],
        }),
        nodeResolve({ extensions: [".ts"] }),
        copyToPlaygrounds(),
      ],
    },
    {
      external: (id) => isBareModuleId(id),
      input: [`${sourceDir}/cli/migrate/migrations/transforms.ts`],
      output: {
        banner: createBanner("@remix-run/dev", version),
        dir: `${outputDist}/cli/migrate/migrations`,
        exports: "named",
        format: "cjs",
        preserveModules: true,
      },
      plugins: [
        babel({
          babelHelpers: "bundled",
          exclude: /node_modules/,
          extensions: [".ts"],
        }),
        nodeResolve({ extensions: [".ts"] }),
        copyToPlaygrounds(),
      ],
    },
    {
      external() {
        return true;
      },
      input: `${sourceDir}/server-build.ts`,
      output: {
        banner: executableBanner + createBanner("@remix-run/dev", version),
        dir: outputDist,
        format: "cjs",
      },
      plugins: [
        babel({
          babelHelpers: "bundled",
          exclude: /node_modules/,
          extensions: [".ts"],
        }),
        nodeResolve({ extensions: [".ts"] }),
        copyToPlaygrounds(),
      ],
    },
  ];
}

/** @returns {import("rollup").RollupOptions[]} */
function remixServerRuntime() {
  let packageName = "@remix-run/server-runtime";
  let sourceDir = "packages/remix-server-runtime";
  let outputDir = getOutputDir(packageName);
  let outputDist = path.join(outputDir, "dist");
  let version = getVersion(sourceDir);

  return [
    {
      external(id) {
        return isBareModuleId(id);
      },
      input: `${sourceDir}/index.ts`,
      output: {
        banner: createBanner(packageName, version),
        dir: outputDist,
        format: "cjs",
        preserveModules: true,
        exports: "named",
      },
      plugins: [
        babel({
          babelHelpers: "bundled",
          exclude: /node_modules/,
          extensions: [".ts", ".tsx"],
        }),
        nodeResolve({ extensions: [".ts", ".tsx"] }),
        copy({
          targets: [
            { src: "LICENSE.md", dest: [outputDir, sourceDir] },
            { src: `${sourceDir}/package.json`, dest: outputDir },
            { src: `${sourceDir}/README.md`, dest: outputDir },
          ],
        }),
        magicExportsPlugin(getMagicExports(packageName), {
          packageName,
          version,
        }),
        copyToPlaygrounds(),
      ],
    },
    {
      external(id) {
        return isBareModuleId(id);
      },
      input: `${sourceDir}/index.ts`,
      output: {
        banner: createBanner(packageName, version),
        dir: `${outputDist}/esm`,
        format: "esm",
        preserveModules: true,
      },
      plugins: [
        babel({
          babelHelpers: "bundled",
          exclude: /node_modules/,
          extensions: [".ts", ".tsx"],
        }),
        nodeResolve({ extensions: [".ts", ".tsx"] }),
        copyToPlaygrounds(),
      ],
    },
  ];
}

/** @returns {import("rollup").RollupOptions[]} */
function remixNode() {
  let packageName = "@remix-run/node";
  let sourceDir = "packages/remix-node";
  let outputDir = getOutputDir(packageName);
  let outputDist = path.join(outputDir, "dist");
  let version = getVersion(sourceDir);

  return [
    {
      external(id) {
        return isBareModuleId(id);
      },
      input: `${sourceDir}/index.ts`,
      output: {
        banner: createBanner(packageName, version),
        dir: outputDist,
        format: "cjs",
        preserveModules: true,
        exports: "named",
      },
      plugins: [
        babel({
          babelHelpers: "bundled",
          exclude: /node_modules/,
          extensions: [".ts", ".tsx"],
        }),
        nodeResolve({ extensions: [".ts", ".tsx"] }),
        copy({
          targets: [
            { src: "LICENSE.md", dest: [outputDir, sourceDir] },
            { src: `${sourceDir}/package.json`, dest: outputDir },
            { src: `${sourceDir}/README.md`, dest: outputDir },
          ],
        }),
        magicExportsPlugin(getMagicExports(packageName), {
          packageName,
          version,
        }),
        copyToPlaygrounds(),
      ],
    },
  ];
}

/** @returns {import("rollup").RollupOptions[]} */
function remixCloudflare() {
  let packageName = "@remix-run/cloudflare";
  let sourceDir = "packages/remix-cloudflare";
  let outputDir = getOutputDir(packageName);
  let outputDist = path.join(outputDir, "dist");
  let version = getVersion(sourceDir);

  return [
    {
      external(id) {
        return isBareModuleId(id);
      },
      input: `${sourceDir}/index.ts`,
      output: {
        banner: createBanner(packageName, version),
        dir: outputDist,
        format: "cjs",
        preserveModules: true,
        exports: "named",
      },
      plugins: [
        babel({
          babelHelpers: "bundled",
          exclude: /node_modules/,
          extensions: [".ts", ".tsx"],
        }),
        nodeResolve({ extensions: [".ts", ".tsx"] }),
        copy({
          targets: [
            { src: "LICENSE.md", dest: [outputDir, sourceDir] },
            { src: `${sourceDir}/package.json`, dest: outputDir },
            { src: `${sourceDir}/README.md`, dest: outputDir },
          ],
        }),
        magicExportsPlugin(getMagicExports(packageName), {
          packageName,
          version,
        }),
        copyToPlaygrounds(),
      ],
    },
  ];
}

/** @returns {import("rollup").RollupOptions[]} */
function remixDeno() {
  let sourceDir = "packages/remix-deno";
  let outputDir = getOutputDir("@remix-run/deno");

  return [
    {
      input: `${sourceDir}/.empty.js`,
      plugins: [
        copy({
          targets: [
            { src: "LICENSE.md", dest: [outputDir, sourceDir] },
            { src: `${sourceDir}/**/*`, dest: outputDir },
          ],
          gitignore: true,
        }),
        copyToPlaygrounds(),
      ],
    },
  ];
}

/** @returns {import("rollup").RollupOptions[]} */
function remixCloudflareWorkers() {
  let sourceDir = "packages/remix-cloudflare-workers";
  let outputDir = getOutputDir("@remix-run/cloudflare-workers");
  let outputDist = path.join(outputDir, "dist");
  let version = getVersion(sourceDir);

  return [
    {
      external(id) {
        return isBareModuleId(id);
      },
      input: `${sourceDir}/index.ts`,
      output: {
        banner: createBanner("@remix-run/cloudflare-workers", version),
        dir: `${outputDist}/esm`,
        format: "esm",
        preserveModules: true,
      },
      plugins: [
        babel({
          babelHelpers: "bundled",
          exclude: /node_modules/,
          extensions: [".ts", ".tsx"],
        }),
        nodeResolve({ extensions: [".ts", ".tsx"] }),
        copyToPlaygrounds(),
      ],
    },
  ];
}

/** @returns {import("rollup").RollupOptions[]} */
function remixCloudflarePages() {
  let sourceDir = "packages/remix-cloudflare-pages";
  let outputDir = getOutputDir("@remix-run/cloudflare-pages");
  let outputDist = path.join(outputDir, "dist");
  let version = getVersion(sourceDir);

  return [
    {
      external(id) {
        return isBareModuleId(id);
      },
      input: `${sourceDir}/index.ts`,
      output: {
        banner: createBanner("@remix-run/cloudflare-pages", version),
        dir: `${outputDist}/esm`,
        format: "esm",
        preserveModules: true,
      },
      plugins: [
        babel({
          babelHelpers: "bundled",
          exclude: /node_modules/,
          extensions: [".ts", ".tsx"],
        }),
        nodeResolve({ extensions: [".ts", ".tsx"] }),
        copyToPlaygrounds(),
      ],
    },
  ];
}

/**
 * @param {RemixAdapter} adapterName
 * @returns {import("rollup").RollupOptions[]}
 */
function getAdapterConfig(adapterName) {
  /** @type {`@remix-run/${RemixPackage}`} */
  let packageName = `@remix-run/${adapterName}`;
  let sourceDir = `packages/remix-${adapterName}`;
  let outputDir = getOutputDir(packageName);
  let outputDist = path.join(outputDir, "dist");
  let version = getVersion(sourceDir);

  // TODO: Remove in v2
  let magicExports = getMagicExports(packageName);

  return [
    {
      external(id) {
        return isBareModuleId(id);
      },
      input: `${sourceDir}/index.ts`,
      output: {
        banner: createBanner(packageName, version),
        dir: outputDist,
        format: "cjs",
        preserveModules: true,
        exports: "auto",
      },
      plugins: [
        babel({
          babelHelpers: "bundled",
          exclude: /node_modules/,
          extensions: [".ts", ".tsx"],
        }),
        nodeResolve({ extensions: [".ts", ".tsx"] }),
        copy({
          targets: [
            { src: "LICENSE.md", dest: [outputDir, sourceDir] },
            { src: `${sourceDir}/package.json`, dest: outputDir },
            { src: `${sourceDir}/README.md`, dest: outputDir },
          ],
        }),
        magicExportsPlugin(magicExports, {
          packageName,
          version,
        }),
        copyToPlaygrounds(),
      ],
    },
  ];
}

/**
 * TODO: Remove in v2
 * @param {RemixPackage} packageName
 * @returns {MagicExports | null}
 */
function getMagicExports(packageName) {
  // Re-export everything from packages that is available in `remix`
  /** @type {Record<ScopedRemixPackage, MagicExports>} */
  let magicExportsByPackageName = {
    "@remix-run/architect": {
      values: ["createArcTableSessionStorage"],
    },
    "@remix-run/cloudflare": {
      values: [
        "createCloudflareKVSessionStorage",
        "createCookie",
        "createCookieSessionStorage",
        "createMemorySessionStorage",
        "createSessionStorage",
      ],
    },
    "@remix-run/node": {
      values: [
        "createCookie",
        "createCookieSessionStorage",
        "createFileSessionStorage",
        "createMemorySessionStorage",
        "createSessionStorage",
        "unstable_createFileUploadHandler",
        "unstable_createMemoryUploadHandler",
        "unstable_parseMultipartFormData",
      ],
      types: ["UploadHandler", "UploadHandlerPart"],
    },
    "@remix-run/react": {
      values: [
        "Form",
        "Link",
        "Links",
        "LiveReload",
        "Meta",
        "NavLink",
        "PrefetchPageLinks",
        "RemixBrowser",
        "RemixServer",
        "Scripts",
        "ScrollRestoration",
        "useActionData",
        "useBeforeUnload",
        "useCatch",
        "useFetcher",
        "useFetchers",
        "useFormAction",
        "useLoaderData",
        "useMatches",
        "useSubmit",
        "useTransition",

        // react-router-dom exports
        "Outlet",
        "useHref",
        "useLocation",
        "useNavigate",
        "useNavigationType",
        "useOutlet",
        "useOutletContext",
        "useParams",
        "useResolvedPath",
        "useSearchParams",
      ],
      types: [
        "RemixBrowserProps",
        "FormProps",
        "SubmitOptions",
        "SubmitFunction",
        "FormMethod",
        "FormEncType",
        "RemixServerProps",
        "ShouldReloadFunction",
        "ThrownResponse",
        "LinkProps",
        "NavLinkProps",
      ],
    },
    "@remix-run/server-runtime": {
      values: ["createSession", "isCookie", "isSession", "json", "redirect"],
      types: [
        "ActionFunction",
        "AppData",
        "AppLoadContext",
        "Cookie",
        "CookieOptions",
        "CookieParseOptions",
        "CookieSerializeOptions",
        "CookieSignatureOptions",
        "EntryContext",
        "ErrorBoundaryComponent",
        "HandleDataRequestFunction",
        "HandleDocumentRequestFunction",
        "HeadersFunction",
        "HtmlLinkDescriptor",
        "HtmlMetaDescriptor",
        "LinkDescriptor",
        "LinksFunction",
        "LoaderFunction",
        "MetaDescriptor",
        "MetaFunction",
        "PageLinkDescriptor",
        "RequestHandler",
        "RouteComponent",
        "RouteHandle",
        "ServerBuild",
        "ServerEntryModule",
        "Session",
        "SessionData",
        "SessionIdStorageStrategy",
        "SessionStorage",
      ],
    },
  };

  return magicExportsByPackageName[packageName] || null;
}

/**
 * TODO: Remove in v2
 * @param {MagicExports | null} magicExports
 * @param {{ packageName: ScopedRemixPackage; version: string }} buildInfo
 * @returns {import("rollup").Plugin}
 */
const magicExportsPlugin = (magicExports, { packageName, version }) => ({
  name: `${packageName}:generate-magic-exports`,
  generateBundle() {
    if (!magicExports) {
      return;
    }

    let banner = createBanner(packageName, version);
    let esmContents = banner + "\n";
    let tsContents = banner + "\n";
    let cjsContents =
      banner +
      "\n" +
      "'use strict';\n" +
      "Object.defineProperty(exports, '__esModule', { value: true });\n";

    if (magicExports.values) {
      let exportList = magicExports.values.join(", ");
      esmContents += `export { ${exportList} } from '${packageName}';\n`;
      tsContents += `export { ${exportList} } from '${packageName}';\n`;

      let cjsModule = camelCase(packageName.slice('@remix-run/'.length));
      cjsContents += `var ${cjsModule} = require('${packageName}');\n`;
      for (let symbol of magicExports.values) {
        cjsContents +=
          `Object.defineProperty(exports, '${symbol}', {\n` +
          "  enumerable: true,\n" +
          `  get: function () { return ${cjsModule}.${symbol}; }\n` +
          "});\n";
      }
    }

    if (magicExports.types) {
      let exportList = magicExports.types.join(", ");
      tsContents += `export type { ${exportList} } from '${packageName}';\n`;
    }

    this.emitFile({
      fileName: path.join("magicExports", "remix.d.ts"),
      source: tsContents,
      type: "asset",
    });
    this.emitFile({
      fileName: path.join("magicExports", "remix.js"),
      source: cjsContents,
      type: "asset",
    });
    this.emitFile({
      fileName: path.join("magicExports", "esm", "remix.js"),
      source: esmContents,
      type: "asset",
    });
  },
});

/** @returns {import("rollup").RollupOptions[]} */
function remixServerAdapters() {
  // magicExports: Re-export everything from each package that is available in `remix`
  // TODO: Remove this in v2 when we get rid of magic exports altogether
  return [
    ...getAdapterConfig("architect"),
    ...getAdapterConfig("cloudflare-pages"),
    ...getAdapterConfig("cloudflare-workers"),
    ...getAdapterConfig("express"),
    ...getAdapterConfig("netlify"),
    ...getAdapterConfig("vercel"),
  ];
}

/** @returns {import("rollup").RollupOptions[]} */
function remixReact() {
  let packageName = "@remix-run/react";
  let sourceDir = "packages/remix-react";
  let outputDir = getOutputDir(packageName);
  let outputDist = path.join(outputDir, "dist");
  let version = getVersion(sourceDir);

  // This CommonJS build of remix-react is for node; both for use in running our
  // server and for 3rd party tools that work with node.
  /** @type {import("rollup").RollupOptions} */
  let remixReactCJS = {
    external(id) {
      return isBareModuleId(id);
    },
    input: `${sourceDir}/index.tsx`,
    output: {
      banner: createBanner(packageName, version),
      dir: outputDist,
      format: "cjs",
      preserveModules: true,
      exports: "auto",
    },
    plugins: [
      babel({
        babelHelpers: "bundled",
        exclude: /node_modules/,
        extensions: [".ts", ".tsx"],
      }),
      nodeResolve({ extensions: [".ts", ".tsx"] }),
      copy({
        targets: [
          { src: "LICENSE.md", dest: [outputDir, sourceDir] },
          { src: `${sourceDir}/package.json`, dest: outputDir },
          { src: `${sourceDir}/README.md`, dest: outputDir },
        ],
      }),
      magicExportsPlugin(getMagicExports(packageName), {
        packageName,
        version,
      }),
      copyToPlaygrounds(),
    ],
  };

  // The browser build of remix-react is ESM so we can treeshake it.
  /** @type {import("rollup").RollupOptions} */
  let remixReactESM = {
    external(id) {
      return isBareModuleId(id);
    },
    input: `${sourceDir}/index.tsx`,
    output: {
      banner: createBanner("@remix-run/react", version),
      dir: `${outputDist}/esm`,
      format: "esm",
      preserveModules: true,
    },
    plugins: [
      babel({
        babelHelpers: "bundled",
        exclude: /node_modules/,
        extensions: [".ts", ".tsx"],
      }),
      nodeResolve({ extensions: [".ts", ".tsx"] }),
      copyToPlaygrounds(),
    ],
  };

  return [remixReactCJS, remixReactESM];
}

/** @returns {import("rollup").RollupOptions[]} */
function remixServe() {
  let sourceDir = "packages/remix-serve";
  let outputDir = getOutputDir("@remix-run/serve");
  let outputDist = path.join(outputDir, "dist");
  let version = getVersion(sourceDir);

  return [
    {
      external(id) {
        return isBareModuleId(id);
      },
      input: [`${sourceDir}/index.ts`, `${sourceDir}/env.ts`],
      output: {
        banner: createBanner("@remix-run/serve", version),
        dir: outputDist,
        format: "cjs",
        preserveModules: true,
        exports: "auto",
      },
      plugins: [
        babel({
          babelHelpers: "bundled",
          exclude: /node_modules/,
          extensions: [".ts", ".tsx"],
        }),
        nodeResolve({ extensions: [".ts", ".tsx"] }),
        copy({
          targets: [
            { src: "LICENSE.md", dest: [outputDir, sourceDir] },
            { src: `${sourceDir}/package.json`, dest: outputDir },
            { src: `${sourceDir}/README.md`, dest: outputDir },
          ],
        }),
        copyToPlaygrounds(),
      ],
    },
    {
      external() {
        return true;
      },
      input: `${sourceDir}/cli.ts`,
      output: {
        banner: executableBanner + createBanner("@remix-run/serve", version),
        dir: outputDist,
        format: "cjs",
      },
      plugins: [
        babel({
          babelHelpers: "bundled",
          exclude: /node_modules/,
          extensions: [".ts"],
        }),
        nodeResolve({ extensions: [".ts"] }),
        copyToPlaygrounds(),
      ],
    },
  ];
}

export default function rollup(options) {
  let builds = [
    ...createRemix(options),
    // Do not blow away destination app node_modules/remix directory which is
    // correct for that deploy target setup
    ...(activeOutputDir === "build" ? remix(options) : []),
    ...remixDev(options),
    ...remixServerRuntime(options),
    ...remixNode(options),
    ...remixCloudflare(options),
    ...remixDeno(options),
    ...remixCloudflarePages(options),
    ...remixCloudflareWorkers(options),
    ...remixServerAdapters(options),
    ...remixReact(options),
    ...remixServe(options),
  ];

  return builds;
}

async function triggerLiveReload(appDir) {
  // Tickle live reload by touching the server entry
  // Consider all of entry.server.{tsx,ts,jsx,js} since React may be used
  // via `React.createElement` without the need for JSX.
  let serverEntryPaths = [
    "entry.server.ts",
    "entry.server.tsx",
    "entry.server.js",
    "entry.server.jsx",
  ];
  let serverEntryPath = serverEntryPaths
    .map((entryFile) => path.join(appDir, "app", entryFile))
    .find((entryPath) => fse.existsSync(entryPath));
  let date = new Date();
  await fs.promises.utimes(serverEntryPath, date, date);
}

function copyToPlaygrounds() {
  return {
    name: "copy-to-remix-playground",
    async writeBundle(options, bundle) {
      if (activeOutputDir === "build") {
        let playgroundsDir = path.join(__dirname, "playground");
        let playgrounds = await fs.promises.readdir(playgroundsDir);
        let writtenDir = path.join(__dirname, options.dir);
        for (let playground of playgrounds) {
          let playgroundDir = path.join(playgroundsDir, playground);
          if (!fse.statSync(playgroundDir).isDirectory()) {
            continue;
          }
          let destDir = writtenDir.replace(
            path.join(__dirname, "build"),
            playgroundDir
          );
          await fse.copy(writtenDir, destDir);
          await triggerLiveReload(playgroundDir);
        }
      } else {
        // If we're not building to "build" then trigger live reload on our
        // external "playground" app
        await triggerLiveReload(activeOutputDir);
      }
    },
  };
}

/**
 * @typedef {Record<"values" | "types", string[]>} MagicExports
 * @typedef {"architect" | "cloudflare-pages" | "cloudflare-workers" | "express" | "netlify" | "vercel"} RemixAdapter
 * @typedef {"cloudflare" | "node" | "deno"} RemixRuntime
 * @typedef {`@remix-run/${RemixAdapter | RemixRuntime | "dev" | "eslint-config" | "react" | "serve" | "server-runtime"}`} ScopedRemixPackage
 * @typedef {"create-remix" | "remix" | ScopedRemixPackage} RemixPackage
 */
