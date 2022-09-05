/** @type {import('@remix-run/dev').AppConfig} */
module.exports = {
  ignoredRouteFiles: ["**/.*"],
  appDirectory: "app",
  assetsBuildDirectory: "public/build",
  serverBuildPath: "build/index.js",
  publicPath: "/build/",
  serverDependenciesToBundle: [
    "@twind/with-remix",
    "twind",
    "@twind/preset-autoprefix",
    "@twind/preset-tailwind",
  ],
};
