import * as path from "path";
import { execSync } from "child_process";
import { homedir } from "os";
import chalkAnimation from "chalk-animation";
import fse from "fs-extra";
import inquirer from "inquirer";
import meow from "meow";

/*
IMPORTANT: DO NOT MAKE CHANGES to this script unless absolutely necessary!

`npm init remix` and `npx create-remix` both aggressively cache scripts, which
means that in order to run the latest version of this script they need to use
`npx create-remix@latest`. There is no way to specify the script version with
`npm init remix`. So the best user experience is to just never update this
script so we don't have to tell users to purge their cached versions of it.
*/

const help = `
  Usage:
    $ npm init remix -- [flags...] [<dir>]
    $ npx create-remix [flags...] [<dir>]

  If <dir> is not provided up front you will be prompted for it.

  Flags:
    --auth              Your Remix license key. May be provided up front to avoid
                        a prompt later if the script is not able to automatically
                        detect it on this machine. Defaults to using the value of
                        the REMIX_TOKEN environment variable or the auth token in
                        $HOME/.npmrc
    --tag               The version tag of Remix to use, may also be a specific
                        version. Defaults to "latest"
    --help, -h          Show this help message
    --version, -v       Show the version of this script
`;

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
  let { input, flags, showHelp, showVersion } = meow(help, {
    flags: {
      auth: { type: "string" },
      help: { type: "boolean", default: false, alias: "h" },
      tag: { type: "string", default: "latest" },
      version: { type: "boolean", default: false, alias: "v" }
    }
  });

  if (flags.help) showHelp();
  if (flags.version) showVersion();

  let anim = chalkAnimation.rainbow(`\nR E M I X\n`);
  await new Promise(res => setTimeout(res, 1500));
  anim.stop();

  console.log("💿 Welcome to Remix! Let's get you set up with a new project.");
  console.log();

  // Figure out the app directory
  let appDir = path.resolve(
    process.cwd(),
    input.length > 0
      ? input[0]
      : (
          await inquirer.prompt([
            {
              type: "input",
              name: "dir",
              message: "Where would you like to create your app?",
              default: "./my-remix-app"
            }
          ])
        ).dir
  );

  // Create the app directory
  if (fse.existsSync(appDir)) {
    console.log(
      `️🚨 Oops, "${appDir}" already exists. Please try again with a different directory.`
    );
    process.exit(1);
  } else {
    await fse.mkdir(appDir);
  }

  // Make sure npm auth is configured
  if (process.env.REMIX_TOKEN) {
    console.log("💿 Detected REMIX_TOKEN on env, using local .npmrc");
    await writeEnvNpmrc(appDir);
  } else {
    if (await hasHomeNpmAuthToken()) {
      console.log("💿 Detected Remix license in ~/.npmrc");
    } else {
      await writeHomeNpmrc(
        (
          await inquirer.prompt([
            {
              type: "input",
              name: "key",
              message:
                "What is your Remix license key (https://remix.run/dashboard)?"
            }
          ])
        ).key
      );
      console.log(
        `💿 Wrote Remix token to ~/.npmrc. You won't need to provide that next time.`
      );
    }
  }

  // Finish up with @remix-run/init at the right version
  execSync(`npx --yes @remix-run/init@${flags.tag}`, {
    stdio: "inherit",
    cwd: appDir
  });

  console.log(
    `💿 That's it! \`cd\` into "${path.relative(
      process.cwd(),
      appDir
    )}" and check the README for development and deploy instructions!`
  );
}

async function hasHomeNpmAuthToken(): Promise<boolean> {
  let npmrcFile = path.resolve(homedir(), ".npmrc");
  if (fse.existsSync(npmrcFile)) {
    let npmrc = (await fse.readFile(npmrcFile)).toString();
    return /\/\/npm\.remix\.run\/:_authToken=/.test(npmrc);
  }
  return false;
}

async function writeHomeNpmrc(token: string): Promise<void> {
  let npmrc = `
//npm.remix.run/:_authToken=${token}
@remix-run:registry=https://npm.remix.run
`;
  let npmrcFile = path.resolve(homedir(), ".npmrc");
  if (fse.existsSync(npmrcFile)) {
    let existing = await fse.readFile(npmrcFile);
    npmrc = `${existing}${npmrc}`;
  }
  return fse.writeFile(npmrcFile, npmrc.trim());
}

async function writeEnvNpmrc(dir: string): Promise<void> {
  let npmrc = `
//npm.remix.run/:_authToken=\${REMIX_TOKEN}
@remix-run:registry=https://npm.remix.run
`;
  let npmrcFile = path.resolve(dir, ".npmrc");
  return fse.writeFile(npmrcFile, npmrc.trim());
}
