import * as path from "path";
import { execSync } from "child_process";
import fse from "fs-extra";
import sortPackageJSON from "sort-package-json";
import got from "got";
import tar from "tar";
import { pipeline } from "stream/promises";

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
      repo?: InputRepoInfo;
    }
  | {
      projectDir: string;
      lang: Lang;
      server?: never;
      stack: Stack;
      install: boolean;
      quiet?: boolean;
      repo?: InputRepoInfo;
    }
  | {
      projectDir: string;
      lang: "ts";
      server?: never;
      stack?: never;
      install: boolean;
      quiet?: boolean;
      repo: InputRepoInfo;
    };

async function createApp({
  projectDir,
  lang,
  install,
  quiet,
  repo,
  server,
  stack
}: CreateAppArgs) {
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

  if (repo) {
    let repoInfo = await getRepoInfo(repo);

    if (!repoInfo) {
      console.log(
        `️🚨 Oops, https://github.com/${repo.name}/${repo.name} is not a valid github repo`
      );
      process.exit(1);
    }

    await downloadAndExtractRepo(projectDir, repoInfo);

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
    await fse.copy(sharedTemplate, projectDir, {
      filter: (src, dest) => true
    });

    // copy the server template
    let serverTemplate = path.resolve(
      __dirname,
      "templates",
      serverTemplatePath
    );
    if (fse.existsSync(serverTemplate)) {
      await fse.copy(serverTemplate, projectDir, {
        overwrite: true,
        filter: (src, dest) => true
      });
    }

    let serverLangTemplate = path.resolve(
      __dirname,
      "templates",
      `${server}_${lang}`
    );
    if (fse.existsSync(serverLangTemplate)) {
      await fse.copy(serverLangTemplate, projectDir, {
        overwrite: true,
        filter: (src, dest) => true
      });
    }

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
        `💿 That's it! \`cd\` into "${path.resolve(
          process.cwd(),
          projectDir
        )}" and check the README for development and deploy instructions!`
      );
    }
  }
}

export interface InputRepoInfo {
  owner: string;
  name: string;
  branch?: string;
  filePath: string;
}

export type RepoInfo = Omit<InputRepoInfo, "branch"> & { branch: string };

function downloadAndExtractRepo(
  root: string,
  repoInfo: RepoInfo
): Promise<void> {
  console.log({ repoInfo });
  let directory = getProjectDir(repoInfo);

  return pipeline(
    got.stream(
      `https://github.com/${repoInfo.owner}/${repoInfo.name}/archive/refs/heads/${repoInfo.branch}.tar.gz`
    ),
    tar.extract(
      {
        cwd: root,
        strip: repoInfo.filePath ? repoInfo.filePath.split("/").length + 1 : 1
      },
      [`${directory}${repoInfo.filePath ? `/${repoInfo.filePath}` : ""}`]
    )
  );
}

export function getProjectDir(repoInfo: RepoInfo) {
  return `${repoInfo.name}-${repoInfo.branch}`;
}

export async function getRepoInfo(
  repoInfo: InputRepoInfo
): Promise<RepoInfo | undefined> {
  if (!repoInfo.branch) {
    let res: any = await got(
      `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.name}`
    ).json();

    repoInfo.branch = res["default_branch"] as string;
  }

  return {
    ...repoInfo,
    branch: repoInfo.branch
  };
}

export { createApp };
