import path from "path";
import { execSync } from "child_process";
import fse from "fs-extra";
import sortPackageJSON from "sort-package-json";
import got from "got";
import gunzip from "gunzip-maybe";
import tar from "tar-fs";
import parseUrl from "parse-github-url";
import stream from "stream";
import { promisify } from "util";
import URL from "url";

import cliPkgJson from "./package.json";

// this is natively a promise in node 15+ stream/promises
let pipeline = promisify(stream.pipeline);

export let servers: { [key: string]: string } = {
  "Architect (AWS Lambda)":
    "https://github.com/remix-run/remix/blob/main/packages/create-remix/templates/arc",
  "Cloudflare Pages":
    "https://github.com/remix-run/remix/blob/main/packages/create-remix/templates/cloudflare-workers",
  "Cloudflare Workers":
    "https://github.com/remix-run/remix/blob/main/packages/create-remix/templates/cloudflare-pages",
  "Deno (experimental)":
    "https://github.com/remix-run/remix/blob/main/packages/create-remix/templates/deno",
  "Express Server":
    "https://github.com/remix-run/remix/blob/main/packages/create-remix/templates/express",
  "Fly.io":
    "https://github.com/remix-run/remix/blob/main/packages/create-remix/templates/fly",
  Netlify:
    "https://github.com/remix-run/remix/blob/main/packages/create-remix/templates/netlify",
  "Remix App Server":
    "https://github.com/remix-run/remix/blob/main/packages/create-remix/templates/remix",
  Vercel:
    "https://github.com/remix-run/remix/blob/main/packages/create-remix/templates/vercel"
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

  let type: "url" | "file" | "directory";
  let url: string | undefined;

  // check if the "repo" is a file on disk; if so, use that
  // otherwise, parse the git url (or partial git url))
  if (fse.existsSync(repo)) {
    let stat = fse.statSync(repo);
    if (stat.isDirectory()) {
      type = "directory";
    } else {
      type = "file";
    }
  } else if (repo.startsWith("file://")) {
    type = "file";
    repo = URL.fileURLToPath(repo);
  } else {
    type = "url";
    try {
      let parsed = await gitUrlToRepoInfo(repo);
      url = `https://github.com/${parsed.owner}/${parsed.name}/archive/refs/heads/${parsed.branch}.tar.gz`;
    } catch (error) {
      url = repo;
    }
  }

  if (type === "directory") {
    console.log("Copying directory...");
    fse.copySync(repo, projectDir);
  } else if (type === "file") {
    if (repo.endsWith(".tar.gz")) {
      console.log(`Extracting local tarball...`);
      await extractLocalTarball(projectDir, repo);
    }
  } else if (typeof url !== "undefined") {
    console.log("Fetching template from remote...");
    await downloadAndExtractRepo(projectDir, url);
  } else {
    console.log(`️🚨 Oops, ${url} is not a valid url`);
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

  let setupScriptDir = path.join(projectDir, "remix.init");
  let setupScript = path.resolve(projectDir, "remix.init", "index.js");
  let hasSetupScript = fse.existsSync(setupScript);

  if (install) {
    execSync("npm install", { stdio: "inherit", cwd: projectDir });

    if (hasSetupScript) {
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
  } else if (repo && hasSetupScript) {
    console.log(
      `\n\n You've opted out of running \`npm install\` in your new project.\n\n You'll need to manually install dependencies and run \`node ${setupScript}\`.\n\n`
    );
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

async function extractLocalTarball(
  projectDir: string,
  filePath: string
): Promise<void> {
  let readStream = fse.createReadStream(filePath).pipe(gunzip());
  let writeStream = tar.extract(projectDir);
  await pipeline(readStream, writeStream);
}

async function downloadAndExtractRepo(
  projectDir: string,
  url: string
): Promise<void> {
  let desiredDir = path.basename(projectDir);
  let cwd = path.dirname(projectDir);
  await pipeline(
    got.stream(url).pipe(gunzip()),
    tar.extract(cwd, {
      map(header) {
        let originalDirName = header.name.split("/")[0];
        header.name = header.name.replace(originalDirName, desiredDir);
        return header;
      }
    })
  );
}

async function gitUrlToRepoInfo(url: string): Promise<parseUrl.Result> {
  let parsed = parseUrl(url);

  if (!parsed || !parsed.repo) {
    throw new Error(`Invalid git url: ${url}`);
  }

  // default to remix org if no owner is specified
  if (!parsed.owner) {
    parsed.owner = "remix-run";
  }

  if (!parsed.branch) {
    let res = await got(
      `https://api.github.com/repos/${parsed.owner}/${parsed.name}`
    );

    if (res.statusCode !== 200) {
      throw new Error(`Error fetching repo info for ${url}: ${res.statusCode}`);
    }

    let repo = JSON.parse(res.body.toString());
    parsed.branch = repo.default_branch;
  }

  return parsed;
}

export { createApp };
