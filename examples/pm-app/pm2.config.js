const dotenv = require("dotenv");

const result = dotenv.config();
if (result.error) {
  throw result.error;
}

module.exports = {
  apps: [
    {
      name: "Remix",
      script: "npm run dev:remix",
      ignore_watch: ["."],
      env: {
        ...result.parsed,
        NODE_ENV: "development"
      }
    },
    {
      name: "CSS",
      script: "npx postcss styles --base styles --dir app/styles -w",
      watch: ["styles/"]
    },
    {
      name: "Express",
      script: "npm run dev:server",
      ignore_watch: ["."],
      env: {
        ...result.parsed,
        NODE_ENV: "development"
      }
    }
  ]
};
