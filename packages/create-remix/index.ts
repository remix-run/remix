import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import fse from "fs-extra";
import sortPackageJSON from "sort-package-json";

import cliPkgJson from "./package.json";
import {
  CreateRemixError,
  detectTemplateType,
  downloadAndExtractTarball,
  downloadAndExtractTemplateOrExample,
  extractLocalTarball,
  getTarballUrl,
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
  let templateType = await detectTemplateType(from, lang, githubPAT);
  let options = { lang, token: githubPAT };
  switch (templateType) {
    case "local": {
      let filepath = from.startsWith("file://") ? fileURLToPath(from) : from;
      if (!fse.existsSync(filepath)) {
        throw new CreateRemixError(`️🚨 Oops, "${filepath}" does not exist.`);
      }
      if (fse.statSync(filepath).isDirectory()) {
        await fse.copy(filepath, projectDir);
        break;
      }
      if (from.endsWith(".tar.gz")) {
        await extractLocalTarball(projectDir, filepath);
        break;
      }
    }
    case "remoteTarball": {
      await downloadAndExtractTarball(projectDir, from, {
        ...options,
        strip: 2,
      });
      break;
    }
    case "example": {
      await downloadAndExtractTemplateOrExample(
        projectDir,
        from,
        "examples",
        options
      );
      break;
    }
    case "template": {
      await downloadAndExtractTemplateOrExample(
        projectDir,
        from,
        "templates",
        options
      );
      break;
    }
    case "repo": {
      let { filePath, tarballURL } = await getTarballUrl(from, githubPAT);
      await downloadAndExtractTarball(projectDir, tarballURL, {
        ...options,
        filePath,
      });
      break;
    }
    default:
      throw new CreateRemixError(
        `Unable to determine template type for "${from}"`
      );
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
        const remixDev = path.resolve(
          projectDir,
          "node_modules/@remix-run/dev/cli.js"
        );

        execSync(`node ${remixDev} init`, {
          stdio: "inherit",
          cwd: projectDir,
        });
        if (hasSetupScript) {
          fse.removeSync(setupScriptDir);
        } else if (hasRootSetupScript) {
          fse.removeSync(rootSetupScript);
        }
      } catch (error: unknown) {
        throw new Error("🚨 Error running `remix.init`");
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
