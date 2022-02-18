module.exports = {
  apps: [
    {
      name: "Express",
      script: "./build/index.js",
      watch: ["build/index.js"],
      watch_options: {
        followSymlinks: false
      },
      env: {
        NODE_ENV: "development"
      }
    },
    {
      name: "Remix",
      script: "node node_modules/@remix-run/dev/cli.js watch",
      ignore_watch: ["."],
      env: {
        NODE_ENV: "development"
      }
    }
  ]
};
