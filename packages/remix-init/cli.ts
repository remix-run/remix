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
    server: "remix" | "express" | "arc" | "fly" | "vercel" | "netlify" | "cloudflare-workers";
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
        { name: "Express Server", value: "express" },
        { name: "Architect (AWS Lambda)", value: "arc" },
        { name: "Fly.io", value: "fly" },
        // { name: "Render", value: "render" },
        { name: "Netlify", value: "netlify" },
        { name: "Vercel", value: "vercel" },
        { name: "Cloudflare Workers", value: "cloudflare-workers" }
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

  let serverLangTemplate = path.resolve(
    __dirname,
    "templates",
    `${answers.server}_${answers.lang}`
  );
  if (fse.existsSync(serverLangTemplate)) {
    await fse.copy(serverLangTemplate, appDir, { overwrite: true });
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
