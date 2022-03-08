import stream from "stream";
import { promisify } from "util";
import path from "path";
import { execSync } from "child_process";
import fse from "fs-extra";
import fetch from "node-fetch";
import gunzip from "gunzip-maybe";
import tar from "tar-fs";
import fs from "fs";
import glob from "glob";
import babel from "@babel/core";
// @ts-expect-error
import babelPresetTS from "@babel/preset-typescript";

import type { Lang } from ".";

export class CreateRemixError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CreateRemixError";
  }
}

// this is natively a promise in node 15+ stream/promises
let pipeline = promisify(stream.pipeline);

export async function extractLocalTarball(
  projectDir: string,
  filePath: string
): Promise<void> {
  let readStream = fse.createReadStream(filePath).pipe(gunzip());
  let writeStream = tar.extract(projectDir);
  await pipeline(readStream, writeStream);
}

export async function downloadAndExtractRepo(
  projectDir: string,
  url: string,
  options: {
    token?: string;
    lang: Lang;
    filePath?: string | null | undefined;
  }
): Promise<void> {
  let desiredDir = path.basename(projectDir);
  let cwd = path.dirname(projectDir);

  let response = await fetch(
    url,
    options.token
      ? { headers: { Authorization: `token ${options.token}` } }
      : {}
  );

  if (response.status !== 200) {
    throw new Error(`Error fetching repo: ${response.status}`);
  }

  await pipeline(
    response.body.pipe(gunzip()),
    tar.extract(cwd, {
      map(header) {
        let originalDirName = header.name.split("/")[0];
        header.name = header.name.replace(originalDirName, desiredDir);
        if (options.filePath) {
          // add a trailing slash to the file path so we dont overmatch
          if (
            header.name.startsWith(
              path.join(desiredDir, options.filePath) + path.sep
            )
          ) {
            header.name = header.name.replace(options.filePath + path.sep, "");
          } else {
            header.name = "__IGNORE__" + header.name;
          }
        }

        return header;
      },
      ignore(name, header) {
        // name is the original projectDir, but
        // we need the header's name as we changed it above
        // to point to their desired dir
        if (options.filePath) {
          if (!header) {
            throw new Error(`missing header for file ${name}`);
          }

          // return true if we should IGNORE this file
          if (header.name.startsWith("__IGNORE__")) {
            return true;
          }
        }

        return false;
      },
    })
  );

  if (options.lang === "js") {
    convertToJavaScript(projectDir);
    if (fse.existsSync(path.join(projectDir, "tsconfig.json"))) {
      fse.renameSync(
        path.join(projectDir, "tsconfig.json"),
        path.join(projectDir, "jsconfig.json")
      );
    }
    execSync(`npm run format --if-present`, { cwd: projectDir });
  }
}

export async function getTarballUrl(
  from: string,
  lang: Lang,
  token?: string | undefined
) {
  let template = await isRemixTemplate(from, lang, token);

  if (template) {
    return {
      // TODO: change branch ref to main before merge
      tarballURL: `https://codeload.github.com/remix-run/remix/tar.gz/logan/support-remote-repos-in-create-remix`,
      filePath: `templates/${from}`,
    };
  }

  let example = await isRemixExample(from, token);
  if (example) {
    return {
      tarballURL: `https://codeload.github.com/remix-run/remix/tar.gz/main`,
      filePath: `examples/${from}`,
    };
  }

  let info = await getRepoInfo(from, token);

  if (!info) {
    throw new Error(`Could not find repo ${from}`);
  }

  return {
    tarballURL: `https://codeload.github.com/${info.owner}/${info.name}/tar.gz/${info.branch}`,
    filePath: info.filePath,
  };
}

interface RepoInfo {
  owner: string;
  name: string;
  branch: string;
  filePath: string;
}

export async function getRepoInfo(
  from: string,
  token?: string | undefined
): Promise<RepoInfo | undefined> {
  try {
    let url = new URL(from);
    let [, owner, name, t, branch, ...file] = url.pathname.split("/");

    if (t === undefined) {
      let temp = await getDefaultBranch(`${owner}/${name}`, token);
      if (temp) {
        branch = temp;
      }
    }

    if (owner && name && branch && t === "tree") {
      return { owner, name, branch, filePath: file.join("/") };
    }
  } catch (error: unknown) {
    // invalid url, but it could be a github shorthand for
    // :owner/:repo
    try {
      let parts = from.split("/");
      if (parts.length === 1) {
        parts.unshift("remix-run");
      }
      let [owner, name] = parts;
      let branch = await getDefaultBranch(`${owner}/${name}`, token);
      return { owner, name, branch, filePath: "" };
    } catch (error) {
      throw new CreateRemixError(`Unable to parse the URL "${from}" as a URL.`);
    }
  }
}

async function getDefaultBranch(
  repo: string,
  token: string | undefined
): Promise<string> {
  const response = await fetch(`https://api.github.com/repos/${repo}`, {
    headers: {
      Authorization: token ? `token ${token}` : "",
      Accept: "application/vnd.github.v3+json",
    },
  });

  if (response.status !== 200) {
    throw new CreateRemixError(`Error fetching repo: ${response.status}`);
  }

  let info = await response.json();
  return info.default_branch;
}

export async function isRemixTemplate(
  name: string,
  lang: Lang,
  token?: string
): Promise<string | undefined> {
  // TODO: remove `?ref` before we merge
  let promise = await fetch(
    `https://api.github.com/repos/remix-run/remix/contents/templates?ref=logan/support-remote-repos-in-create-remix`,
    {
      headers: {
        Accept: "application/vnd.github.v3+json",
        Authorization: token ? `token ${token}` : "",
      },
    }
  );
  if (!promise.ok) {
    throw new CreateRemixError(`Error fetching repo: ${promise.status}`);
  }
  let results = await promise.json();
  let template = results.find((result: any) => result.name === name);
  if (!template) return undefined;
  return template.html_url;
}

export async function isRemixExample(name: string, token?: string) {
  // TODO: remove `?ref` before we merge
  let promise = await fetch(
    `https://api.github.com/repos/remix-run/remix/contents/examples?ref=main`,
    {
      headers: {
        Accept: "application/vnd.github.v3+json",
        Authorization: token ? `token ${token}` : "",
      },
    }
  );
  if (!promise.ok) {
    throw new CreateRemixError(`Error fetching repo: ${promise.status}`);
  }
  let results = await promise.json();
  let example = results.find((result: any) => result.name === name);
  if (!example) return undefined;
  return example.html_url;
}

// Compiles away all TS from TS(X) files and renames them to .js
function convertToJavaScript(projectDir: string) {
  glob
    .sync(path.join(projectDir, "app/**/*.+(ts|tsx)"), {
      ignore: ["*.d.ts"],
    })
    .forEach((filepath) => {
      let contents = fs.readFileSync(filepath, { encoding: "utf-8" });
      let result = babel.transformSync(contents, {
        babelrc: false,
        presets: [babelPresetTS],
        filename: filepath,
      });

      if (!result?.code) {
        console.log(`🚨 Error compiling ${filepath}`);
        return;
      }

      fs.writeFileSync(filepath, result.code);
      fs.renameSync(filepath, filepath.replace(/\.ts$/, ".js"));
      fs.renameSync(filepath, filepath.replace(/\.tsx$/, ".jsx"));
    });
}
