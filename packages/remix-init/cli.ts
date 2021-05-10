import * as path from "path";
import { execSync } from "child_process";
import fse from "fs-extra";
import inquirer from "inquirer";
import semver from "semver";

run().then(
  () => {
    process.exit(0);
  },
  error => {
    console.error(error);
    process.exit(1);
  }
);

async function run() {
  let answers = await inquirer.prompt<{
    server: "remix" | "arc" | "fly" | "vercel";
    lang: "ts" | "js";
    install: boolean;
  }>([
    {
      name: "server",
      type: "list",
      message:
        "Where do you want to deploy? Choose Remix if you're unsure, it's easy to change deployment targets.",
      loop: false,
      choices: [
        { name: "Remix App Server", value: "remix" },
        { name: "Architect (AWS Lambda)", value: "arc" },
        { name: "Fly.io", value: "fly" },
        // { name: "Render", value: "render" },
        // { name: "Netlify", value: "netlify" },
        { name: "Vercel", value: "vercel" }
        // { name: "Custom", value: "custom" }
      ]
    },
    {
      name: "lang",
      type: "list",
      message: "TypeScript or JavaScript?",
      choices: [
        { name: "TypeScript", value: "ts" },
        { name: "JavaScript", value: "js" }
      ]
    },
    {
      name: "install",
      type: "confirm",
      message: "Do you want me to run `npm install`?",
      default: true
    }
  ]);

  console.log();

  let appDir = process.cwd();

  // copy the shared template
  let sharedTemplate = path.resolve(
    __dirname,
    "templates",
    `_shared_${answers.lang}`
  );
  await fse.copy(sharedTemplate, appDir);

  // copy the server template
  let serverTemplate = path.resolve(__dirname, "templates", answers.server);
  if (fse.existsSync(serverTemplate)) {
    await fse.copy(serverTemplate, appDir, { overwrite: true });
  }

  // rename dotfiles
  await fse.move(
    path.join(appDir, "gitignore"),
    path.join(appDir, ".gitignore")
  );

  // merge package.jsons
  let appPkg = require(path.join(sharedTemplate, "package.json"));
  let serverPkg = require(path.join(serverTemplate, "package.json"));
  ["dependencies", "devDependencies", "scripts"].forEach(key => {
    Object.assign(appPkg[key], serverPkg[key]);
  });

  // add current versions of remix deps
  let pkg = require(path.join(__dirname, "package.json"));
  ["dependencies", "devDependencies"].forEach(pkgKey => {
    for (let key in appPkg[pkgKey]) {
      if (appPkg[pkgKey][key] === "*") {
        appPkg[pkgKey][key] = semver.prerelease(pkg.version)
          ? pkg.version // pin prerelease versions
          : `^${pkg.version}`;
      }
    }
  });

  // write package.json
  await fse.writeFile(
    path.join(appDir, "package.json"),
    JSON.stringify(appPkg, null, 2)
  );

  if (answers.install) {
    execSync("npm install", { stdio: "inherit" });
  }
}
