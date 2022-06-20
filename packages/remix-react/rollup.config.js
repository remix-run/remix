const path = require("path");

const { getBuildInfo, index } = require("../../rollup.utils");
const { name: packageName } = require("./package.json");

// Re-export everything from this package that is available in `remix`
const magicExports = {
  vars: {
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
