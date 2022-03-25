import stream from "stream";
import { promisify } from "util";
import path from "path";
import fse from "fs-extra";
import fetch from "node-fetch";
import gunzip from "gunzip-maybe";
import tar from "tar-fs";
import * as semver from "semver";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import sortPackageJSON from "sort-package-json";
import glob from "fast-glob";
import * as babel from "@babel/core";
// @ts-expect-error these modules dont have types
import babelPluginSyntaxJSX from "@babel/plugin-syntax-jsx";
// @ts-expect-error these modules dont have types
import babelPresetTypeScript from "@babel/preset-typescript";
import prettier from "prettier";

import packageJson from "../package.json";

const VALID_TEMPLATE_EXAMPLES = `
  $ remix create my-app --template /path/to/remix-template
  $ remix create my-app --template /path/to/remix-template.tar.gz
  $ remix create my-app --template remix-run/grunge-stack
  $ remix create my-app --template :username/:repo
  $ remix create my-app --template https://github.com/:username/:repo
  $ remix create my-app --template https://github.com/:username/:repo/tree/:branch
  $ remix create my-app --template https://github.com/:username/:repo/archive/refs/tags/:tag.tar.gz
  $ remix create my-app --template https://example.com/remix-template.tar.gz
`;

const HELP_TEXT = "Use `npx create-remix --help` for more info.";

const remixDevPackageVersion = packageJson.version;

interface CreateAppArgs {
  appTemplate: string;
  projectDir: string;
  remixVersion?: string;
  installDeps: boolean;
  useTypeScript: boolean;
  githubToken?: string;
}

export async function createApp({
  appTemplate,
  projectDir,
  remixVersion = remixDevPackageVersion,
  installDeps,
  useTypeScript = true,
  githubToken = process.env.GITHUB_TOKEN,
}: CreateAppArgs) {
  // Check the node version
  let versions = process.versions;
  if (versions?.node && semver.major(versions.node) < 14) {
    throw new Error(
      `️🚨 Oops, Node v${versions.node} detected. Remix requires a Node version greater than 14.`
    );
  }

  // Create the app directory
  let relativeProjectDir = path.relative(process.cwd(), projectDir);
  let projectDirIsCurrentDir = relativeProjectDir === "";
  if (!projectDirIsCurrentDir) {
    if (fse.existsSync(projectDir)) {
      console.error(
        `️🚨 Oops, "${relativeProjectDir}" already exists. Please try again with a different directory.`
      );
      process.exit(1);
    }
  }

  /**
   * Grab the template
   * First we'll need to determine if the template we got is
   * - file on disk
   * - directory on disk
   * - tarball URL (github or otherwise)
   * - github owner/repo
   * - example in remix-run org
   * - template in remix-run org
   */
  let templateType = detectTemplateType(appTemplate);
  let options = { useTypeScript, token: githubToken };
  switch (templateType) {
    case "local": {
      let filepath = appTemplate.startsWith("file://")
        ? fileURLToPath(appTemplate)
        : appTemplate;

      // We shouldn't hit this since we've should have already validated at
      // this point, but just in case...
      if (!fse.existsSync(filepath)) {
        throw new Error(`️🚨 Oops, "${filepath}" does not exist.`);
      }

      if (fse.statSync(filepath).isDirectory()) {
        await fse.copy(filepath, projectDir);
        break;
      }
      if (appTemplate.endsWith(".tar.gz")) {
        await extractLocalTarball(projectDir, filepath);
        break;
      }

      console.error(
        `🚨 Invalid file template: ${appTemplate}

File templates must either be a directory containing a Git repository or a local tarball file (*.tar.gz).

${HELP_TEXT}
`
      );
      process.exit(1);
    }
    case "remoteTarball": {
      await downloadAndExtractTarball(projectDir, appTemplate, options);
      break;
    }
    case "example":
    case "template": {
      await downloadAndExtractTemplateOrExample(
        projectDir,
        appTemplate,
        templateType,
        options
      );
      break;
    }
    case "repo": {
      await downloadAndExtractRepoTarball(
        projectDir,
        getRepoInfo(appTemplate),
        options
      );
      break;
    }
    default:
      throw new Error(
        `🚨 Unable to determine template type for "${appTemplate}"

Valid template flags may look like one of the following:${VALID_TEMPLATE_EXAMPLES}
${HELP_TEXT}
`
      );
  }

  // Update remix deps
  let pkgJsonPath = path.join(projectDir, "package.json");
  let appPkg: any;
  try {
    appPkg = require(pkgJsonPath);
  } catch (err) {
    console.error(
      `🚨 The provided template must be a Remix project with a \`package.json\` file, but that file does not exist in ${pkgJsonPath}.

${HELP_TEXT}`
    );
    process.exit(1);
  }

  ["dependencies", "devDependencies"].forEach((pkgKey) => {
    for (let dependency in appPkg[pkgKey]) {
      let version = appPkg[pkgKey][dependency];
      if (version === "*") {
        appPkg[pkgKey][dependency] = semver.prerelease(remixVersion)
          ? // Templates created from prereleases should pin to a specific version
            remixVersion
          : "^" + remixVersion;
      }
    }
  });
  appPkg = sortPackageJSON(appPkg);
  await fse.writeJSON(pkgJsonPath, appPkg, { spaces: 2 });

  if (!useTypeScript) {
    await convertTemplateToJavaScript(projectDir);
  }

  if (installDeps) {
    // TODO: use yarn/pnpm/npm
    let npmConfig = execSync("npm config get @remix-run:registry", {
      encoding: "utf8",
    });
    if (npmConfig?.startsWith("https://npm.remix.run")) {
      console.error(
        "🚨 Oops! You still have the private Remix registry configured. Please run `npm config delete @remix-run:registry` or edit your .npmrc file to remove it."
      );
      process.exit(1);
    }

    execSync("npm install", { stdio: "inherit", cwd: projectDir });
  }
}

