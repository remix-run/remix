/** @type {import('@remix-run/dev').AppConfig} */
module.exports = {
  future: {
    v2_routeConvention: true,
  },
  ignoredRouteFiles: ["**/.*"],
  publicPath: "/_static/build/",
  server: "./server.js",
  serverBuildPath: "server/index.js",
  // appDirectory: "app",
  // assetsBuildDirectory: "public/build",
};
