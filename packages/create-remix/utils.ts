import stream from "stream";
import { promisify } from "util";
import path from "path";
import fse from "fs-extra";
import got from "got";
import gunzip from "gunzip-maybe";
import tar from "tar-fs";

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
  token?: string
): Promise<void> {
  let desiredDir = path.basename(projectDir);
  let cwd = path.dirname(projectDir);

  await pipeline(
    got
      .stream(url, { headers: { authorization: `token ${token}` } })
      .pipe(gunzip()),
    tar.extract(cwd, {
      map(header) {
        let originalDirName = header.name.split("/")[0];
        header.name = header.name.replace(originalDirName, desiredDir);
        return header;
      }
    })
  );
}