// this is natively a promise in node 15+ stream/promises
const pipeline = promisify(stream.pipeline);

async function extractLocalTarball(
  projectDir: string,
  filePath: string
): Promise<void> {
  try {
    await pipeline(
      fse.createReadStream(filePath),
      gunzip(),
      tar.extract(projectDir, { strip: 1 })
    );
  } catch (err) {
    console.error(
      `🚨 There was a problem extracting the file from the provided template.

  Template filepath: \`${filePath}\`
  Destination directory: \`${projectDir}\`
`
    );
    process.exit(1);
  }
}

async function downloadAndExtractTemplateOrExample(
  projectDir: string,
  name: string,
  type: "template" | "example",
  options: {
    token?: string;
    useTypeScript: boolean;
  }
) {
  // appTemplate === "examples/whatever"
  if (type === "example") {
    name = name.split("/")[1];
  }

  let response: null | Awaited<ReturnType<typeof fetch>> = null;
  try {
    response = await fetch(
      "https://codeload.github.com/remix-run/remix/tar.gz/main",
      options.token
        ? { headers: { Authorization: `token ${options.token}` } }
        : {}
    );
  } catch (_) {}

  if (!response || response.status !== 200) {
    console.error(
      `🚨 There was a problem fetching the file from GitHub. ${
        response?.status
          ? `The request responded with a ${response.status} status.`
          : ""
      }

  Please ensure you are connected to the internet and try again later.`
    );
    process.exit(1);
  }

  let cwd = path.dirname(projectDir);
  let desiredDir = path.basename(projectDir);
  let templateDir = path.join(desiredDir, type + "s", name);

  try {
    await pipeline(
      response.body.pipe(gunzip()),
      tar.extract(cwd, {
        map(header) {
          let originalDirName = header.name.split("/")[0];
          header.name = header.name.replace(originalDirName, desiredDir);
          // https://github.com/remix-run/remix/issues/2356#issuecomment-1071458832
          if (path.sep === "\\") {
            templateDir = templateDir.replace("\\", "/");
          }
          if (!header.name.startsWith(templateDir + "/")) {
            header.name = "__IGNORE__";
          } else {
            header.name = header.name.replace(templateDir, desiredDir);
          }
          return header;
        },
        ignore(_filename, header) {
          if (!header) {
            throw new Error(`Header is undefined`);
          }

          return header.name === "__IGNORE__";
        },
      })
    );
  } catch (_) {
    console.error(
      `🚨 There was a problem extracting the file from the provided template.

  Template: \`${name}\`
  Destination directory: \`${cwd}\`
`
    );
    process.exit(1);
  }
}

async function downloadAndExtractRepoTarball(
  projectDir: string,
  repo: RepoInfo,
  options: {
    token?: string;
    filePath?: string | null | undefined;
  }
) {
  // If we have a direct file path we will also have the branch. We can skip the
  // redirect and get the tarball URL directly.
  if (repo.branch && repo.filePath) {
    let { filePath, tarballURL } = getTarballUrl(repo);
    return downloadAndExtractTarball(projectDir, tarballURL, {
      ...options,
      filePath,
    });
  }

  // If we don't know the branch, the GitHub API will figure out the default and
  // redirect the request to the tarball.
  // https://docs.github.com/en/rest/reference/repos#download-a-repository-archive-tar
  let url = `https://api.github.com/repos/${repo.owner}/${repo.name}/tarball`;
  if (repo.branch) {
    url += `/${repo.branch}`;
  }

  return downloadAndExtractTarball(projectDir, url, {
    ...options,
    filePath: null,
  });
}

