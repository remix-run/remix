import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
export default ({ rootDirectory }) => {
  fs.writeFileSync(
    pathToFileURL(path.join(rootDirectory, "es6-remix-init-test.txt")),
    "added via es6 remix.init"
  );
};
