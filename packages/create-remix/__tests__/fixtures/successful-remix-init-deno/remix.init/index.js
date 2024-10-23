const fs = require("node:fs");
const path = require("node:path");
const isOdd = require("is-odd");

module.exports = ({ rootDirectory }) => {
  fs.writeFileSync(
    path.join(rootDirectory, "test.txt"),
    `added via remix.init, isOdd(1): ${isOdd(1)}`
  );
};
