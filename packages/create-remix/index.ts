import * as path from "path";
import { execSync } from "child_process";
import fse from "fs-extra";
import sortPackageJSON from "sort-package-json";
import got from "got";
import tar from "tar";
import { Stream } from "stream";
import { promisify } from "util";

import cliPkgJson from "./package.json";

const pipeline = promisify(Stream.pipeline);

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
      repoUrl?: never;
    }
  | {
      projectDir: string;
      lang: Lang;
      server?: never;
      stack: Stack;
      install: boolean;
      quiet?: boolean;
      repoUrl?: never;
    }
  | {
      projectDir: string;
      lang: "ts";
      server?: never;
      stack?: never;
      install: boolean;
      quiet?: boolean;
      repoUrl: string;
    };

async function createApp({
  projectDir,
  lang,
  install,
  quiet,
  repoUrl,
  server,
  stack
}: CreateAppArgs) {
  console.log({
    projectDir,
    lang,
    install,
    repoUrl,
    server,
    stack,
    quiet
  });

  let versions = process.versions;
  if (versions?.node && parseInt(versions.node) < 14) {
    console.log(
      `️🚨 Oops, Node v${versions.node} detected. Remix requires a Node version greater than 14.`
    );
    process.exit(1);
  }

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
      await fse.mkdirp(projectDir);
    }
  }

  let appPkg: any;
  let setupScript: any;

  if (typeof repoUrl === "string") {
    // download the repo
    // appPkg = require(path.join(sharedTemplate, "package.json"));

    await downloadAndExtractRepo(projectDir, {
      username: "mcansh",
      branch: "main",
      filePath: "",
      name: "snkrs"
    });
    appPkg = require(path.join(projectDir, "package.json"));

    setupScript = path.resolve(projectDir, "scripts/init.js");
    let projectScriptsDir = path.resolve(projectDir, "scripts");
    let projectScript = path.resolve(projectDir, "scripts/init.js");
    if (fse.existsSync(setupScript)) {
      let init = require(setupScript);
      await init(projectDir);
      fse.removeSync(projectScript);
      let fileCount = fse.readdirSync(projectScriptsDir).length;
      if (fileCount === 0) {
        fse.rmdirSync(projectScriptsDir);
      }
    }
  } else {
    let serverTemplatePath = stack ? stack : server;
    if (!serverTemplatePath) {
      console.log(`️🚨 Oops, you must specify a server template`);
      process.exit(1);
    }

    // copy the shared template
    let sharedTemplate = path.resolve(
      __dirname,
      "templates",
      `_shared_${lang}`
    );
    await fse.copy(sharedTemplate, projectDir);

    // copy the server template
    let serverTemplate = path.resolve(
      __dirname,
      "templates",
      serverTemplatePath
    );
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
    appPkg = require(path.join(sharedTemplate, "package.json"));
    appPkg.scripts = appPkg.scripts || {};
    appPkg.dependencies = appPkg.dependencies || {};
    appPkg.devDependencies = appPkg.devDependencies || {};
    let serverPkg = require(path.join(serverTemplate, "package.json"));
    ["dependencies", "devDependencies", "scripts"].forEach(key => {
      Object.assign(appPkg[key], serverPkg[key]);
    });

    appPkg.main = serverPkg.main;

    setupScript = path.resolve(serverTemplate, "scripts/init.js");
    let projectScriptsDir = path.resolve(serverTemplate, "scripts");
    let projectScript = path.resolve(serverTemplate, "scripts/init.js");
    if (fse.existsSync(setupScript)) {
      let init = require(setupScript);
      await init(serverTemplate);
      fse.removeSync(projectScript);
      let fileCount = fse.readdirSync(projectScriptsDir).length;
      if (fileCount === 0) {
        fse.rmdirSync(projectScriptsDir);
      }
    }
  }

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

  appPkg = sortPackageJSON(appPkg);

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

type RepoInfo = {
  username: string;
  name: string;
  branch: string;
  filePath: string;
};

function downloadAndExtractRepo(
  root: string,
  { username, name, branch, filePath }: RepoInfo
): Promise<void> {
  return pipeline(
    got.stream(
      `https://github.com/${username}/${name}/archive/refs/heads/${branch}.tar.gz`
    ),
    tar.extract(
      { cwd: root, strip: filePath ? filePath.split("/").length + 1 : 1 },
      [`${name}-${branch}${filePath ? `/${filePath}` : ""}`]
    )
  );
}

export { createApp };
