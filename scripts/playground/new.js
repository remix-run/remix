#!/usr/bin/env node

// this generates a new playground project in the .gitignored playground directory
// yarn playground:new <?name>

let path = require("path");
let { execSync } = require("child_process");
let fse = require("fs-extra");

createNewProject(process.argv[2]);

async function createNewProject(name = `playground-${Date.now()}`) {
  let projectDir = path.join(__dirname, "../../playground", name);
  let localTemplate = path.join(__dirname, "template.local");
  let hasLocalTemplate = await fse.exists(localTemplate);
  if (hasLocalTemplate) {
    console.log(`ℹ️  Using local template: ${localTemplate}`);
  } else {
    console.log(
      `ℹ️  Using default template. If you want to customize it, make a project in ${localTemplate.replace(
        process.cwd(),
        "."
      )} and we'll use that one instead.`
    );
  }
  let templateDir = hasLocalTemplate
    ? localTemplate
    : path.join(__dirname, "template");
  if (await fse.pathExists(projectDir)) {
    throw new Error(
      `🚨  A playground with the name ${name} already exists. Delete it first or use a different name.`
    );
  }
  await fse.copy(templateDir, projectDir, {
    filter(src, dest) {
      return !src.includes("node_modules");
    },
  });

  console.log("📥  Installing deps...");
  execSync(`npm install`, { stdio: "inherit", cwd: projectDir });

  let remixDeps = path.join(__dirname, "../../build/node_modules");

  console.log("🏗  Building remix...");
  execSync(`yarn rollup -c`, { stdio: "inherit" });

  console.log("🚚  Copying remix deps...");
  await fse.copy(remixDeps, path.join(projectDir, "node_modules"), {
    overwrite: true,
  });

  let relativeProjectDir = projectDir.replace(process.cwd(), ".");
  let hasInit = await fse.exists(path.join(projectDir, "remix.init"));
  if (hasInit) {
    console.log("🎬  Running Remix Init...");
    execSync(`node ./node_modules/@remix-run/dev/cli init`, {
      stdio: "inherit",
      cwd: projectDir,
    });
  } else {
    console.log(
      `ℹ️  No remix.init directory found in ${relativeProjectDir}. Skipping init.`
    );
  }
  console.log(
    `✅  Done! Now in one terminal run \`yarn watch\` in the root of the remix repo and in another cd into ${relativeProjectDir} and run \`npm run dev\` and you should be set.`
  );
}
