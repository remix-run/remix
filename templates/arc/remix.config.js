/** @type {import('@remix-run/dev').AppConfig} */
export default {
  ignoredRouteFiles: ["**/*.css"],
  publicPath: "/_static/build/",
  server: "server.ts",
  serverBuildPath: "server/index.mjs",
  // appDirectory: "app",
  // assetsBuildDirectory: "public/build",
  serverModuleFormat: "esm",
};
