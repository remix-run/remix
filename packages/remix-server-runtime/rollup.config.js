/* eslint-disable no-restricted-globals */
const { getBuildInfo, index } = require("../../rollup.utils");
const { name: packageName } = require("./package.json");

// Re-export everything from this package that is available in `remix`
const magicExports = {
  vars: {
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

/** @returns {import("rollup").RollupOptions[]} */
module.exports = function rollup() {
  let buildInfo = getBuildInfo(packageName);
  return [
    index({ format: "cjs", magicExports, ...buildInfo }),
    index({ format: "esm", ...buildInfo }),
  ];
};
