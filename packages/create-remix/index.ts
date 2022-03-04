import path from "path";
import { execSync } from "child_process";
import fse from "fs-extra";
import sortPackageJSON from "sort-package-json";
import { fileURLToPath } from "url";
import fetch from "node-fetch";

import cliPkgJson from "./package.json";
import { downloadAndExtractRepo, extractLocalTarball } from "./utils";

export type Server =
  | "arc"
  | "cloudflare-pages"
  | "cloudflare-workers"
  | "deno"
  | "express"
  | "fly"
  | "netlify"
  | "remix"
  | "vercel";

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
      await fse.copy(from, projectDir);
    } else if (from.endsWith(".tar.gz")) {
      await extractLocalTarball(projectDir, from);
    } else {
      throw new Error(`Unable to parse the URL "${from}" as a file path.`);
    }
  } else {
    let template = await isRemixTemplate(from, lang);
    let tarballURL: string = from;
    let examplePath: string = "";

    if (template) {
      console.log("🚀 Using Remix template:", template);
      let possibleTemplateName = lang === "ts" ? `${from}-ts` : from;
      examplePath = `templates/${possibleTemplateName}`;
      tarballURL = `https://codeload.github.com/remix-run/remix/tar.gz/logan/support-remote-repos-in-create-remix`;
      from = template;
    } else {
      let example = await isRemixExample(from);
      if (example) {
        console.log("🚀 Using Remix example:", example);
        examplePath = `examples/${from}`;
        tarballURL = `https://codeload.github.com/remix-run/remix/tar.gz/logan/support-remote-repos-in-create-remix`;
        from = example;
      } else {
        console.log("cloning third party tarball");
        let url: URL;
        try {
          url = new URL(from);
          if (url.hostname === "github.com") {
            let [, username, name, t, branch, ...file] =
              url.pathname.split("/");
            console.log({
              username,
              name,
              t,
              branch,
              file,
            });
          }
        } catch (error) {
          // invalid url, but it could be a github shorthand for
          // :owner/:repo
          url = new URL(from, "https://github.com");
          tarballURL = `https://codeload.github.com/${from}/tar.gz/main`;
        }
      }
    }

    // if (!parsed.ref) {
    //   let url = `https://api.github.com/repos/${parsed.owner}/${parsed.name}`;
    //   let res = await fetch(
    //     url,
    //     githubPAT ? { headers: { Authorization: `token ${githubPAT}` } } : {}
    //   );

    //   if (res.status !== 200) {
    //     throw new Error(`Error fetching repo info for ${url}: ${res.status}`);
    //   }

    //   let repo = await res.json();
    //   parsed.ref = repo.default_branch;
    // }

    if (!quiet) {
      console.log(
        `Downloading files from repo ${from}. This might take a moment.`
      );
    }

    console.log({
      tarballURL,
      examplePath,
    });

    await downloadAndExtractRepo(projectDir, tarballURL, {
      token: githubPAT,
      lang,
      filePath: examplePath,
    });
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

async function isRemixTemplate(
  name: string,
  lang: Lang
): Promise<string | undefined> {
  // TODO: remove `?ref` before we merge
  let promise = await fetch(
    `https://api.github.com/repos/remix-run/remix/contents/templates?ref=logan/support-remote-repos-in-create-remix`,
    {
      headers: {
        Accept: "application/vnd.github.v3+json",
      },
    }
  );
  let results = await promise.json();
  let possibleTemplateName = lang === "ts" ? `${name}-ts` : name;
  console.log({ possibleTemplateName });

  let template = results.find(
    (result: any) => result.name === possibleTemplateName
  );
  if (!template) return undefined;
  return template.html_url;
}

async function isRemixExample(name: string) {
  // TODO: remove `?ref` before we merge
  let promise = await fetch(
    `https://api.github.com/repos/remix-run/remix/contents/examples?ref=logan/support-remote-repos-in-create-remix`,
    {
      headers: {
        Accept: "application/vnd.github.v3+json",
      },
    }
  );
  let results = await promise.json();
  let example = results.find((result: any) => result.name === name);
  if (!example) return undefined;
  return example.html_url;
}
