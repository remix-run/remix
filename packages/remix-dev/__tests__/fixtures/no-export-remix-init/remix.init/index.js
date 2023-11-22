const fs = require("node:fs");

fs.writeFileSync(
  "./no-export-remix-init.txt",
  "added via remix.init with no export"
);
