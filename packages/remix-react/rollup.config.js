const path = require("path");

const { getBuildInfo, index } = require("../../rollup.utils");
const { name: packageName } = require("./package.json");

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
  let buildInfo = getBuildInfo(packageName);
  return [
    {
      ...index({ format: "cjs", magicExports, ...buildInfo }),
      input: path.join(buildInfo.sourceDir, "index.tsx"),
    },
    {
      ...index({ format: "esm", ...buildInfo }),
      input: path.join(buildInfo.sourceDir, "index.tsx"),
    },
  ];
};
