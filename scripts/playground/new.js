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

  console.log("🚚  Copying remix deps...");
  await fse.copy(
    path.join(__dirname, "../../build/node_modules"),
    path.join(projectDir, "node_modules"),
    { overwrite: true }
  );

  let hasInit = await fse.exists(path.join(projectDir, "remix.init"));
  if (hasInit) {
    console.log("🎬  Running Remix Init...");
    execSync(`npx remix init`, { stdio: "inherit", cwd: projectDir });
  } else {
    console.log(
      `ℹ️  No remix.init directory found in ${projectDir.replace(
        process.cwd(),
        "."
      )}. Skipping init.`
    );
  }
}
