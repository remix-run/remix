/**
 * @type {import('@remix-run/dev').AppConfig}
 */
module.exports = {
  serverBuildTarget: "arc",
  server: "./server.js",
  ignoredRouteFiles: [".*"]
  // appDirectory: "app",
  // assetsBuildDirectory: "public/build",
  // serverBuildPath: "server/index.js",
  // publicPath: "/_static/build/",
  // devServerPort: 8002
};
