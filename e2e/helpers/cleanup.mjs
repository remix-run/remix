import * as path from "path";
import { deleteSync } from "del";

if (process.env.CI) {
  console.log("Skipping cleanup in CI");
  process.exit();
}

const pathsToRemove = [path.resolve(process.cwd(), ".tmp/integration")];

let deleted = deleteSync(pathsToRemove);

for (let d of deleted) {
  console.log(`Removed ${path.relative(process.cwd(), d)}`);
}

for (let p of pathsToRemove) {
  if (!deleted.includes(p)) {
    console.log(`Failed to remove ${path.relative(process.cwd(), p)}`);
  }
}
