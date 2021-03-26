module.exports = {
  apps: [
    {
      name: "Express",
      script: "server.js",
      watch: ["build/assets.json"],
      env: {
        NODE_ENV: "development"
      }
    },
    {
      name: "Remix",
      script: "node node_modules/@remix-run/dev/cli run2",
      watch: ["remix.config.js"]
    }
  ]
};
