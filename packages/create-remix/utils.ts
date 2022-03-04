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
}
