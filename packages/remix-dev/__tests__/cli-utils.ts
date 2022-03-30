import childProcess from "child_process";
import fse from "fs-extra";
import os from "os";
import path from "path";
import util from "util";

let execFile =
  process.platform === "win32"
    ? util.promisify(childProcess.exec)
    : util.promisify(childProcess.execFile);

export const TEMP_DIR = path.join(
  fse.realpathSync(os.tmpdir()),
  `remix-tests-${Math.random().toString(32).slice(2)}`
);

beforeAll(async () => {
  await fse.remove(TEMP_DIR);
  await fse.ensureDir(TEMP_DIR);
});

afterAll(async () => {
  await fse.remove(TEMP_DIR);
});

export async function execRemix(
  args: Array<string>,
  options: Parameters<typeof execFile>[2] = {}
) {
  let result = await execFile(
    "node",
    [
      "--require",
      require.resolve("esbuild-register"),
      "--require",
      path.join(__dirname, "./msw.ts"),
      path.resolve(__dirname, "../cli.ts"),
      ...args,
    ],
    {
      cwd: TEMP_DIR,
      ...options,
      env: {
        ...process.env,
        NO_COLOR: "1",
        ...options.env,
      },
    }
  );
  return {
    ...result,
    stdout: result.stdout.replace(TEMP_DIR, "<TEMP_DIR>").trim(),
  };
}
