import stream from "stream";
import { promisify } from "util";
import path from "path";
import fse from "fs-extra";
import fetch from "node-fetch";
import gunzip from "gunzip-maybe";
import tar from "tar-fs";

import type { Lang } from ".";

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
    isRemixTemplate?: boolean;
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
        return header;
      },
      ignore(name) {
        if (options.filePath) {
          // add a trailing slash to the file path so we dont overmatch
          let absoluteFilePath =
            path.join(projectDir, options.filePath) + path.sep;
          if (options.isRemixTemplate) {
            let templateDir = path.dirname(options.filePath);
            let shared = options.lang === "js" ? "_shared_js" : "_shared_ts";
            let sharedDir = path.join(templateDir, shared);
            let sharedDirAbsolute = path.join(projectDir, sharedDir) + path.sep;

            // return true if we should IGNORE this file
            return !(
              name.startsWith(sharedDirAbsolute) ||
              name.startsWith(absoluteFilePath)
            );
          }

          // return true if we should IGNORE this file
          return !name.startsWith(absoluteFilePath);
        }

        return false;
      }
    })
  );
}
