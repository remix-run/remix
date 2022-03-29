/**
 * @type {import('@remix-run/dev').AppConfig}
 */
module.exports = {
  // For regular Netlify Functions runtime, use these values:
  serverBuildTarget: "netlify",
  server: "./server.js",
  // To use Netlify Edge Functions (beta) runtime, change values to the following:
  // serverBuildTarget: "netlify-edge",
  // server: "./edge-server.ts",
  ignoredRouteFiles: [".*"],
  // appDirectory: "app",
  // assetsBuildDirectory: "public/build",
  // serverBuildPath: ".netlify/functions-internal/server.js",
  // publicPath: "/build/",
};
