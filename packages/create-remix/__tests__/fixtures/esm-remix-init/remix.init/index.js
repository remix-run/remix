import fs from "node:fs";
import path from "node:path";
export default ({ rootDirectory }) => {
  fs.writeFileSync(
    path.join(rootDirectory, "esm-remix-init-test.txt"),
    "added via esm remix.init"
  );
};
