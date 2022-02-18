import fs from "fs/promises";
import path from "path";

let dirPath = path.join(process.cwd(), "examples");
let dir = await fs.readdir(dirPath);

dir.forEach(async name => {
  let fullPath = path.join(dirPath, name);
  let stat = await fs.stat(fullPath);
  if (stat.isDirectory()) {
    let pkgPath = path.join(fullPath, "package.json");
    let pkg = await fs.readFile(pkgPath);
    let obj = JSON.parse(pkg);
    obj.name = `remix-example-${name}`;
    await fs.writeFile(pkgPath, JSON.stringify(obj, null, 2) + "\n");
  }
});
