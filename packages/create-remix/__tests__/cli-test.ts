import childProcess from "child_process";
import fs from "fs-extra";
import path from "path";
import util from "util";
import semver from "semver";
import stripAnsi from "strip-ansi";

const DEFAULT_APP_NAME = "my-remix-app";

const execFile = util.promisify(childProcess.execFile);
const spawn = childProcess.spawn;

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

const DEFAULT_JEST_TIMEOUT = 5000;

describe("create-remix cli", () => {
  beforeAll(() => {
    jest.setTimeout(DEFAULT_JEST_TIMEOUT * 3);
    if (!fs.existsSync(createRemix)) {
      // TODO: Consider runnuing the build here instead of throwing
      throw new Error(`Cannot run Remix CLI tests without building Remix`);
    }
  });

  afterAll(() => {
    jest.setTimeout(DEFAULT_JEST_TIMEOUT);
  });

  // TODO: Rewrite this test
  it.skip("guides the user through the process", async done => {
    let cli = spawn("node", [createRemix], {});
    let promptCount = 0;
    let previousPrompt: string;

    cli.stdout.on("data", async data => {
      let prompt = cleanPrompt(data);
      if (
        !prompt ||
        prompt === "R E M I X" ||
        isSamePrompt(prompt, previousPrompt)
      ) {
        return;
      }

      promptCount++;

      switch (promptCount) {
        case 1:
          expect(prompt).toEqual(
            "💿 Welcome to Remix! Let's get you set up with a new project."
          );
          break;
        case 2:
          expect(prompt).toEqual(
            `? Where would you like to create your app? (./${DEFAULT_APP_NAME})`
          );
          cli.stdin.write(keys.enter);
          break;

        case 3:
          // Where do you want to deploy? Choose Remix if you're unsure, it's
          // easy to change deployment targets.
          expect(getPromptChoices(prompt)).toEqual([
            "Remix App Server",
            "Express Server",
            "Architect (AWS Lambda)",
            "Fly.io",
            "Netlify",
            "Vercel",
            "Cloudflare Workers",
            "Cloudflare Pages"
          ]);
          cli.stdin.write(keys.enter);
          break;

        case 4:
          // TypeScript or JavaScript?
          expect(getPromptChoices(prompt)).toEqual([
            "TypeScript",
            "JavaScript"
          ]);
          cli.stdin.write(keys.enter);
          break;

        case 5:
          expect(prompt).toEqual(
            "? Do you want me to run `npm install`? (Y/n)"
          );
          cli.stdin.write("n");

          // At this point the CLI will create directories and all that fun stuff
          // TODO: We should actually test this stuff too, kinda a big deal
          cli.kill("SIGINT");
          break;
      }

      previousPrompt = prompt;
    });

    cli.on("exit", () => {
      done();
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

  describe("the --help flag", () => {
    it("prints help info", async () => {
      let { stdout } = await execFile("node", [createRemix, "--help"]);

      expect(stdout).toMatchInlineSnapshot(`
        "
          Create a new Remix app

          Usage:
            $ npx create-remix [flags...] [<dir>]

          If <dir> is not provided up front you will be prompted for it.

          Flags:
            --help, -h          Show this help message
            --version, -v       Show the version of this script

        "
      `);
    });
  });

  describe("the -h flag", () => {
    it("prints help info", async () => {
      let { stdout } = await execFile("node", [createRemix, "-h"]);
      expect(stdout).toMatchInlineSnapshot(`
        "
          Create a new Remix app

          Usage:
            $ npx create-remix [flags...] [<dir>]

          If <dir> is not provided up front you will be prompted for it.

          Flags:
            --help, -h          Show this help message
            --version, -v       Show the version of this script

        "
      `);
    });
  });
});

// These utils are a bit gnarly but they help me deal with the weirdness of node
// process stdout data formatting and inquirer. They're gross but make the tests
// easier to read than inlining everything IMO. Would be thrilled to delete them tho.
function cleanPrompt<T extends { toString(): string }>(data: T): string {
  return stripAnsi(data.toString())
    .trim()
    .split("\n")
    .map(s => s.replace(/\s+$/, ""))
    .join("\n");
}

function getPromptChoices(prompt: string) {
  return prompt
    .slice(prompt.indexOf("❯") + 2)
    .split("\n")
    .map(s => s.trim());
}

function isSamePrompt(
  currentPrompt: string,
  previousPrompt: string | undefined
) {
  if (previousPrompt === undefined) {
    return false;
  }

  let promptStart = previousPrompt.split("\n")[0];
  promptStart = promptStart.slice(0, promptStart.lastIndexOf("("));

  return currentPrompt.startsWith(promptStart);
}
