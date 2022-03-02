import path from "path";
import { execSync } from "child_process";
import fse from "fs-extra";
import sortPackageJSON from "sort-package-json";
import { fileURLToPath } from "url";
import parseURL from "parse-github-url";
import fetch from "node-fetch";

import cliPkgJson from "./package.json";
import { downloadAndExtractRepo, extractLocalTarball } from "./utils";

export let servers: { [key: string]: string } = {
  "Architect (AWS Lambda)":
    "https://github.com/remix-run/remix/blob/main/packages/create-remix/templates/arc",
  "Cloudflare Pages":
    "https://github.com/remix-run/remix/blob/main/packages/create-remix/templates/cloudflare-pages",
  "Cloudflare Workers":
    "https://github.com/remix-run/remix/blob/main/packages/create-remix/templates/cloudflare-workers",
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
    "https://github.com/remix-run/remix/blob/main/packages/create-remix/templates/vercel",
} as const;

export type Server = typeof servers[keyof typeof servers];

export type Lang = "ts" | "js";

export interface CreateAppArgs {
  projectDir: string;
  lang: Lang;
  install: boolean;
  quiet?: boolean;
  from: string;
  githubPAT?: string;
}

export async function createApp({
  projectDir,
  install,
  quiet,
  from,
  lang,
  githubPAT = process.env.GITHUB_TOKEN,
}: CreateAppArgs) {
  let versions = process.versions;
  if (versions?.node && parseInt(versions.node) < 14) {
    throw new Error(
      `️🚨 Oops, Node v${versions.node} detected. Remix requires a Node version greater than 14.`
    );
  }

  // Create the app directory
  let relativeProjectDir = path.relative(process.cwd(), projectDir);
  let projectDirIsCurrentDir = relativeProjectDir === "";
  if (!projectDirIsCurrentDir) {
    if (fse.existsSync(projectDir)) {
      throw new Error(
        `️🚨 Oops, "${relativeProjectDir}" already exists. Please try again with a different directory.`
      );
    }
  }

  /**
   * First we'll need to determine if the template we got is
   * file on disk
   * directory on disk
   * tarball URL (github or otherwise)
   * github owner/repo
   * example in remix-run org
   * template in remix-run org
   */
  if (from.startsWith("file://")) {
    try {
      from = fileURLToPath(from);
    } catch (error) {
      throw new Error(`Unable to convert file URL to path`);
    }
  }

  if (fse.existsSync(from)) {
    if (fse.statSync(from).isDirectory()) {
      fse.copySync(from, projectDir);
    } else if (from.endsWith(".tar.gz")) {
      await extractLocalTarball(projectDir, from);
    } else {
      throw new Error(`Unable to parse the URL "${from}" as a file path.`);
    }
  } else {
    // repoURL = new URL(repoURL).toString();
    let parsed = parseURL(from);

    console.log({ parsed });

    if (!parsed) {
      throw new Error(`Invalid repo URL`);
    } else {
      // default to remix org if no owner is specified
      if (!parsed.owner) {
        parsed.owner = "remix-run";
        parsed.name = parsed.pathname;
        parsed.repo = `remix-run/remix`;
        parsed.repository = `remix-run/remix`;
      }

      // our url parser defaults the branch to master...
      if (parsed.branch === "master") {
        let url = `https://api.github.com/repos/${parsed.owner}/${parsed.name}`;
        let res = await fetch(
          url,
          githubPAT ? { headers: { Authorization: `token ${githubPAT}` } } : {}
        );

        if (res.status !== 200) {
          throw new Error(`Error fetching repo info for ${url}: ${res.status}`);
        }

        let repo = await res.json();
        parsed.branch = repo.default_branch;
      }

      let tarballURL = `https://codeload.github.com/${parsed.owner}/${parsed.name}/tar.gz/${parsed.branch}`;

      if (!quiet) {
        console.log(
          `Downloading files from repo ${from}. This might take a moment.`
        );
      }

      await downloadAndExtractRepo(projectDir, tarballURL, {
        token: githubPAT,
        lang,
        filePath: parsed.filepath,
      });
    }
  }

  let appPkg = require(path.join(projectDir, "package.json"));

  // add current versions of remix deps
  ["dependencies", "devDependencies"].forEach((pkgKey) => {
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
  await fse.writeJSON(path.join(projectDir, "package.json"), appPkg);

  let setupScripts = [
    path.resolve(projectDir, "remix.init", "index.js"),
    path.resolve(projectDir, "remix.init.js"),
  ];

  let hasSetupScript = setupScripts.some((script) => fse.existsSync(script));

  if (install) {
    execSync("npm install", { stdio: "inherit", cwd: projectDir });
    execSync("npx remix init", { stdio: "inherit", cwd: projectDir });
  } else if (from && hasSetupScript) {
    console.log(
      `You've opted out of running \`npm install\` in your new project.\nYou'll need to manually run \`npx remix init\`.`
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
