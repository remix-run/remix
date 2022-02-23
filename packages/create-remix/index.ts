import path from "path";
import { execSync } from "child_process";
import fse from "fs-extra";
import sortPackageJSON from "sort-package-json";
import got from "got";
import gunzip from "gunzip-maybe";
import tar from "tar-fs";
import gitUrlParse from "git-url-parse";
import stream from "stream";
import { promisify } from "util";

import cliPkgJson from "./package.json";

// this is natively a promise in node 15+ stream/promises
let pipeline = promisify(stream.pipeline);

export let servers: { [key: string]: string } = {
  "Architect (AWS Lambda)":
    "https://github.com/remix-run/remix/tree/main/packages/create-remix/templates/arc",
  "Cloudflare Pages":
    "https://github.com/remix-run/remix/tree/main/packages/create-remix/templates/cloudflare-workers",
  "Cloudflare Workers":
    "https://github.com/remix-run/remix/tree/main/packages/create-remix/templates/cloudflare-pages",
  "Deno (experimental)":
    "https://github.com/remix-run/remix/tree/main/packages/create-remix/templates/deno",
  "Express Server":
    "https://github.com/remix-run/remix/tree/main/packages/create-remix/templates/express",
  "Fly.io":
    "https://github.com/remix-run/remix/tree/main/packages/create-remix/templates/fly",
  Netlify:
    "https://github.com/remix-run/remix/tree/main/packages/create-remix/templates/netlify",
  "Remix App Server":
    "https://github.com/remix-run/remix/tree/main/packages/create-remix/templates/remix",
  Vercel:
    "https://github.com/remix-run/remix/tree/main/packages/create-remix/templates/vercel"
} as const;

export type Server = typeof servers[keyof typeof servers];

export type Lang = "ts" | "js";

export interface CreateAppArgs {
  projectDir: string;
  lang: Lang;
  install: boolean;
  quiet?: boolean;
  repo: string;
}

async function createApp({ projectDir, install, quiet, repo }: CreateAppArgs) {
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
    }
  }

  let appPkg: any;

  let type: "url" | "file";
  let parsed: RepoInfo | undefined;

  // check if the "repo" is a file on disk; if so, use that
  // otherwise, parse the git url (or partial git url)
  if (fse.existsSync(repo)) {
    type = "file";
  } else {
    type = "url";
    parsed = await gitUrlToRepoInfo(repo);
  }

  if (type === "file") {
    if (repo.endsWith(".tar.gz")) {
      console.log(`Extracting local tarball...`);
      await extractLocalTarball(projectDir, repo);
    }
  } else if (typeof parsed !== "undefined") {
    // default to remix org if no owner is specified
    if (!parsed.owner) {
      parsed.owner = "remix-run";
    }
    console.log("Fetching template from GitHub...");
    // TODO: handle HTTP errors
    await downloadAndExtractRepo(
      projectDir,
      `https://github.com/${parsed.owner}/${parsed.name}/archive/refs/heads/${parsed.branch}.tar.gz`
    );
  } else {
    console.log(`️🚨 Oops, ${repo} is not a valid github repo`);
    throw new Error();
  }

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

  if (install || repo) {
    execSync("npm install", { stdio: "inherit", cwd: projectDir });
  }

  let setupScriptDir = path.join(projectDir, "remix.init");
  let setupScript = path.resolve(projectDir, "remix.init", "index.js");
  if (fse.existsSync(setupScript)) {
    try {
      let init = require(setupScript);
      await init(projectDir);
      fse.removeSync(setupScriptDir);
    } catch (error) {
      console.error(
        `⚠️  Error running \`remix.init\` script. We've kept the \`remix.init\` directory around so you can fix it and rerun "remix init".\n\n`
      );
      console.error(error);
    }
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

export interface RepoInfo {
  owner: string;
  name: string;
  branch: string;
  filePath: string;
}

async function extractLocalTarball(root: string, filePath: string) {
  console.log({ root, filePath });
  let readStream = fse.createReadStream(filePath).pipe(gunzip());
  let writeStream = tar.extract(root);
  await pipeline(readStream, writeStream);
}

async function downloadAndExtractRepo(root: string, url: string) {
  try {
    let tarballStream = got.stream(url).pipe(gunzip());
    let writeStream = fse.createWriteStream(root);
    await pipeline(tarballStream, writeStream);
  } catch (error) {
    console.error(error);
    throw error;
  }
}

// function getProjectDir(repoInfo: RepoInfo) {
//   return `${repoInfo.name}-${repoInfo.branch}`;
// }

async function gitUrlToRepoInfo(url: string): Promise<RepoInfo | undefined> {
  let parsed = gitUrlParse(url);

  if (!parsed.ref) {
    let res = await got(
      `https://api.github.com/repos/${parsed.owner}/${parsed.name}`
    );

    if (res.statusCode !== 200) {
      throw new Error(`Error fetching repo info for ${url}: ${res.statusCode}`);
    }

    let repo = JSON.parse(res.body.toString());
    parsed.ref = repo.default_branch;
  }

  return {
    filePath: parsed.filepath,
    name: parsed.name,
    owner: parsed.owner,
    branch: parsed.ref
  };
}

export { createApp };
