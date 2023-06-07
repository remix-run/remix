/** @type {import('@remix-run/dev').AppConfig} */
module.exports = {
  ignoredRouteFiles: ["**/.*"],
  publicPath: "/_static/build/",
  server: "./server.ts",
  serverBuildPath: "server/index.js",
  // appDirectory: "app",
  // assetsBuildDirectory: "public/build",
  future: {
    v2_errorBoundary: true,
    v2_headers: true,
    v2_meta: true,
    v2_normalizeFormMethod: true,
    v2_routeConvention: true,
  },
};
