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
  let version = getVersion(sourceDir);

  return [
    {
      external() {
        return true;
      },
      input: `${sourceDir}/cli.ts`,
      output: {
        format: "cjs",
        dir: outputDir,
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
            { src: `LICENSE.md`, dest: outputDir },
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
  let version = getVersion(sourceDir);

  return [
    {
      external() {
        return true;
      },
      input: `${sourceDir}/index.ts`,
      output: {
        format: "cjs",
        dir: outputDir,
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
            { src: `LICENSE.md`, dest: outputDir },
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
        dir: `${outputDir}/esm`,
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
        dir: outputDir,
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
            { src: `LICENSE.md`, dest: outputDir },
            { src: `${sourceDir}/package.json`, dest: outputDir },
            { src: `${sourceDir}/README.md`, dest: outputDir },
            {
              src: `${sourceDir}/compiler/shims`,
              dest: `${outputDir}/compiler`,
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
        dir: outputDir,
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
        dir: `${outputDir}/cli/migrate/migrations`,
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
        dir: outputDir,
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
  let version = getVersion(sourceDir);

  return [
    {
      external(id) {
        return isBareModuleId(id);
      },
      input: `${sourceDir}/index.ts`,
      output: {
        banner: createBanner(packageName, version),
        dir: outputDir,
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
            { src: `LICENSE.md`, dest: outputDir },
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
        dir: `${outputDir}/esm`,
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
  let version = getVersion(sourceDir);

  return [
    {
      external(id) {
        return isBareModuleId(id);
      },
      input: `${sourceDir}/index.ts`,
      output: {
        banner: createBanner(packageName, version),
        dir: outputDir,
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
            { src: `LICENSE.md`, dest: outputDir },
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
  let version = getVersion(sourceDir);

  return [
    {
      external(id) {
        return isBareModuleId(id);
      },
      input: `${sourceDir}/index.ts`,
      output: {
        banner: createBanner(packageName, version),
        dir: outputDir,
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
            { src: `LICENSE.md`, dest: outputDir },
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
            { src: `LICENSE.md`, dest: outputDir },
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
  let version = getVersion(sourceDir);

  return [
    {
      external(id) {
        return isBareModuleId(id);
      },
      input: `${sourceDir}/index.ts`,
      output: {
        banner: createBanner("@remix-run/cloudflare-workers", version),
        dir: `${outputDir}/esm`,
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
  let version = getVersion(sourceDir);

  return [
    {
      external(id) {
        return isBareModuleId(id);
      },
      input: `${sourceDir}/index.ts`,
      output: {
        banner: createBanner("@remix-run/cloudflare-pages", version),
        dir: `${outputDir}/esm`,
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
        dir: outputDir,
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
            { src: `LICENSE.md`, dest: outputDir },
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
  switch (packageName) {
    case "@remix-run/architect":
      return {
        values: {
          "@remix-run/architect": ["createArcTableSessionStorage"],
        },
      };
    case "@remix-run/cloudflare-pages":
      return {
        values: {
          "@remix-run/cloudflare": ["createCloudflareKVSessionStorage"],
        },
      };
    case "@remix-run/cloudflare-workers":
      return {
        values: {
          "@remix-run/cloudflare": ["createCloudflareKVSessionStorage"],
        },
      };
    case "@remix-run/cloudflare":
      return {
        values: {
          "@remix-run/cloudflare": [
            "createCloudflareKVSessionStorage",
            "createCookie",
            "createSessionStorage",
            "createCookieSessionStorage",
            "createMemorySessionStorage",
          ],
        },
      };
    case "@remix-run/node":
      return {
        values: {
          "@remix-run/node": [
            "createCookie",
            "createSessionStorage",
            "createCookieSessionStorage",
            "createMemorySessionStorage",
            "createFileSessionStorage",
            "unstable_createFileUploadHandler",
            "unstable_createMemoryUploadHandler",
            "unstable_parseMultipartFormData",
          ],
        },
        types: {
          "@remix-run/node": ["UploadHandler", "UploadHandlerPart"],
        },
      };
    case "@remix-run/react":
      return {
        values: {
          "@remix-run/react": [
            "RemixBrowser",
            "Meta",
            "Links",
            "Scripts",
            "Link",
            "NavLink",
            "Form",
            "PrefetchPageLinks",
            "ScrollRestoration",
            "LiveReload",
            "useFormAction",
            "useSubmit",
            "useTransition",
            "useFetcher",
            "useFetchers",
            "useCatch",
            "useLoaderData",
            "useActionData",
            "useBeforeUnload",
            "useMatches",
            "RemixServer",

            // react-router-dom exports
            "Outlet",
            "useHref",
            "useLocation",
            "useNavigate",
            "useNavigationType",
            "useOutlet",
            "useParams",
            "useResolvedPath",
            "useSearchParams",
            "useOutletContext",
          ],
        },
        types: {
          "@remix-run/react": [
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
      };
    case "@remix-run/server-runtime":
      return {
        values: {
          "@remix-run/server-runtime": [
            "isCookie",
            "createSession",
            "isSession",
            "json",
            "redirect",
          ],
        },
        types: {
          "@remix-run/server-runtime": [
            "ServerBuild",
            "ServerEntryModule",
            "HandleDataRequestFunction",
            "HandleDocumentRequestFunction",
            "CookieParseOptions",
            "CookieSerializeOptions",
            "CookieSignatureOptions",
            "CookieOptions",
            "Cookie",
            "AppLoadContext",
            "AppData",
            "EntryContext",
            "LinkDescriptor",
            "HtmlLinkDescriptor",
            "PageLinkDescriptor",
            "ErrorBoundaryComponent",
            "ActionFunction",
            "HeadersFunction",
            "LinksFunction",
            "LoaderFunction",
            "MetaDescriptor",
            "HtmlMetaDescriptor",
            "MetaFunction",
            "RouteComponent",
            "RouteHandle",
            "RequestHandler",
            "SessionData",
            "Session",
            "SessionStorage",
            "SessionIdStorageStrategy",
          ],
        },
      };
    default:
      return null;
  }
}

/**
 * TODO: Remove in v2
 * @param {MagicExports | null} magicExports
 * @param {{ packageName: string; version: string }} buildInfo
 * @returns {import("rollup").Plugin}
 */
function magicExportsPlugin(magicExports, { packageName, version }) {
  return {
    name: `${packageName}:generate-magic-exports`,
    generateBundle() {
      if (!magicExports) return;

      let tsContents = "";
      let cjsContents = "";
      let esmContents = "";
      let banner = createBanner(packageName, version);

      if (magicExports.values) {
        for (let pkgName of Object.keys(magicExports.values)) {
          if (!esmContents) esmContents = banner + "\n";
          if (!tsContents) tsContents = banner + "\n";
          if (!cjsContents) {
            cjsContents =
              banner +
              "\n" +
              "'use strict';\n" +
              "Object.defineProperty(exports, '__esModule', { value: true });\n";
          }

          let exportList = magicExports.values[pkgName].join(", ");
          esmContents += `export { ${exportList} } from '${pkgName}';\n`;
          tsContents += `export { ${exportList} } from '${pkgName}';\n`;

          let cjsModule = camelCase(
            pkgName.startsWith("@remix-run/") ? pkgName.slice(11) : pkgName
          );
          cjsContents += `var ${cjsModule} = require('${pkgName}');\n`;
          for (let symbol of magicExports.values[pkgName]) {
            cjsContents +=
              `Object.defineProperty(exports, '${symbol}', {\n` +
              "  enumerable: true,\n" +
              `  get: function () { return ${cjsModule}.${symbol}; }\n` +
              "});\n";
          }
        }
      }

      if (magicExports.types) {
        for (let pkgName of Object.keys(magicExports.types)) {
          if (!tsContents) tsContents = banner + "\n";
          let exportList = magicExports.types[pkgName].join(", ");
          tsContents += `export type { ${exportList} } from '${pkgName}';\n`;
        }
      }

      tsContents &&
        this.emitFile({
          type: "asset",
          fileName: path.join("magicExports", "remix.d.ts"),
          source: tsContents,
        });

      cjsContents &&
        this.emitFile({
          type: "asset",
          fileName: path.join("magicExports", "remix.js"),
          source: cjsContents,
        });

      esmContents &&
        this.emitFile({
          type: "asset",
          fileName: path.join("magicExports", "esm", "remix.js"),
          source: esmContents,
        });
    },
  };
}

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
      dir: outputDir,
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
          { src: `LICENSE.md`, dest: outputDir },
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
      dir: `${outputDir}/esm`,
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
  let version = getVersion(sourceDir);

  return [
    {
      external(id) {
        return isBareModuleId(id);
      },
      input: [`${sourceDir}/index.ts`, `${sourceDir}/env.ts`],
      output: {
        banner: createBanner("@remix-run/serve", version),
        dir: outputDir,
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
            { src: `LICENSE.md`, dest: outputDir },
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
        dir: outputDir,
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
 * @typedef {Record<"values" | "types", Record<string, string[]>>} MagicExports
 * @typedef {"architect" | "cloudflare-pages" | "cloudflare-workers" | "express" | "netlify" | "vercel"} RemixAdapter
 * @typedef {"cloudflare" | "node" | "deno"} RemixRuntime
 * @typedef {`@remix-run/${RemixAdapter | RemixRuntime | "dev" | "eslint-config" | "react" | "serve" | "server-runtime"}`} ScopedRemixPackage
 * @typedef {"create-remix" | "remix" | ScopedRemixPackage} RemixPackage
 */
