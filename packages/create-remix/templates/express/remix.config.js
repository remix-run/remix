/**
 * @type {import('@remix-run/dev').AppConfig}
 */
module.exports = {
  server: "./server.js",
  ignoredRouteFiles: [".*"],
  devServer: {
    broadcastDelay: 1000
    // port: 8002
  }
  // appDirectory: "app",
  // assetsBuildDirectory: "public/build",
  // serverBuildPath: "build/index.js",
  // publicPath: "/build/",
};
