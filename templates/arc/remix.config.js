/** @type {import('@remix-run/dev').AppConfig} */
module.exports = {
  ignoredRouteFiles: ["**/.*"],
  publicPath: "/_static/build/",
  server: "./server.js",
  serverBuildPath: "server/index.js",
  // appDirectory: "app",
  // assetsBuildDirectory: "public/build",
  future: {
    v2_errorBoundary: true,
    v2_meta: true,
    v2_normalizeFormMethod: true,
    v2_routeConvention: true,
  },
};
