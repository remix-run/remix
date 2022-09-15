/** @type {import('@remix-run/dev').AppConfig} */
module.exports = {
  serverBuildTarget: "cloudflare-workers",
  server: "worker/index.ts",
  devServerBroadcastDelay: 1000,
  devServerPort: 8002,
  ignoredRouteFiles: ["**/.*"],
};
