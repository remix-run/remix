/* eslint-disable no-restricted-globals */
const { getBuildInfo, index } = require("../../rollup.utils");
const { name: packageName } = require("./package.json");

// Re-export everything from this package that is available in `remix`
const magicExports = {
  values: {
    "@remix-run/server-runtime": [
      "createSession",
      "isCookie",
      "isSession",
      "json",
      "redirect",
    ],
  },
  types: {
    "@remix-run/server-runtime": [
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

/** @returns {import("rollup").RollupOptions[]} */
module.exports = function rollup() {
  let buildInfo = getBuildInfo(packageName);
  return [
    index({ format: "cjs", magicExports, ...buildInfo }),
    index({ format: "esm", ...buildInfo }),
  ];
};
