import stream from "stream";
import { promisify } from "util";
import path from "path";
import { fileURLToPath } from "url";
import fse from "fs-extra";
import fetch from "node-fetch";
import gunzip from "gunzip-maybe";
import tar from "tar-fs";

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

export async function downloadAndExtractTemplateOrExample(
  projectDir: string,
  name: string,
  type: "templates" | "examples",
  options: {
    token?: string;
    lang: Lang;
  }
) {
  let response = await fetch(
    type === "templates"
      ? "https://codeload.github.com/remix-run/remix/tar.gz/logan/support-remote-repos-in-create-remix"
      : "https://codeload.github.com/remix-run/remix/tar.gz/main",
    options.token
      ? { headers: { Authorization: `token ${options.token}` } }
      : {}
  );

  if (response.status !== 200) {
    throw new Error(`Error fetching repo: ${response.status}`);
  }

  let cwd = path.dirname(projectDir);
  let desiredDir = path.basename(projectDir);
  let exampleOrTemplateName =
    type === "templates" && options.lang === "ts" ? `${name}-ts` : name;
  let templateDir = path.join(desiredDir, type, exampleOrTemplateName);
  await pipeline(
    response.body.pipe(gunzip()),
    tar.extract(cwd, {
      map(header) {
        let originalDirName = header.name.split("/")[0];
        header.name = header.name.replace(originalDirName, desiredDir);
        if (!header.name.startsWith(templateDir + path.sep)) {
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
}

export async function downloadAndExtractTarball(
  projectDir: string,
  url: string,
  options: {
    token?: string;
    lang: Lang;
    filePath?: string | null | undefined;
    strip?: number;
  }
): Promise<void> {
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
    tar.extract(projectDir, {
      strip:
        options.strip ??
        (options.filePath ? options.filePath.split("/").length + 1 : 1),
      ignore(name) {
        if (options.filePath) {
          return !name.startsWith(path.join(cwd, options.filePath));
        } else {
          return false;
        }
      },
    })
  );
}

export async function getTarballUrl(
  from: string,
  token?: string | undefined
): Promise<{ tarballURL: string; filePath: string }> {
  let info = await getRepoInfo(from, token);

  if (!info) {
    throw new CreateRemixError(`Could not find repo: ${from}`);
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
    if (url.hostname !== "github.com") {
      return;
    }

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

    return;
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
      // invalid url, but we can try to match a template or example
      return undefined;
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
  let possibleTemplateName = lang === "ts" ? `${name}-ts` : name;
  let template = results.find((result: any) => {
    return result.name === possibleTemplateName;
  });
  if (!template) return undefined;
  return template.name;
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
  return example.name;
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

export async function detectTemplateType(
  from: string,
  lang: Lang,
  token?: string
): Promise<TemplateType> {
  if (from.startsWith("file://")) return "local";
  if (fse.existsSync(from)) return "local";

  let template = await isRemixTemplate(from, lang, token);
  if (template) return "template";

  let example = await isRemixExample(from, token);
  if (example) return "example";

  let info = await getRepoInfo(from, token);
  if (info) return "repo";

  return "remoteTarball";
}
