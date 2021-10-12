import childProcess from "child_process";
import fs from "fs";
import path from "path";
import util from "util";
import semver from "semver";

const execFile = util.promisify(childProcess.execFile);

const remix = path.resolve(
  __dirname,
  "../../../build/node_modules/@remix-run/dev/cli"
);

describe("remix cli", () => {
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
            $ remix dev [remixRoot]
            $ remix setup [remixPlatform]

          Options
            --help              Print this help message and exit
            --version, -v       Print the CLI version and exit

          Values
            [remixPlatform]     \\"node\\" is currently the only platform

          Examples
            $ remix build my-website
            $ remix dev my-website
            $ remix setup node

        "
      `);
    });
  });

  describe("the --version flag", () => {
    it("prints the current version", async () => {
      let { stdout } = await execFile("node", [remix, "--version"]);
      expect(!!semver.valid(stdout.trim())).toBe(true);
    });
  });

  describe("the -v flag", () => {
    it("prints the current version", async () => {
      let { stdout } = await execFile("node", [remix, "-v"]);
      expect(!!semver.valid(stdout.trim())).toBe(true);
    });
  });
});
