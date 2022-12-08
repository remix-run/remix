/**
 * @type {import('@remix-run/dev').AppConfig}
 */
module.exports = {
  serverBuildTarget: "deno",
  server: "./server.js",
  ignoredRouteFiles: ["**/.*"],
  serverBuildPath: ".netlify/edge-functions/server.js",
  // appDirectory: "app",
  // assetsBuildDirectory: "public/build",
  // publicPath: "/build/",
};
