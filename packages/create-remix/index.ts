// @ts-expect-error don't care about these types
import chalkAnimation from "chalk-animation";
import path from "path";
import fse from "fs-extra";
import inquirer from "inquirer";
import { homedir } from "os";
import { spawn } from "child_process";

////////////////////////////////////////////////////////////////////////////////
try {
  go();
} catch (error) {
  throw error;
}

async function go() {
  let anim = chalkAnimation.rainbow(`\nR E M I X\n`);
  await new Promise(res => setTimeout(res, 1500));
  anim.stop();

  console.log(
    "\n💿 Welcome to Remix! Let's get you set up with a new project.\n"
  );

  let { dir } = await inquirer.prompt([
    {
      type: "input",
      name: "dir",
      message: "Where would you like to create your app?",
      default: "./my-remix-app"
    }
  ]);
  let cwd = process.cwd();
  let appDir = path.resolve(cwd, dir);
  if (fse.existsSync(appDir)) {
    console.log(
      `\n⚠️ Oops, "${appDir}" already exists. Please try again with a different directory.`
    );
    process.exit();
  }

  let answers = await inquirer.prompt<{
    appDir: string;
    server: "remix" | "arc" | "fly" | "vercel";
    install: boolean;
  }>([
    {
      type: "list",
      name: "server",
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
      type: "confirm",
      name: "install",
      message: "Do you want me to run `npm install`?",
      default: true
    }
    // {
    //   type: "list",
    //   name: "lang",
    //   message: "TypeScript or JavaScript?",
    //   choices: [
    //     { name: "TypeScript", value: "ts" },
    //     { name: "JavaScript", value: "js" }
    //   ]
    // },
  ]);

  // add a space under the prompt
  console.log();

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
        // can't use ^ for experimental releases
        // should probably use ^ when we release
        // appPkg[pkgKey][key] = `^${pkg.version}`;
        appPkg[pkgKey][key] = `${pkg.version}`;
      }
    }
  });

  // write package.json
  await fse.writeFile(
    path.join(appDir, "package.json"),
    JSON.stringify(appPkg, null, 2)
  );

  // Handle Remix token
  // If they've got an envvar, just use that
  if (process.env.REMIX_TOKEN) {
    console.log("💿 Detected REMIX_TOKEN on env, using local .npmrc.");
    await writeEnvNpmRc(appDir);
  } else {
    // if they have it in their home directory, just move on
    if (await hasHomeNpmRc()) {
      console.log("💿 Detected Remix license in ~/.npmrc");
    } else {
      // if they don't, write it
      let answers = await inquirer.prompt([
        {
          type: "input",
          name: "key",
          message:
            "What is your Remix license key (https://remix.run/dashboard)?"
        }
      ]);
      await writeHomeNpmRc(answers.key);
      console.log(
        `💿 Wrote Remix token to ~/.npmrc. You won't need to provide that next time.`
      );
    }
  }

  if (answers.install) {
    process.chdir(appDir);
    await npm(["install", "--supress-warnings", "--no-fund"]);
  }

  if (answers.server === "remix") {
    console.log(`💿 That's it! \`cd\` into "${dir}" and run \`npm run dev\`!`);
  } else {
    console.log(
      `💿 That's it! Since you're using \`${answers.server}\`, make sure to check the README for development and deployment instructions.`
    );
  }
}

////////////////////////////////////////////////////////////////////////////////

async function hasHomeNpmRc(): Promise<boolean> {
  let tokenRegex = /\/\/npm\.remix\.run\/:_authToken=/;
  let registryRegex = /@remix-run:registry=https:\/\/npm\.remix\.run/;
  let dir = homedir();
  let rcPath = path.join(dir, ".npmrc");
  if (fse.existsSync(rcPath)) {
    let npmrc = (await fse.readFile(rcPath)).toString();
    return tokenRegex.test(npmrc) && registryRegex.test(npmrc);
  }

  return false;
}

async function writeEnvNpmRc(dir: string): Promise<void> {
  let npmrc = `
//npm.remix.run/:_authToken=\${REMIX_TOKEN}
@remix-run:registry=https://npm.remix.run
`;

  let rcPath = path.join(dir, ".npmrc");
  return fse.writeFile(rcPath, npmrc.trim());
}

async function writeHomeNpmRc(token: string): Promise<void> {
  let npmrc = `
//npm.remix.run/:_authToken=${token}
@remix-run:registry=https://npm.remix.run
`;

  let dir = homedir();
  let rcPath = path.join(dir, ".npmrc");

  if (fse.existsSync(rcPath)) {
    let existingrc = await fse.readFile(rcPath);
    npmrc = `${existingrc}${npmrc}`;
  }

  return fse.writeFile(rcPath, npmrc.trim());
}

function npm(args: string[]): Promise<void> {
  return new Promise((accept, reject) => {
    spawn("npm", args, { stdio: "inherit" }).on("close", code => {
      code === 0 ? accept() : reject();
    });
  });
}
