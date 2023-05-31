/** @type {import('@remix-run/dev').AppConfig} */
module.exports = {
  ignoredRouteFiles: ["**/.*"],

  // Ensure tests need to explicitly opt-in to compiling the CSS bundle
  cssBundle: false,

  // appDirectory: "app",
  // assetsBuildDirectory: "public/build",
  // serverBuildPath: "build/index.js",
  // publicPath: "/build/",

  // !!! Don't adust this without changing the code that overwrites this
  // in createFixtureProject()
  ...global.INJECTED_FIXTURE_REMIX_CONFIG,
};
