/**
 * @type {import('@remix-run/dev/config').AppConfig}
 */
module.exports = {
  serverBuildTarget: "cloudflare-workers",
  devServerBroadcastDelay: 1000,
  ignoredRouteFiles: [".*"]
};
