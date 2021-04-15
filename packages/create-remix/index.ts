import path from "path";
import fse from "fs-extra";
import inquirer from "inquirer";

async function go() {
  console.log(`Welcome to Remix!`);

  let answers = await inquirer.prompt([
    // {
    //   type: "input",
    //   name: "key",
    //   message: "What is your Remix license key?"
    // },
    {
      type: "input",
      name: "appDir",
      message: "Where would you like to create your app?",
      default: "./my-remix-app"
    },
    // {
    //   type: "list",
    //   name: "lang",
    //   message: "TypeScript or JavaScript?",
    //   choices: [
    //     { name: "TypeScript", value: "ts" },
    //     { name: "JavaScript", value: "js" }
    //   ]
    // },
    {
      type: "list",
      name: "server",
      message: "Where do you want to deploy?",
      loop: false,
      choices: [
        { name: "Remix (or unsure)", value: "remix" },
        { name: "Architect (AWS Lambda)", value: "arc" },
        { name: "Fly.io", value: "fly" },
        { name: "Render", value: "render" },
        { name: "Vercel", value: "vercel" },
        { name: "Custom", value: "custom" }
      ]
    }
  ]);

  let cwd = process.cwd();
  let appDir = path.resolve(cwd, answers.appDir);

  // copy the shared template
  let sharedTemplate = path.resolve(__dirname, "templates", "_shared");
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
  await fse.move(path.join(appDir, "npmrc"), path.join(appDir, ".npmrc"));

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
        appPkg[pkgKey][key] = `^${pkg.version}`;
      }
    }
  });

  await fse.writeFile(
    path.join(appDir, "package.json"),
    JSON.stringify(appPkg, null, 2)
  );

  // Das'it!
  console.log("✨ Done!");
}

go();
