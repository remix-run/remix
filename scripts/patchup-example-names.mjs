import fs from "fs/promises";
import path from "path";

let examplePath = path.join(process.cwd(), "examples");
let templatePath = path.join(process.cwd(), "templates");
let examples = await fs.readdir(examplePath);
let templates = await fs.readdir(templatePath);

async function update(dir, name, base) {
  let fullPath = path.join(dir, name);
  let stat = await fs.stat(fullPath);
  if (stat.isDirectory()) {
    let pkgPath = path.join(fullPath, "package.json");
    let pkg = await fs.readFile(pkgPath);
    let obj = JSON.parse(pkg);
    obj.name = `remix-${base}-${name}`;
    await fs.writeFile(pkgPath, JSON.stringify(obj, null, 2) + "\n");
  }
}

examples.forEach(async (name) => {
  await update(examplePath, name, "example");
});

templates.forEach(async (name) => {
  await update(templatePath, name, "template");
});
