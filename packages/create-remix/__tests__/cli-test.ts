import childProcess from "child_process";
import os from "os";
import fs from "fs-extra";
import path from "path";
import util from "util";
import semver from "semver";
import stripAnsi from "strip-ansi";
import { mkdtemp } from "fs/promises";

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
const tmpDirs = [];

describe("create-remix cli", () => {
  beforeAll(() => {
    jest.setTimeout(DEFAULT_JEST_TIMEOUT * 3);
    if (!fs.existsSync(createRemix)) {
      // TODO: Consider running the build here instead of throwing
      throw new Error(`Cannot run Remix CLI tests without building Remix`);
    }
  });

  afterAll(() => {
    jest.setTimeout(DEFAULT_JEST_TIMEOUT);
    for (let dir in tmpDirs) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  function expectRemix(prompt: string) {
    expect(prompt).toEqual("R E M I X");
  }

  function expectWelcome(prompt: string) {
    expect(prompt).toEqual(
      "💿 Welcome to Remix! Let's get you set up with a new project."
    );
  }

  function expectDirectory(prompt: string) {
    expect(prompt).toEqual(
      `? Where would you like to create your app? (./${DEFAULT_APP_NAME})`
    );
  }

  function expectAdapterChoices(prompt: string) {
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
      "(Move up and down to reveal more choices)"
    ]);
  }

  function expectLanguageChoices(prompt: string) {
    // TypeScript or JavaScript?
    expect(getPromptChoices(prompt)).toEqual(["TypeScript", "JavaScript"]);
  }

  function expectNpmInstall(prompt: string) {
    expect(prompt).toEqual("? Do you want me to run `npm install`? (Y/n)");
  }

  async function launchCreateRemix(...args: Array<string>) {
    let cwd = await mkdtemp(path.join(os.tmpdir(), "remix-cli-test-"));
    tmpDirs.push(cwd);
    let cli = spawn("node", [createRemix, ...args], { cwd });

    function buildStreamAwaiter(stream) {
      let data: string;
      let generator = (async function* () {
        for await (let rawData of stream) {
          let nextData = cleanPrompt(rawData);
          if (!nextData || isSamePrompt(nextData, data)) {
            continue;
          }
          data = nextData;
          yield data;
        }
      })();
      return async () => (await generator.next()).value || "";
    }

    function done() {
      return new Promise<void>(resolve => {
        cli.on("exit", () => resolve());
      });
    }

    return {
      cli,
      cwd,
      send: data => cli.stdin.write(data),
      output: buildStreamAwaiter(cli.stdout),
      error: buildStreamAwaiter(cli.stderr),
      done,
      kill: async () => {
        cli.kill("SIGINT");
        await done();
      }
    };
  }

  it("guides the user through the process", async () => {
    let { send, output, done, cwd } = await launchCreateRemix();

    expectRemix(await output());
    expectWelcome(await output());

    expectDirectory(await output());
    send(keys.enter);

    expectAdapterChoices(await output());
    send(keys.enter);

    expectLanguageChoices(await output());
    send(keys.enter);

    expectNpmInstall(await output());
    send("n" + keys.enter);

    await done();

    // TODO: test a lot more stuff, but at least we know it's putting something there 😅
    expect(fs.existsSync(path.join(cwd, DEFAULT_APP_NAME, "package.json")));
  });

  it("skips the directory prompt if a directory arg is specified", async () => {
    let { output, send, done, cwd } = await launchCreateRemix(
      "./some-other-dir"
    );

    expectRemix(await output());
    expectWelcome(await output());

    expectAdapterChoices(await output());
    send(keys.enter);

    expectLanguageChoices(await output());
    send(keys.enter);

    expectNpmInstall(await output());
    send("n" + keys.enter);

    await done();
    expect(fs.existsSync(path.join(cwd, "./some-other-dir", "package.json")));
  });

  describe("the --server-type flag", () => {
    it("accepts built-in server types", async () => {
      let { send, output, kill } = await launchCreateRemix(
        "--server-type",
        "remix"
      );
      expectRemix(await output());
      expectWelcome(await output());
      expectDirectory(await output());
      send(keys.enter);

      // no adapter choice, since we were explicit
      expectLanguageChoices(await output());

      await kill();
    });

    it("installs valid package ids", async () => {
      let { send, output, kill } = await launchCreateRemix(
        "--server-type",
        "lodash.eq" // doesn't actually have templates, but we don't care at this point, just want to make sure it's installing
      );
      expectRemix(await output());
      expectWelcome(await output());
      expectDirectory(await output());
      send(keys.enter);

      // no adapter choice, since we were explicit
      expectLanguageChoices(await output());

      await kill();
    });

    it("resolves valid paths", async () => {
      let { send, output, kill } = await launchCreateRemix(
        "--server-type",
        path.join(__dirname, "fixtures", "custom-adapter")
      );
      expectRemix(await output());
      expectWelcome(await output());
      expectDirectory(await output());
      send(keys.enter);

      // no adapter choice, since we were explicit
      expectLanguageChoices(await output());

      await kill();
    });

    it("warns if the adapter has no templates", async () => {
      let { send, output, error, done } = await launchCreateRemix(
        "--server-type",
        "./"
      );
      expectRemix(await output());
      expectWelcome(await output());
      expectDirectory(await output());
      send(keys.enter);

      // no adapter choice, since we were explicit
      expectLanguageChoices(await output());
      send(keys.enter);
      expectNpmInstall(await output());
      send("n" + keys.enter);

      expect(await error()).toContain("doesn't provide any templates");
      await done();
    });

    it("bails on invalid server-types", async () => {
      let { send, output, error, done } = await launchCreateRemix(
        "--server-type",
        "./this-is-neither-a-valid-package-id-nor-a-valid-path"
      );
      expectRemix(await output());
      expectWelcome(await output());
      expectDirectory(await output());
      send(keys.enter);
      // no adapter choice, since we were explicit
      expectLanguageChoices(await output());
      send(keys.enter);
      expectNpmInstall(await output());
      send("n" + keys.enter);

      expect(await error()).toContain(
        "doesn't appear to be a valid package id or path"
      );
      await done();
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
            --server-type, -s  Server template to use (built-in, package id, or path)
                               Built-ins include: remix, express, arc, fly, netlify,
                               vercel, and cloudflare-workers. Any custom package or
                               path may be used that contains templates. Refer to
                               https://remix.run/docs/en/v1/other-api/adapter for more
                               info
            --help, -h         Show this help message
            --version, -v      Show the version of this script
        
          Examples:
            # Create a new remix app
            $ npx create-remix
        
            # Create a new remix app in a specific directory
            $ npx create-remix ./awesome
        
            # Create a new remix app using remix server
            $ npx create-remix -s remix
        
            # Create a new remix app using a custom server template
            $ npx create-remix -s @mycool/remix-server-thingy

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
            --server-type, -s  Server template to use (built-in, package id, or path)
                               Built-ins include: remix, express, arc, fly, netlify,
                               vercel, and cloudflare-workers. Any custom package or
                               path may be used that contains templates. Refer to
                               https://remix.run/docs/en/v1/other-api/adapter for more
                               info
            --help, -h         Show this help message
            --version, -v      Show the version of this script
        
          Examples:
            # Create a new remix app
            $ npx create-remix
        
            # Create a new remix app in a specific directory
            $ npx create-remix ./awesome
        
            # Create a new remix app using remix server
            $ npx create-remix -s remix
        
            # Create a new remix app using a custom server template
            $ npx create-remix -s @mycool/remix-server-thingy

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
