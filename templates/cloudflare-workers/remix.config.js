/** @type {import('@remix-run/dev').AppConfig} */
module.exports = {
  serverModuleFormat: "esm",
  serverBuildPath: "build/index.mjs",
  server: "worker/index.ts",
  devServerBroadcastDelay: 1000,
  devServerPort: 8002,
  ignoredRouteFiles: ["**/.*"],
};