async function downloadAndExtractTarball(
  projectDir: string,
  url: string,
  options: {
    token?: string;
    filePath?: string | null | undefined;
  }
): Promise<void> {
  let desiredDir = path.basename(projectDir);
  let response: null | Awaited<ReturnType<typeof fetch>> = null;

  try {
    response = await fetch(
      url,
      options.token
        ? { headers: { Authorization: `token ${options.token}` } }
        : {}
    );
  } catch (_) {}

  if (!response || response.status !== 200) {
    console.error(
      `🚨 There was a problem fetching the file from GitHub. ${
        response?.status
          ? `The request responded with a ${response.status} status.`
          : ""
      }

Please ensure you are connected to the internet and try again later.`
    );
    process.exit(1);
  }

  try {
    await pipeline(
      response.body.pipe(gunzip()),
      tar.extract(projectDir, {
        map(header) {
          let originalDirName = header.name.split("/")[0];
          header.name = header.name.replace(originalDirName, desiredDir);

          let templateFiles = options.filePath
            ? path.join(desiredDir, options.filePath) + path.sep
            : desiredDir + path.sep;

          // https://github.com/remix-run/remix/issues/2356#issuecomment-1071458832
          if (path.sep === "\\") {
            templateFiles = templateFiles.replace("\\", "/");
          }

          if (!header.name.startsWith(templateFiles)) {
            header.name = "__IGNORE__";
          } else {
            header.name = header.name.replace(templateFiles, "");
          }

          return header;
        },
        ignore(_filename, header) {
          if (!header) {
            throw new Error(`Header is undefined`);
          }

          return header.name === "__IGNORE__";
        },
      })
    );
  } catch (_) {
    console.error(
      `🚨 There was a problem extracting the file from the provided template.

  Template URL: \`${url}\`
  Destination directory: \`${projectDir}\`
`
    );
    process.exit(1);
  }
}

function getTarballUrl(repoInfo: RepoInfo): {
  tarballURL: string;
  filePath: string;
} {
  return {
    tarballURL: `https://codeload.github.com/${repoInfo.owner}/${repoInfo.name}/tar.gz/${repoInfo.branch}`,
    filePath: repoInfo.filePath || "/",
  };
}

interface RepoInfoWithBranch {
  url: string;
  owner: string;
  name: string;
  branch: string;
  filePath: string | null;
}

interface RepoInfoWithoutBranch {
  url: string;
  owner: string;
  name: string;
  branch: null;
  filePath: null;
}

type RepoInfo = RepoInfoWithBranch | RepoInfoWithoutBranch;

function isUrl(value: string) {
  try {
    new URL(value);
    return true;
  } catch (_) {
    return false;
  }
}

type GithubUrlString =
  | `https://github.com/${string}/${string}`
  | `https://www.github.com/${string}/${string}`;

function isValidGithubUrl(value: string | URL): value is URL | GithubUrlString {
  try {
    let url = typeof value === "string" ? new URL(value) : value;
    let pathSegments = url.pathname.slice(1).split("/");

    return (
      url.protocol === "https:" &&
      url.hostname === "github.com" &&
      // The pathname must have at least 2 segments. If it has more than 2, the
      // third must be "tree" and it must have at least 4 segments.
      // https://github.com/remix-run/remix
      // https://github.com/remix-run/remix/tree/dev
      pathSegments.length >= 2 &&
      (pathSegments.length > 2
        ? pathSegments[2] === "tree" && pathSegments.length >= 4
        : true)
    );
  } catch (_) {
    return false;
  }
}

function isGithubRepoShorthand(value: string) {
  return /^[\w-]+\/[\w-]+$/.test(value);
}

function getGithubUrl(info: Omit<RepoInfo, "url">) {
  let url = `https://github.com/${info.owner}/${info.name}`;
  if (info.branch) {
    url += `/${info.branch}`;
    if (info.filePath && info.filePath !== "/") {
      url += `/${info.filePath}`;
    }
  }
  return url;
}

function getRepoInfo(validatedGithubUrl: string): RepoInfo {
  if (isGithubRepoShorthand(validatedGithubUrl)) {
    let [owner, name] = validatedGithubUrl.split("/");
    return {
      url: getGithubUrl({ owner, name, branch: null, filePath: null }),
      owner,
      name,
      branch: null,
      filePath: null,
    };
  }

  let url = new URL(validatedGithubUrl);
  let [, owner, name, tree, branch, ...file] = url.pathname.split("/") as [
    _: string,
    Owner: string,
    Name: string,
    Tree: string | undefined,
    Branch: string | undefined,
    FileInfo: string | undefined
  ];
  let filePath = file.join(path.sep);

  if (tree === undefined) {
    return {
      url: validatedGithubUrl,
      owner,
      name,
      branch: null,
      filePath: null,
    };
  }

  return {
    url: validatedGithubUrl,
    owner,
    name,
    // If we've validated the GitHub URL and there is a tree, there will also be a branch
    branch: branch!,
    filePath: filePath === "" || filePath === "/" ? null : filePath,
  };
}

