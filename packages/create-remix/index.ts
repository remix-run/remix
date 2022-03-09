import path from "path";
import { execSync } from "child_process";
import fse from "fs-extra";
import sortPackageJSON from "sort-package-json";
import { fileURLToPath } from "url";

import cliPkgJson from "./package.json";
import {
  CreateRemixError,
  downloadAndExtractTarball,
  downloadAndExtractTemplateOrExample,
  extractLocalTarball,
  getTarballUrl,
  isRemixExample,
  isRemixTemplate,
} from "./utils";

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
    throw new CreateRemixError(
      `️🚨 Oops, Node v${versions.node} detected. Remix requires a Node version greater than 14.`
    );
  }

  // Create the app directory
  let relativeProjectDir = path.relative(process.cwd(), projectDir);
  let projectDirIsCurrentDir = relativeProjectDir === "";
  if (!projectDirIsCurrentDir) {
    if (fse.existsSync(projectDir)) {
      throw new CreateRemixError(
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
    } catch (error: unknown) {
      throw new CreateRemixError(`Unable to convert file URL to path`);
    }
  }

  if (fse.existsSync(from)) {
    if (fse.statSync(from).isDirectory()) {
      await fse.copy(from, projectDir);
    } else if (from.endsWith(".tar.gz")) {
      await extractLocalTarball(projectDir, from);
    } else {
      throw new CreateRemixError(
        `Unable to parse the URL "${from}" as a file path.`
      );
    }
  } else {
    let parsed = await getTarballUrl(from, githubPAT);
    console.log({ parsed });

    if (parsed) {
      if (!quiet) {
        console.log(`Downloading files. This might take a moment.`);
      }
      await downloadAndExtractTarball(projectDir, parsed.tarballURL, {
        token: githubPAT,
        lang,
        filePath: parsed.filePath,
      });
    } else {
      let template = await isRemixTemplate(from, lang, githubPAT);
      console.log({ template });
      if (template) {
        if (!quiet) {
          console.log(`Downloading files. This might take a moment.`);
        }
        await downloadAndExtractTemplateOrExample(
          projectDir,
          template,
          "templates",
          { lang, token: githubPAT }
        );
      }

      let example = await isRemixExample(from, githubPAT);
      console.log({ example });
      if (example) {
        if (!quiet) {
          console.log(`Downloading files. This might take a moment.`);
        }
        await downloadAndExtractTemplateOrExample(
          projectDir,
          example,
          "examples",
          { lang, token: githubPAT }
        );
      }

      await downloadAndExtractTarball(projectDir, from, {
        token: githubPAT,
        lang,
        filePath: "",
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

  let setupScriptDir = path.join(projectDir, "remix.init");

  let setupScript = path.resolve(setupScriptDir, "index.js");
  let rootSetupScript = path.resolve(projectDir, "remix.init.js");

  let hasSetupScript = fse.existsSync(setupScript);
  let hasRootSetupScript = fse.existsSync(rootSetupScript);

  if (install) {
    execSync("npm install", { stdio: "inherit", cwd: projectDir });
    if (hasSetupScript || hasRootSetupScript) {
      try {
        execSync("npx remix init", { stdio: "inherit", cwd: projectDir });
        if (hasSetupScript) {
          fse.removeSync(setupScriptDir);
        } else if (hasRootSetupScript) {
          fse.removeSync(rootSetupScript);
        }
      } catch (error: unknown) {
        console.error("🚨  Error running `remix.init`");
      }
    }
  } else if (from && hasSetupScript) {
    console.log(
      `You've opted out of running \`npm install\`.\nYou'll need to manually run \`npx remix init\`.`
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
