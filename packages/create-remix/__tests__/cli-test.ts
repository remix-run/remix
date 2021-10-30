import childProcess from "child_process";
import fs from "fs-extra";
import path from "path";
import util from "util";
import semver from "semver";
import { stdin } from "mock-stdin";

const execFile = util.promisify(childProcess.execFile);

const keys = {
  up: "\x1B\x5B\x41",
  down: "\x1B\x5B\x42",
  enter: "\x0D",
  space: "\x20"
};

const createRemix = path.resolve(
  __dirname,
  "../../../build/node_modules/create-remix/cli.js"
);

describe("create-remix cli", () => {
  let io: ReturnType<typeof stdin>;
  beforeAll(async () => {
    if (!fs.existsSync(createRemix)) {
      throw new Error(`Cannot run Remix CLI tests without building Remix`);
    }
    io = stdin();
    // Bump timeout. This should be sufficient.
    jest.setTimeout(50 * 1000);
  });

  afterAll(() => {
    jest.setTimeout(5 * 1000);
    io.restore();
  });

  // NOTE: This test is timing out, unsure why :(
  it("creates the app", async done => {
    async function answerPrompts() {
      // Where would you like to create your app?
      io.send("./poop");
      await delay(50);

      // Where do you want to deploy? Choose Remix if you're unsure, it's easy
      // to change deployment targets. (Use arrow keys)
      //   ❯ Remix App Server
      //     Express Server
      //     Architect (AWS Lambda)
      //     Fly.io
      //     Netlify
      //     Vercel
      //     Cloudflare Workers
      io.send(keys.enter); // Selects 'Remix App Server'
      await delay(50);

      // TypeScript or JavaScript? (Use arrow keys)
      //   ❯ TypeScript
      //     JavaScript
      io.send(keys.enter); // Selects 'TypeScript'
      await delay(50);

      // Do you want me to run `npm install`? (Y/n)
      io.send("n");
      io.send(keys.enter);
      await delay(50);
    }

    // I'd expect `answerPrompts` to move the process from execFile along
    // quickly enough to complete the test before the timeout, but that isn't
    // currently happening and the test times out. Unsure if there's a better
    // way to simulate user input than using mock-stdin. I could also mock
    // inquirer.prompt but this approach seems like a little safer guarantee.
    let [{ stdout }] = await Promise.all([
      execFile("node", [createRemix]),
      delay(50).then(answerPrompts)
    ]);

    expect(stdout.trim()).toBe(`
💿 Created local .npmrc with Remix Registry
💿 That's it! \`cd\` into "poop" and check the README for development and deploy instructions!
`);

    // clean up
    await fs.remove(path.join(process.cwd(), "poop"));
    done();
  });

  describe("the --help flag", () => {
    it("prints help info", async () => {
      let { stdout } = await execFile("node", [createRemix, "--help"]);
      expect(stdout).toMatchInlineSnapshot(getHelp());
    });
  });

  describe("the -h flag", () => {
    it("prints help info", async () => {
      let { stdout } = await execFile("node", [createRemix, "-h"]);
      expect(stdout).toMatchInlineSnapshot(getHelp());
    });
  });

  describe("the --version flag", () => {
    it("prints the current version", async () => {
      let { stdout } = await execFile("node", [createRemix, "--version"]);
      expect(!!semver.valid(stdout.trim())).toBe(true);
    });
  });

  describe("the -v flag", () => {
    it("prints the current version", async () => {
      let { stdout } = await execFile("node", [createRemix, "-v"]);
      expect(!!semver.valid(stdout.trim())).toBe(true);
    });
  });
});

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// moved this down here b/c formatting of the long template string screws up
// syntax highlighting of everything after it for some reason :/
function getHelp(): string {
  return `
    "
      Create a new Remix app

      Usage:
        $ npx create-remix [flags...] [<dir>]

      If <dir> is not provided up front you will be prompted for it.

      Flags:
        --help, -h          Show this help message
        --version, -v       Show the version of this script

    "
  `;
}
