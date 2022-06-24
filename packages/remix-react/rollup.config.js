const path = require("path");
const babel = require("@rollup/plugin-babel").default;
const nodeResolve = require("@rollup/plugin-node-resolve").default;
const copy = require("rollup-plugin-copy");

const {
  copyToPlaygrounds,
  createBanner,
  getOutputDir,
  isBareModuleId,
  magicExportsPlugin,
} = require("../../rollup.utils");
const { name: packageName, version } = require("./package.json");

// Re-export everything from this package that is available in `remix`
const magicExports = {
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
      "FormEncType",
      "FormMethod",
      "FormProps",
      "LinkProps",
      "NavLinkProps",
      "RemixBrowserProps",
      "RemixServerProps",
      "ShouldReloadFunction",
      "SubmitFunction",
      "SubmitOptions",
      "ThrownResponse",
    ],
  },
};

/** @returns {import("rollup").RollupOptions[]} */
module.exports = function rollup() {
  let sourceDir = "packages/remix-react";
  let outputDir = getOutputDir(packageName);
  let outputDist = path.join(outputDir, "dist");

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
      magicExportsPlugin(magicExports, {
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
};
