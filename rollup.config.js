const fs = require("fs");
const path = require("path");

module.exports = function rollup(options) {
  return fs
    .readdirSync("packages")
    .flatMap((dir) => {
      let configPath = path.join("packages", dir, "rollup.config.js");
      try {
        fs.readFileSync(configPath);
        let packageBuild = require(`.${path.sep}${configPath}`);
        return packageBuild(options);
      } catch (e) {
        return null;
      }
    })
    .filter((p) => p);
};
