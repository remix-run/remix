import * as path from "path";
import { execSync } from "child_process";
import fse from "fs-extra";

import cliPkgJson from "./package.json";

export type Server =
  | "arc"
  | "cloudflare-workers"
  | "cloudflare-pages"
  | "deno"
  | "express"
  | "fly"
  | "netlify"
  | "remix"
  | "vercel";

export type Stack = "fly-stack" | "arc-stack";

export let appType = {
  basic: "basic",
  stack: "stack"
} as const;

export type AppType = typeof appType[keyof typeof appType];

export type Lang = "ts" | "js";

export type CreateAppArgs =
  | {
      projectDir: string;
      lang: Lang;
      server: Server;
      stack?: never;
      install: boolean;
      quiet?: boolean;
    }
  | {
      projectDir: string;
      lang: Lang;
      server?: never;
      stack: Stack;
      install: boolean;
      quiet?: boolean;
    };

async function createApp({
  projectDir,
  lang,
  install,
  quiet,
  ...rest
}: CreateAppArgs) {
  let server = rest.stack ? rest.stack : rest.server;
  // Create the app directory
  let relativeProjectDir = path.relative(process.cwd(), projectDir);
  let projectDirIsCurrentDir = relativeProjectDir === "";
  if (!projectDirIsCurrentDir) {
    if (fse.existsSync(projectDir)) {
      console.log(
        `️🚨 Oops, "${relativeProjectDir}" already exists. Please try again with a different directory.`
      );
      process.exit(1);
    } else {
      await fse.mkdir(projectDir);
    }
  }

  // copy the shared template
  let sharedTemplate = path.resolve(__dirname, "templates", `_shared_${lang}`);
  await fse.copy(sharedTemplate, projectDir);

  // copy the server template
  let serverTemplate = path.resolve(__dirname, "templates", server);
  if (fse.existsSync(serverTemplate)) {
    await fse.copy(serverTemplate, projectDir, { overwrite: true });
  }

  let serverLangTemplate = path.resolve(
    __dirname,
    "templates",
    `${server}_${lang}`
  );
  if (fse.existsSync(serverLangTemplate)) {
    await fse.copy(serverLangTemplate, projectDir, { overwrite: true });
  }

  // rename dotfiles
  let dotfiles = ["gitignore", "github", "dockerignore", "env.example"];
  await Promise.all(
    dotfiles.map(async dotfile => {
      if (fse.existsSync(path.join(projectDir, dotfile))) {
        return fse.rename(
          path.join(projectDir, dotfile),
          path.join(projectDir, `.${dotfile}`)
        );
      }
    })
  );

  // merge package.jsons
  let appPkg = require(path.join(sharedTemplate, "package.json"));
  appPkg.scripts = appPkg.scripts || {};
  appPkg.dependencies = appPkg.dependencies || {};
  appPkg.devDependencies = appPkg.devDependencies || {};
  let serverPkg = require(path.join(serverTemplate, "package.json"));
  ["dependencies", "devDependencies", "scripts"].forEach(key => {
    Object.assign(appPkg[key], serverPkg[key]);
  });

  appPkg.main = serverPkg.main;

  // add current versions of remix deps
  ["dependencies", "devDependencies"].forEach(pkgKey => {
    for (let key in appPkg[pkgKey]) {
      if (appPkg[pkgKey][key] === "*") {
        // Templates created from experimental, alpha, beta releases should pin
        // to a specific version
        appPkg[pkgKey][key] = String(cliPkgJson.version).includes("-")
          ? cliPkgJson.version
          : "^" + cliPkgJson.version;
      }
    }
  });

  // write package.json
  await fse.writeFile(
    path.join(projectDir, "package.json"),
    JSON.stringify(appPkg, null, 2)
  );

  if (install) {
    execSync("npm install", { stdio: "inherit", cwd: projectDir });
  }

  if (!quiet) {
    if (projectDirIsCurrentDir) {
      console.log(
        `💿 That's it! Check the README for development and deploy instructions!`
      );
    } else {
      console.log(
        `💿 That's it! \`cd\` into "${path.relative(
          process.cwd(),
          projectDir
        )}" and check the README for development and deploy instructions!`
      );
    }
  }
}

export { createApp };
