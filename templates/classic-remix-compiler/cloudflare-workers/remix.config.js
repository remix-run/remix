/** @type {import('@remix-run/dev').AppConfig} */
export default {
  ignoredRouteFiles: ["**/*.css"],
  server: "./server.ts",
  serverConditions: ["workerd", "worker", "browser"],
  serverDependenciesToBundle: "all",
  serverMainFields: ["browser", "module", "main"],
  serverMinify: true,
  serverModuleFormat: "esm",
  serverPlatform: "neutral",
  // appDirectory: "app",
  // assetsBuildDirectory: "public/build",
  // publicPath: "/build/",
  // serverBuildPath: "build/index.js",
};
