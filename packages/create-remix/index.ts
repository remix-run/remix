import * as path from "path";
import { execSync } from "child_process";
import fse from "fs-extra";
import sortPackageJSON from "sort-package-json";
import got from "got";
import tar from "tar";
import { Stream } from "stream";
import { promisify } from "util";
import gitUrlParse from "git-url-parse";

import cliPkgJson from "./package.json";

// Node 15 added stream/promises, we can convert once we drop support for Node 14
let pipeline = promisify(Stream.pipeline);

export let servers: { [key: string]: RepoInfo } = {
  "Architect (AWS Lambda)": {
    branch: "main",
    filePath: "packages/create-remix/templates/arc",
    name: "remix",
    owner: "remix-run"
  },
  "Cloudflare Pages": {
    branch: "main",
    filePath: "packages/create-remix/templates/cloudflare-workers",
    name: "remix",
    owner: "remix-run"
  },
  "Cloudflare Workers": {
    branch: "main",
    filePath: "packages/create-remix/templates/cloudflare-pages",
    name: "remix",
    owner: "remix-run"
  },
  "Deno (experimental)": {
    branch: "main",
    filePath: "packages/create-remix/templates/deno",
    name: "remix",
    owner: "remix-run"
  },
  "Express Server": {
    branch: "main",
    filePath: "packages/create-remix/templates/express",
    name: "remix",
    owner: "remix-run"
  },
  "Fly.io": {
    branch: "main",
    filePath: "packages/create-remix/templates/fly",
    name: "remix",
    owner: "remix-run"
  },
  Netlify: {
    branch: "main",
    filePath: "packages/create-remix/templates/netlify",
    name: "remix",
    owner: "remix-run"
  },
  "Remix App Server": {
    branch: "main",
    filePath: "packages/create-remix/templates/remix",
    name: "remix",
    owner: "remix-run"
  },
  Vercel: {
    branch: "main",
    filePath: "packages/create-remix/templates/vercel",
    name: "remix",
    owner: "remix-run"
  }
} as const;

export type Server = typeof servers[keyof typeof servers];

export type Lang = "ts" | "js";

export interface CreateAppArgs {
  projectDir: string;
  lang: Lang;
  install: boolean;
  quiet?: boolean;
  repo: string | InputRepoInfo;
}

async function createApp({
  projectDir,
  install,
  quiet,
  repo: repoInfoOrUrl
}: CreateAppArgs) {
  let versions = process.versions;
  if (versions?.node && parseInt(versions.node) < 14) {
    console.log(
      `️🚨 Oops, Node v${versions.node} detected. Remix requires a Node version greater than 14.`
    );
    throw new Error();
  }

  // Create the app directory
  let relativeProjectDir = path.relative(process.cwd(), projectDir);
  let projectDirIsCurrentDir = relativeProjectDir === "";
  if (!projectDirIsCurrentDir) {
    if (fse.existsSync(projectDir)) {
      console.log(
        `️🚨 Oops, "${relativeProjectDir}" already exists. Please try again with a different directory.`
      );
      throw new Error();
    } else {
      await fse.mkdirp(projectDir);
    }
  }

  let appPkg: any;

  let parsed =
    typeof repoInfoOrUrl === "string"
      ? gitUrlToRepoInfo(repoInfoOrUrl)
      : repoInfoOrUrl;
  console.log({ parsed });

  let repoInfo = await getRepoInfo(parsed);

  // default to remix org if no owner is specified
  if (!parsed.owner) {
    parsed.owner = "remix-run";
  }

  if (!repoInfo) {
    let url =
      typeof repoInfoOrUrl === "string"
        ? repoInfoOrUrl
        : `https://github.com/${repoInfoOrUrl.name}/${repoInfoOrUrl.name}`;
    console.log(`️🚨 Oops, ${url} is not a valid github repo`);
    throw new Error();
  }

  console.log("Fetching template from GitHub...");
  // TODO: handle HTTP errors
  await downloadAndExtractRepo(projectDir, repoInfo);

  appPkg = require(path.join(projectDir, "package.json"));

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

  if (install || repoInfoOrUrl) {
    execSync("npm install", { stdio: "inherit", cwd: projectDir });
  }

  let setupScript = path.resolve(projectDir, "remix.init.js");
  let projectScript = path.resolve(projectDir, "remix.init.js");
  if (fse.existsSync(setupScript)) {
    let init = require(setupScript);
    await init(projectDir);
    fse.removeSync(projectScript);
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
  let directory = getProjectDir(repoInfo);

  try {
    return pipeline(
      got.stream(
        // `https://codeload.github.com/${repoInfo.owner}/${repoInfo.name}/tar.gz/${repoInfo.branch}`
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
  } catch (error) {
    console.error(error);
    throw error;
  }
}

export function getProjectDir(repoInfo: RepoInfo) {
  return `${repoInfo.name}-${repoInfo.branch}`;
}

function gitUrlToRepoInfo(url: string): InputRepoInfo {
  let parsed = gitUrlParse(url);
  return {
    filePath: parsed.filepath,
    name: parsed.name,
    owner: parsed.owner,
    branch: parsed.ref
  };
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
