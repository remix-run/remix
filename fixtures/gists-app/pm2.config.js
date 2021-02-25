module.exports = {
  apps: [
    {
      name: "Express",
      script: "server.js",
      watch: ["remix.config.js", "server-build/asset-manifest.json"],
      watch_options: {
        followSymlinks: false
      },
      env: {
        NODE_ENV: "development"
      }
    },
    {
      name: "Remix",
      script: "node node_modules/@remix-run/dev/cli run",
      ignore_watch: ["."],
      env: {
        NODE_ENV: "development"
      }
    }
  ]
};