type TemplateType =
  // in the remix repo
  | "template"
  // in the remix repo
  | "example"
  // a github repo
  | "repo"
  // remote tarball url
  | "remoteTarball"
  // local directory
  | "local";

function detectTemplateType(template: string): TemplateType {
  // 1. Check if the user passed a local file. If they hand us an explicit file
  //    URL, we'll validate it first. Otherwise we just ping the filesystem to
  //    see if the string references a filepath and, if not, move on.
  if (template.startsWith("file://")) {
    try {
      template = fileURLToPath(template);
      if (!fse.existsSync(template)) {
        throw Error();
      }
      return "local";
    } catch (_) {
      console.error(`️🚨 Oops, the file "${template}" does not exist.`);
      process.exit(1);
    }
  }

  try {
    if (
      fse.existsSync(
        path.isAbsolute(template)
          ? template
          : path.resolve(process.cwd(), template)
      )
    ) {
      return "local";
    }
  } catch (_) {
    // ignore FS errors and move on
  }

  // 3. examples/<template> will use an example folder in the Remix repo
  if (/^examples?\/[\w-]+$/.test(template)) {
    return "example";
  }

  // 2. If the string contains no slashes, spaces, or special chars, we assume
  //    it is one of our templates.
  if (/^[\w-]+$/.test(template)) {
    return "template";
  }

  // 4. Handle GitHub repos (URLs or :org/:repo shorthand)
  if (isValidGithubUrl(template) || isGithubRepoShorthand(template)) {
    return "repo";
  }

  // 4. Any other valid URL should be treated as a tarball.
  if (isUrl(template)) {
    return "remoteTarball";
  }

  console.error(
    `🚨 Invalid template: \`${template}\`

Valid template flags may look like:${VALID_TEMPLATE_EXAMPLES}
${HELP_TEXT}
`
  );
  process.exit(1);
}

function convertToJavaScript(
  filename: string,
  source: string,
  projectDir: string
): string {
  let result = babel.transformSync(source, {
    filename,
    presets: [[babelPresetTypeScript, { jsx: "preserve" }]],
    plugins: [babelPluginSyntaxJSX],
    compact: false,
    retainLines: true,
    cwd: projectDir,
  });

  if (!result || !result.code) {
    throw new Error("Could not parse typescript");
  }

  /*
    Babel's `compact` and `retainLines` options are both bad at formatting code.
    Use Prettier for nicer formatting.
  */
  return prettier.format(result.code, { parser: "babel" });
}

async function convertTemplateToJavaScript(projectDir: string) {
  // 1. Convert all .ts files in the template to .js
  let entries = glob.sync("**/*.+(ts|tsx)", {
    cwd: projectDir,
    absolute: true,
  });
  for (let entry of entries) {
    if (entry.endsWith(".d.ts")) {
      fse.removeSync(entry);
      continue;
    }

    let contents = fse.readFileSync(entry, "utf8");
    let filename = path.basename(entry);
    let javascript = convertToJavaScript(filename, contents, projectDir);

    fse.writeFileSync(entry, javascript, "utf8");
    if (entry.endsWith(".tsx")) {
      fse.renameSync(entry, entry.replace(/\.tsx?$/, ".jsx"));
    } else {
      fse.renameSync(entry, entry.replace(/\.ts?$/, ".js"));
    }
  }

  // 2. Rename the tsconfig.json to jsconfig.json
  if (fse.existsSync(path.join(projectDir, "tsconfig.json"))) {
    fse.renameSync(
      path.join(projectDir, "tsconfig.json"),
      path.join(projectDir, "jsconfig.json")
    );
  }

  // 3. Remove @types/* and typescript from package.json
  let packageJson = path.join(projectDir, "package.json");
  if (!fse.existsSync(packageJson)) {
    throw new Error("Could not find package.json");
  }
  let pkg = JSON.parse(fse.readFileSync(packageJson, "utf8"));
  let devDeps = pkg.devDependencies || {};
  let newPackageJson = {
    ...pkg,
    devDependencies: Object.fromEntries(
      Object.entries(devDeps).filter(([name]) => {
        return !name.startsWith("@types/") && name !== "typescript";
      })
    ),
  };
  // 4. Remove typecheck npm script from package.json
  if (pkg.scripts && pkg.scripts.typecheck) {
    delete pkg.scripts.typecheck;
  }
  fse.writeJSONSync(path.join(projectDir, "package.json"), newPackageJson, {
    spaces: 2,
  });
}
