import os from "os";
import path from "path";
import fse from "fs-extra";

export default async <Result>(
  fixture: string,
  callback: (projectDir: string) => Promise<Result>
): Promise<Result> => {
  let TEMP_DIR = path.join(
    fse.realpathSync(os.tmpdir()),
    `remix-tests-${Math.random().toString(32).slice(2)}`
  );

  let projectDir = path.join(TEMP_DIR);
  await fse.remove(TEMP_DIR);
  await fse.ensureDir(TEMP_DIR);
  fse.copySync(fixture, projectDir);
  try {
    let result = await callback(projectDir);
    return result;
  } finally {
    await fse.remove(TEMP_DIR);
  }
};
