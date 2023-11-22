import fs from "node:fs";
import path from "node:path";
export default ({rootDirectory}) => {
  fs.writeFileSync(
    path.join(rootDirectory, "es6-remix-init-test.txt"),
    "added via es6 remix.init"
  );
}
