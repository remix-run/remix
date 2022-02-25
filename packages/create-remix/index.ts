import path from "path";
import { execSync } from "child_process";
import fse from "fs-extra";
import sortPackageJSON from "sort-package-json";
import { URL, fileURLToPath } from "url";
import parseURL from "parse-github-url";
import got from "got";

import cliPkgJson from "./package.json";
import { downloadAndExtractRepo, extractLocalTarball } from "./utils";

export let servers: { [key: string]: string } = {
  "Architect (AWS Lambda)":
    "https://github.com/remix-run/remix/blob/logan/support-remote-repos-in-create-remix/templates/arc",
  "Cloudflare Pages":
    "https://github.com/remix-run/remix/blob/logan/support-remote-repos-in-create-remix/templates/cloudflare-workers",
  "Cloudflare Workers":
    "https://github.com/remix-run/remix/blob/logan/support-remote-repos-in-create-remix/templates/cloudflare-pages",
  "Deno (experimental)":
    "https://github.com/remix-run/remix/blob/logan/support-remote-repos-in-create-remix/templates/deno",
  "Express Server":
    "https://github.com/remix-run/remix/blob/logan/support-remote-repos-in-create-remix/templates/express",
  "Fly.io":
    "https://github.com/remix-run/remix/blob/logan/support-remote-repos-in-create-remix/templates/fly",
  Netlify:
    "https://github.com/remix-run/remix/blob/logan/support-remote-repos-in-create-remix/templates/netlify",
  "Remix App Server":
    "https://github.com/remix-run/remix/blob/logan/support-remote-repos-in-create-remix/templates/remix",
  Vercel:
    "https://github.com/remix-run/remix/blob/logan/support-remote-repos-in-create-remix/templates/vercel"
} as const;

export type Server = typeof servers[keyof typeof servers];

export type Lang = "ts" | "js";

export interface CreateAppArgs {
  projectDir: string;
  lang: Lang;
  install: boolean;
  quiet?: boolean;
  repoURL: string;
  githubPAT?: string;
}

export async function createApp({
  projectDir,
  install,
  quiet,
  repoURL,
  lang,
  githubPAT = process.env.GITHUB_TOKEN
}: CreateAppArgs) {
  console.log({
    projectDir,
    install,
    quiet,
    repoURL,
    lang,
    githubPAT
  });

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
   * tarball URL (github or otherwise)
   * github owner/repo
   * example in remix-run org
   * template in remix-run org
   * file on disk
   * directory on disk
   */

  if (repoURL.startsWith("file://")) {
    try {
      repoURL = fileURLToPath(repoURL);
    } catch (error) {
      throw new Error(`Unable to convert file URL to path`);
    }
  } else if (fse.existsSync(repoURL)) {
    if (fse.statSync(repoURL).isDirectory()) {
      if (!quiet) {
        console.log(`Copying files from ${repoURL}, this might take a moment.`);
      }
      fse.copySync(repoURL, projectDir);
    } else if (repoURL.endsWith(".tar.gz")) {
      if (!quiet) {
        console.log(
          `Extracting files from local tarball ${repoURL}. This might take a moment.`
        );
      }
      await extractLocalTarball(projectDir, repoURL);
    } else {
      throw new Error(`2. Unable to parse the URL "${repoURL}" as a file URL.`);
    }
  } else {
    repoURL = new URL(repoURL).toString();
    let parsed = parseURL(repoURL);
    if (!parsed) {
      throw new Error(`Invalid repo URL`);
    } else {
      // default to remix org if no owner is specified
      if (!parsed.owner) {
        parsed.owner = "remix-run";
        parsed.name = parsed.pathname;
        parsed.repo = `remix-run/${parsed.name}`;
        parsed.repository = `remix-run/${parsed.name}`;
      }

      if (!parsed.branch) {
        let url = `https://api.github.com/repos/${parsed.owner}/${parsed.name}`;
        let res = await got(url, {
          headers: { authorization: `token ${githubPAT}` }
        });

        if (res.statusCode !== 200) {
          throw new Error(
            `Error fetching repo info for ${url}: ${res.statusCode}`
          );
        }

        let repo = JSON.parse(res.body.toString());
        parsed.branch = repo.default_branch;
      }

      console.log({ parsed });

      let tarballURL = `https://codeload.github.com/${parsed.owner}/${parsed.name}/tar.gz/${parsed.branch}`;

      if (!quiet) {
        console.log(
          `Downloading files from repo ${repoURL}. This might take a moment.`
        );
      }

      await downloadAndExtractRepo(projectDir, tarballURL, githubPAT);
    }

    throw new Error("Invalid repo URL");
  }

  let appPkg = require(path.join(projectDir, "package.json"));

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
      execSync("npm install", { stdio: "inherit", cwd: setupScriptDir });
      try {
        let init = require(setupScript);
        await init({ rootDirectory: projectDir });
        fse.removeSync(setupScriptDir);
      } catch (error) {
        console.error(
          `⚠️  Error running \`remix.init\`. We've kept the \`remix.init\` directory around so you can fix it and rerun "npx remix init".\n\n`
        );
        console.error(error);
      }
    }
  } else if (repoURL && hasSetupScript) {
    console.log(
      `\n\n You've opted out of running \`npm install\` in your new project.\n\n You'll need to manually install dependencies in the \`${setupScriptDir}\` directory and run \`npx remix init\`.\n\n`
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
