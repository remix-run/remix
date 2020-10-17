import childProcess from "child_process";
import fs from "fs";
import path from "path";
import util from "util";

const execFile = util.promisify(childProcess.execFile);

describe("remix cli", () => {
  let remix = path.resolve(
    __dirname,
    "../../../build/node_modules/@remix-run/cli"
  );

  beforeAll(() => {
    if (!fs.existsSync(remix)) {
      throw new Error(`Cannot run Remix CLI tests w/out building Remix`);
    }
  });

  describe("the --help flag", () => {
    it("prints help info", async () => {
      let { stdout } = await execFile("node", [remix, "--help"]);
      expect(stdout).toMatchInlineSnapshot(`
        "
          Usage
            $ remix build [remixRoot]
            $ remix run [remixRoot]

          Options
            --help              Print this help message and exit
            --version, -v       Print the CLI version and exit

          Examples
            $ remix build my-website
            $ remix run my-website

        "
      `);
    });
  });

  describe("the --version flag", () => {
    it("prints the current version", async () => {
      let { stdout } = await execFile("node", [remix, "--version"]);
      expect(stdout.trim()).toEqual(expect.stringMatching(/^\d+\.\d+\.\d+$/));
    });
  });

  describe("the -v flag", () => {
    it("prints the current version", async () => {
      let { stdout } = await execFile("node", [remix, "-v"]);
      expect(stdout.trim()).toEqual(expect.stringMatching(/^\d+\.\d+\.\d+$/));
    });
  });
});
