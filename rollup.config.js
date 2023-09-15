const fs = require("node:fs");
const path = require("node:path");

module.exports = function rollup(options) {
  return fs.readdirSync("packages").flatMap((dir) => {
    let configPath = path.join("packages", dir, "rollup.config.js");
    try {
      fs.readFileSync(configPath);
    } catch {
      return [];
    }
    let packageBuild = require(`.${path.sep}${configPath}`);
    return packageBuild(options);
  });
};
