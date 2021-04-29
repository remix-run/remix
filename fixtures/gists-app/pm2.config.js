module.exports = {
  apps: [
    {
      name: "Express",
      script: "server.js",
      watch: ["build/assets.json"],
      watch_options: {
        followSymlinks: false
      },
      env: {
        NODE_ENV: "development"
      }
    },
    {
      name: "Remix",
      script: "node node_modules/@remix-run/dev/cli.js dev",
      ignore_watch: ["."],
      env: {
        NODE_ENV: "development"
      }
    }
  ]
};
