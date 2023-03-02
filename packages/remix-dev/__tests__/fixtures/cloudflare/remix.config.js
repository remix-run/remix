/** @type {import('@remix-run/dev').AppConfig} */
module.exports = {
  serverBuildPath: "functions/[[path]].js",
  serverConditions: ["worker"],
  serverMainFields: ["browser", "module", "main"],
  serverModuleFormat: "esm",
  serverPlatform: "neutral",
  server: "./server.js",
  devServerBroadcastDelay: 1000,
  ignoredRouteFiles: ["**/.*"],
  // appDirectory: "app",
  // assetsBuildDirectory: "public/build",
  // publicPath: "/build/",
};
