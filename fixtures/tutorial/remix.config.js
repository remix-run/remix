module.exports = {
  appDirectory: "app",
  browserBuildDirectory: "public/build",
  publicPath: "/build/",
  serverBuildDirectory: "build/app",
  devServerPort: 8002,
  routes(defineRoutes) {
    return defineRoutes(route => {
      route("*", "catchall.tsx");
    });
  }
};
