const fs = require("fs");
const path = require("path");

function main({ rootDirectory }) {
  const examplePath = path.resolve(rootDirectory, "wrangler.example.toml");
  const devPath = path.resolve(rootDirectory, "wrangler.dev.toml");
  fs.copyFileSync(examplePath, devPath);
}

module.exports = main;
