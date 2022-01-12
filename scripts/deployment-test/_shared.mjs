import path from "path";
import { execSync } from "child_process";
import jsonfile from "jsonfile";

let sha = execSync("git rev-parse HEAD").toString().trim().slice(0, 7);
let date = Date.now();

async function updatePackageConfig(packageName, transform) {
  let file = path.join(packageName, "package.json");
  let json = await jsonfile.readFile(file);
  transform(json);
  await jsonfile.writeFile(file, json, { spaces: 2 });
}

export { sha, date, updatePackageConfig };
