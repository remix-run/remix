import type { ChildProcessWithoutNullStreams } from "child_process";
import { spawn } from "child_process";
import os from "os";
import path from "path";
import { pathToFileURL } from "url";
import fse from "fs-extra";
import semver from "semver";

import { jestTimeout } from "./setupAfterEnv";
import { main } from "../create-remix";
import { server } from "./msw";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());

// this is so we can mock execSync for "npm install" and the like
jest.mock("child_process", () => {
  let cp = jest.requireActual("child_process");

  return {
    ...cp,
    spawn: jest.fn((...args) => {
      let [command, params] = args;

      // this prevents us from having to run the install process
      // and keeps our console output clean
      if (
        ["npm", "yarn", "pnpm"].includes(command) &&
        params[0] === "install"
      ) {
        return cp.spawn("echo", [`"mock ${command} install"`]);
      }
      return cp.spawn(...args);
    }),
  };
});

const DOWN = "\x1B\x5B\x42";
const ENTER = "\x0D";

const TEMP_DIR = path.join(
  fse.realpathSync(os.tmpdir()),
  `remix-tests-${Math.random().toString(32).slice(2)}`
);
function maskTempDir(string: string) {
  return string.replace(TEMP_DIR, "<TEMP_DIR>");
}

jest.setTimeout(30_000);
beforeAll(async () => {
  await fse.remove(TEMP_DIR);
  await fse.ensureDir(TEMP_DIR);
});

afterAll(async () => {
  await fse.remove(TEMP_DIR);
});

describe("create-remix CLI", () => {
  let tempDirs = new Set<string>();
  let originalCwd = process.cwd();

  beforeEach(() => {
    process.chdir(TEMP_DIR);
    jest.clearAllMocks();
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    for (let dir of tempDirs) {
      await fse.remove(dir);
    }
    tempDirs = new Set<string>();
  });

  function getProjectDir(name: string) {
    let tmpDir = path.join(TEMP_DIR, name);
    tempDirs.add(tmpDir);
    return tmpDir;
  }

  it("supports the --help flag", async () => {
    let { stdout } = await runCreateRemix({
      args: ["--help"],
    });
    expect(stdout.trim()).toMatchInlineSnapshot(`
      "create-remix  

      Usage:

      $ create-remix <projectDir> <...options>

      Values:

      projectDir          The Remix project directory

      Options:

      --help, -h          Print this help message and exit
      --version, -V       Print the CLI version and exit
      --no-color          Disable ANSI colors in console output
      --no-motion         Disable animations in console output

      --template <name>   The project template to use
      --[no-]install      Whether or not to install dependencies after creation
      --package-manager   The package manager to use
      --show-install-output   Whether to show the output of the install process
      --[no-]init-script  Whether or not to run the template's custom remix.init script, if present
      --[no-]git-init     Whether or not to initialize a Git repository
      --yes, -y           Skip all option prompts and run setup
      --remix-version, -v     The version of Remix to use

      Creating a new project:

      Remix projects are created from templates. A template can be:

        - a file path to a directory of files
        - a file path to a tarball
        - the name of a :username/:repo on GitHub
        - the URL of a GitHub repository (or directory within it)
        - the URL of a tarball

      $ create-remix my-app --template /path/to/remix-template
      $ create-remix my-app --template /path/to/remix-template.tar.gz
      $ create-remix my-app --template remix-run/grunge-stack
      $ create-remix my-app --template :username/:repo
      $ create-remix my-app --template https://github.com/:username/:repo
      $ create-remix my-app --template https://github.com/:username/:repo/tree/:branch
      $ create-remix my-app --template https://github.com/:username/:repo/tree/:branch/:directory
      $ create-remix my-app --template https://github.com/:username/:repo/archive/refs/tags/:tag.tar.gz
      $ create-remix my-app --template https://example.com/remix-template.tar.gz

      To create a new project from a template in a private GitHub repo,
      pass the \`token\` flag with a personal access token with access
      to that repo.

      Initialize a project:

      Remix project templates may contain a \`remix.init\` directory
      with a script that initializes the project. This script automatically
      runs during \`remix create\`, but if you ever need to run it manually
      you can run:

      $ remix init"
    `);
  });

  it("supports the --version flag", async () => {
    let { stdout } = await runCreateRemix({
      args: ["--version"],
    });
    expect(!!semver.valid(stdout.trim())).toBe(true);
  });

  it("allows you to go through the prompts", async () => {
    let projectDir = getProjectDir("prompts");

    let { status } = await runCreateRemix({
      args: [],
      interactions: [
        {
          question: /where.*create.*project/i,
          type: [projectDir, ENTER],
        },
        {
          question: /init.*git/i,
          type: ["n"],
        },
        {
          question: /install dependencies/i,
          type: ["n"],
        },
      ],
    });

    expect(status).toBe(0);
    expect(fse.existsSync(path.join(projectDir, "package.json"))).toBeTruthy();
    expect(fse.existsSync(path.join(projectDir, "app/root.tsx"))).toBeTruthy();
  });

  it("supports the --yes flag", async () => {
    let projectDir = getProjectDir("yes");

    let { status } = await runCreateRemix({
      args: [projectDir, "--yes", "--no-install"],
    });

    expect(status).toBe(0);
    expect(fse.existsSync(path.join(projectDir, "package.json"))).toBeTruthy();
    expect(fse.existsSync(path.join(projectDir, "app/root.tsx"))).toBeTruthy();
  });

  it("errors when project directory isn't provided when shell isn't interactive", async () => {
    let projectDir = getProjectDir("non-interactive-no-project-dir");

    let { status, stderr } = await runCreateRemix({
      args: ["--no-install"],
      interactive: false,
    });

    expect(status).toBe(1);
    expect(stderr.trim()).toMatchInlineSnapshot(
      `"▲  Oh no! No project directory provided"`
    );
    expect(fse.existsSync(path.join(projectDir, "package.json"))).toBeFalsy();
    expect(fse.existsSync(path.join(projectDir, "app/root.tsx"))).toBeFalsy();
  });

  it("errors when project directory isn't empty when shell isn't interactive", async () => {
    let notEmptyDir = getProjectDir("not-empty-dir");
    fse.mkdirSync(notEmptyDir);
    fse.createFileSync(path.join(notEmptyDir, "some-file.txt"));

    let { status, stderr } = await runCreateRemix({
      args: [notEmptyDir, "--no-install"],
      interactive: false,
    });

    expect(status).toBe(1);
    expect(stderr.trim()).toMatchInlineSnapshot(
      `"▲  Oh no! Project directory \\"<TEMP_DIR>/not-empty-dir\\" is not empty"`
    );
    expect(fse.existsSync(path.join(notEmptyDir, "package.json"))).toBeFalsy();
    expect(fse.existsSync(path.join(notEmptyDir, "app/root.tsx"))).toBeFalsy();
  });

  // this also tests sub directories
  it("works for examples in the examples repo", async () => {
    let projectDir = getProjectDir("example");

    let { status } = await runCreateRemix({
      args: [
        projectDir,
        "--template",
        "examples/basic",
        "--no-git-init",
        "--no-install",
      ],
    });

    expect(status).toBe(0);
    expect(fse.existsSync(path.join(projectDir, "package.json"))).toBeTruthy();
    expect(fse.existsSync(path.join(projectDir, "app/root.tsx"))).toBeTruthy();
  });

  it("works for GitHub username/repo combo", async () => {
    let projectDir = getProjectDir("github-username-repo");

    let { status } = await runCreateRemix({
      args: [
        projectDir,
        "--template",
        "remix-fake-tester-username/remix-fake-tester-repo",
        "--no-git-init",
        "--no-install",
      ],
    });

    expect(status).toBe(0);
    expect(fse.existsSync(path.join(projectDir, "package.json"))).toBeTruthy();
    expect(fse.existsSync(path.join(projectDir, "app/root.tsx"))).toBeTruthy();
  });

  it("fails for private GitHub username/repo combo without a token", async () => {
    let projectDir = getProjectDir("private-repo-no-token");

    let { status, stderr } = await runCreateRemix({
      args: [
        projectDir,
        "--template",
        "private-org/private-repo",
        "--no-git-init",
        "--no-install",
      ],
    });

    expect(status).toBe(1);
    expect(stderr.trim()).toMatchInlineSnapshot(
      `"▲  Oh no! There was a problem fetching the file from GitHub. The request responded with a 404 status. Please try again later."`
    );
  });

  it("succeeds for private GitHub username/repo combo with a valid token", async () => {
    let projectDir = getProjectDir("github-username-repo-with-token");

    let { status } = await runCreateRemix({
      args: [
        projectDir,
        "--template",
        "private-org/private-repo",
        "--no-git-init",
        "--no-install",
        "--token",
        "valid-token",
      ],
    });

    expect(status).toBe(0);
    expect(fse.existsSync(path.join(projectDir, "package.json"))).toBeTruthy();
    expect(fse.existsSync(path.join(projectDir, "app/root.tsx"))).toBeTruthy();
  });

  it("works for remote tarballs", async () => {
    let projectDir = getProjectDir("remote-tarball");

    let { status } = await runCreateRemix({
      args: [
        projectDir,
        "--template",
        "https://example.com/remix-stack.tar.gz",
        "--no-git-init",
        "--no-install",
      ],
    });

    expect(status).toBe(0);
    expect(fse.existsSync(path.join(projectDir, "package.json"))).toBeTruthy();
    expect(fse.existsSync(path.join(projectDir, "app/root.tsx"))).toBeTruthy();
  });

  it("fails for private github release tarballs", async () => {
    let projectDir = getProjectDir("private-release-tarball-no-token");

    let { status, stderr } = await runCreateRemix({
      args: [
        projectDir,
        "--template",
        "https://github.com/private-org/private-repo/releases/download/v0.0.1/stack.tar.gz",
        "--no-git-init",
        "--no-install",
      ],
    });

    expect(status).toBe(1);
    expect(stderr.trim()).toMatchInlineSnapshot(
      `"▲  Oh no! There was a problem fetching the file from GitHub. The request responded with a 404 status. Please try again later."`
    );
  });

  it("succeeds for private github release tarballs when including token", async () => {
    let projectDir = getProjectDir("private-release-tarball-with-token");

    let { status } = await runCreateRemix({
      args: [
        projectDir,
        "--template",
        "https://github.com/private-org/private-repo/releases/download/v0.0.1/stack.tar.gz",
        "--token",
        "valid-token",
        "--no-git-init",
        "--no-install",
      ],
    });

    expect(status).toBe(0);
    expect(fse.existsSync(path.join(projectDir, "package.json"))).toBeTruthy();
    expect(fse.existsSync(path.join(projectDir, "app/root.tsx"))).toBeTruthy();
  });

  it("works for different branches", async () => {
    let projectDir = getProjectDir("diff-branch");

    let { status } = await runCreateRemix({
      args: [
        projectDir,
        "--template",
        "https://github.com/fake-remix-tester/nested-dir/tree/dev/stack",
        "--no-git-init",
        "--no-install",
      ],
    });

    expect(status).toBe(0);
    expect(fse.existsSync(path.join(projectDir, "package.json"))).toBeTruthy();
    expect(fse.existsSync(path.join(projectDir, "app/root.tsx"))).toBeTruthy();
  });

  it("works for a path to a tarball on disk", async () => {
    let projectDir = getProjectDir("local-tarball");

    let { status } = await runCreateRemix({
      args: [
        projectDir,
        "--template",
        path.join(__dirname, "fixtures", "arc.tar.gz"),
        "--no-git-init",
        "--no-install",
      ],
    });

    expect(status).toBe(0);
    expect(fse.existsSync(path.join(projectDir, "package.json"))).toBeTruthy();
    expect(fse.existsSync(path.join(projectDir, "app/root.tsx"))).toBeTruthy();
  });

  it("works for a file URL to a tarball on disk", async () => {
    let projectDir = getProjectDir("file-url-tarball");

    let { status } = await runCreateRemix({
      args: [
        projectDir,
        "--template",
        pathToFileURL(
          path.join(__dirname, "fixtures", "arc.tar.gz")
        ).toString(),
        "--no-git-init",
        "--no-install",
      ],
    });

    expect(status).toBe(0);
    expect(fse.existsSync(path.join(projectDir, "package.json"))).toBeTruthy();
    expect(fse.existsSync(path.join(projectDir, "app/root.tsx"))).toBeTruthy();
  });

  it("works for a file path to a directory on disk", async () => {
    let projectDir = getProjectDir("local-directory");

    let { status } = await runCreateRemix({
      args: [
        projectDir,
        "--template",
        path.join(__dirname, "fixtures/stack"),
        "--no-git-init",
        "--no-install",
      ],
    });

    expect(status).toBe(0);
    expect(fse.existsSync(path.join(projectDir, "package.json"))).toBeTruthy();
    expect(fse.existsSync(path.join(projectDir, "app/root.tsx"))).toBeTruthy();
  });

  it("works for a file URL to a directory on disk", async () => {
    let projectDir = getProjectDir("file-url-directory");

    let { status } = await runCreateRemix({
      args: [
        projectDir,
        "--template",
        pathToFileURL(path.join(__dirname, "fixtures/stack")).toString(),
        "--no-git-init",
        "--no-install",
      ],
    });

    expect(status).toBe(0);
    expect(fse.existsSync(path.join(projectDir, "package.json"))).toBeTruthy();
    expect(fse.existsSync(path.join(projectDir, "app/root.tsx"))).toBeTruthy();
  });

  it("prompts to run remix.init script when installing dependencies", async () => {
    let projectDir = getProjectDir("remix-init-auto");

    let { status, stdout } = await runCreateRemix({
      args: [
        projectDir,
        "--template",
        path.join(__dirname, "fixtures", "successful-remix-init.tar.gz"),
        "--no-git-init",
      ],
      interactions: [
        {
          question: /install dependencies/i,
          type: ["y", ENTER],
        },
        {
          question: /init script/i,
          type: ["y", ENTER],
        },
      ],
    });

    expect(status).toBe(0);
    expect(stdout).toContain(`Template's custom remix.init script complete`);
    expect(fse.existsSync(path.join(projectDir, "package.json"))).toBeTruthy();
    expect(fse.existsSync(path.join(projectDir, "app/root.tsx"))).toBeTruthy();
    expect(fse.existsSync(path.join(projectDir, "test.txt"))).toBeTruthy();
    expect(fse.existsSync(path.join(projectDir, "remix.init"))).toBeFalsy();
  });

  it("doesn't prompt to run remix.init script when not installing dependencies", async () => {
    let projectDir = getProjectDir("remix-init-auto");

    let { status, stdout } = await runCreateRemix({
      args: [
        projectDir,
        "--template",
        path.join(__dirname, "fixtures", "successful-remix-init.tar.gz"),
        "--no-git-init",
      ],
      interactions: [
        {
          question: /install dependencies/i,
          type: ["n", ENTER],
        },
      ],
    });

    expect(status).toBe(0);
    expect(stdout).toContain(`Skipping template's custom remix.init script.`);
    expect(fse.existsSync(path.join(projectDir, "package.json"))).toBeTruthy();
    expect(fse.existsSync(path.join(projectDir, "app/root.tsx"))).toBeTruthy();

    // Init script hasn't run so file exists
    expect(fse.existsSync(path.join(projectDir, "test.txt"))).toBeFalsy();

    // Init script hasn't run so remix.init directory still exists
    expect(fse.existsSync(path.join(projectDir, "remix.init"))).toBeTruthy();
  });

  it("runs remix.init script when --install and --init-script flags are passed", async () => {
    let projectDir = getProjectDir("remix-init-auto");

    let { status, stdout } = await runCreateRemix({
      args: [
        projectDir,
        "--template",
        path.join(__dirname, "fixtures", "successful-remix-init.tar.gz"),
        "--no-git-init",
        "--install",
        "--init-script",
      ],
    });

    expect(status).toBe(0);
    expect(fse.existsSync(path.join(projectDir, "package.json"))).toBeTruthy();
    expect(fse.existsSync(path.join(projectDir, "app/root.tsx"))).toBeTruthy();

    expect(stdout).toContain(`Template's custom remix.init script complete`);
    expect(fse.existsSync(path.join(projectDir, "package.json"))).toBeTruthy();
    expect(fse.existsSync(path.join(projectDir, "app/root.tsx"))).toBeTruthy();
    expect(fse.existsSync(path.join(projectDir, "test.txt"))).toBeTruthy();
    expect(fse.existsSync(path.join(projectDir, "remix.init"))).toBeFalsy();
  });

  it("doesn't run remix.init script when --no-install flag is passed, even when --init-script flag is passed", async () => {
    let projectDir = getProjectDir("remix-init-auto");

    let { status, stdout } = await runCreateRemix({
      args: [
        projectDir,
        "--template",
        path.join(__dirname, "fixtures", "successful-remix-init.tar.gz"),
        "--no-git-init",
        "--no-install",
        "--init-script",
      ],
    });

    expect(status).toBe(0);
    expect(stdout).toContain(`Skipping template's custom remix.init script.`);
    expect(fse.existsSync(path.join(projectDir, "package.json"))).toBeTruthy();
    expect(fse.existsSync(path.join(projectDir, "app/root.tsx"))).toBeTruthy();

    // Init script hasn't run so file exists
    expect(fse.existsSync(path.join(projectDir, "test.txt"))).toBeFalsy();

    // Init script hasn't run so remix.init directory still exists
    expect(fse.existsSync(path.join(projectDir, "remix.init"))).toBeTruthy();
  });

  it("doesn't run remix.init script when --no-init-script flag is passed", async () => {
    let projectDir = getProjectDir("remix-init-no-init-flag");

    let { status, stdout } = await runCreateRemix({
      args: [
        projectDir,
        "--template",
        path.join(__dirname, "fixtures", "successful-remix-init.tar.gz"),
        "--no-git-init",
        "--install",
        "--no-init-script",
      ],
    });

    expect(status).toBe(0);
    expect(stdout).toContain(`Skipping template's custom remix.init script.`);
    expect(fse.existsSync(path.join(projectDir, "package.json"))).toBeTruthy();
    expect(fse.existsSync(path.join(projectDir, "app/root.tsx"))).toBeTruthy();

    // Init script hasn't run so file exists
    expect(fse.existsSync(path.join(projectDir, "test.txt"))).toBeFalsy();

    // Init script hasn't run so remix.init directory still exists
    expect(fse.existsSync(path.join(projectDir, "remix.init"))).toBeTruthy();
  });

  it("throws an error when invalid remix.init script when automatically ran", async () => {
    let projectDir = getProjectDir("invalid-remix-init-auto");

    let { status, stderr } = await runCreateRemix({
      args: [
        projectDir,
        "--template",
        path.join(__dirname, "fixtures", "failing-remix-init.tar.gz"),
        "--no-git-init",
        "--install",
        "--init-script",
      ],
    });

    expect(status).toBe(1);
    expect(stderr.trim()).toMatchInlineSnapshot(
      `"▲  Oh no! Template's custom remix.init script failed"`
    );
    expect(fse.existsSync(path.join(projectDir, "package.json"))).toBeTruthy();
    expect(fse.existsSync(path.join(projectDir, "app/root.tsx"))).toBeTruthy();

    expect(fse.existsSync(path.join(projectDir, "test.txt"))).toBeFalsy();
    expect(fse.existsSync(path.join(projectDir, "remix.init"))).toBeTruthy();
  });

  it("runs npm install by default", async () => {
    let projectDir = getProjectDir("npm-install");

    await main([
      projectDir,
      "--template",
      path.join(__dirname, "fixtures", "successful-remix-init.tar.gz"),
      "--no-git-init",
      "--yes",
    ]);

    expect(spawn).toHaveBeenCalledWith(
      "npm",
      expect.arrayContaining(["install"]),
      expect.anything()
    );
  });

  it("recognizes when Yarn was used to run the command", async () => {
    let originalUserAgent = process.env.npm_config_user_agent;
    process.env.npm_config_user_agent =
      "yarn/1.22.18 npm/? node/v14.17.0 linux x64";

    let projectDir = getProjectDir("yarn-create");

    await main([
      projectDir,
      "--template",
      path.join(__dirname, "fixtures", "successful-remix-init.tar.gz"),
      "--no-git-init",
      "--yes",
    ]);

    expect(spawn).toHaveBeenCalledWith(
      "yarn",
      expect.arrayContaining(["install"]),
      expect.anything()
    );
    process.env.npm_config_user_agent = originalUserAgent;
  });

  it("recognizes when pnpm was used to run the command", async () => {
    let originalUserAgent = process.env.npm_config_user_agent;
    process.env.npm_config_user_agent =
      "pnpm/6.32.3 npm/? node/v14.17.0 linux x64";

    let projectDir = getProjectDir("pnpm-create");

    await main([
      projectDir,
      "--template",
      path.join(__dirname, "fixtures", "successful-remix-init.tar.gz"),
      "--no-git-init",
      "--yes",
    ]);

    expect(spawn).toHaveBeenCalledWith(
      "pnpm",
      expect.arrayContaining(["install"]),
      expect.anything()
    );
    process.env.npm_config_user_agent = originalUserAgent;
  });

  it("supports specifying the package manager, regardless of user agent", async () => {
    let originalUserAgent = process.env.npm_config_user_agent;
    process.env.npm_config_user_agent =
      "yarn/1.22.18 npm/? node/v14.17.0 linux x64";

    let projectDir = getProjectDir("pnpm-create-override");

    await main([
      projectDir,
      "--template",
      path.join(__dirname, "fixtures", "successful-remix-init.tar.gz"),
      "--no-git-init",
      "--yes",
      "--package-manager",
      "pnpm",
    ]);

    expect(spawn).toHaveBeenCalledWith(
      "pnpm",
      expect.arrayContaining(["install"]),
      expect.anything()
    );
    process.env.npm_config_user_agent = originalUserAgent;
  });

  describe("errors", () => {
    it("identifies when a github repo is not accessible (403)", async () => {
      let projectDir = getProjectDir("repo");

      let { status, stderr } = await runCreateRemix({
        args: [
          projectDir,
          "--template",
          "error-username/403",
          "--no-git-init",
          "--no-install",
        ],
      });

      expect(status).toBe(1);
      expect(stderr.trim()).toMatchInlineSnapshot(
        `"▲  Oh no! There was a problem fetching the file from GitHub. The request responded with a 403 status. Please try again later."`
      );
    });

    it("identifies when a github repo does not exist (404)", async () => {
      let projectDir = getProjectDir("repo");

      let { status, stderr } = await runCreateRemix({
        args: [
          projectDir,
          "--template",
          "error-username/404",
          "--no-git-init",
          "--no-install",
        ],
      });

      expect(status).toBe(1);
      expect(stderr.trim()).toMatchInlineSnapshot(
        `"▲  Oh no! There was a problem fetching the file from GitHub. The request responded with a 404 status. Please try again later."`
      );
    });

    it("identifies when something unknown goes wrong with the repo request (4xx)", async () => {
      let projectDir = getProjectDir("repo");

      let { status, stderr } = await runCreateRemix({
        args: [
          projectDir,
          "--template",
          "error-username/400",
          "--no-git-init",
          "--no-install",
        ],
      });

      expect(status).toBe(1);
      expect(stderr.trim()).toMatchInlineSnapshot(
        `"▲  Oh no! There was a problem fetching the file from GitHub. The request responded with a 400 status. Please try again later."`
      );
    });

    it("identifies when a remote tarball does not exist (404)", async () => {
      let projectDir = getProjectDir("remote-tarball");

      let { status, stderr } = await runCreateRemix({
        args: [
          projectDir,
          "--template",
          "https://example.com/error/404/remix-stack.tar.gz",
          "--no-git-init",
          "--no-install",
        ],
      });

      expect(status).toBe(1);
      expect(stderr.trim()).toMatchInlineSnapshot(
        `"▲  Oh no! There was a problem fetching the file. The request responded with a 404 status. Please try again later."`
      );
    });

    it("identifies when a remote tarball does not exist (4xx)", async () => {
      let projectDir = getProjectDir("remote-tarball");

      let { status, stderr } = await runCreateRemix({
        args: [
          projectDir,
          "--template",
          "https://example.com/error/400/remix-stack.tar.gz",
          "--no-git-init",
          "--no-install",
        ],
      });

      expect(status).toBe(1);
      expect(stderr.trim()).toMatchInlineSnapshot(
        `"▲  Oh no! There was a problem fetching the file. The request responded with a 400 status. Please try again later."`
      );
    });

    it("doesn't allow creating an app in a dir if it's not empty and then prompts for an empty dir", async () => {
      let emptyDir = getProjectDir("empty-dir");

      let notEmptyDir = getProjectDir("not-empty-dir");
      fse.mkdirSync(notEmptyDir);
      fse.createFileSync(path.join(notEmptyDir, "some-file.txt"));

      let { status, stdout } = await runCreateRemix({
        args: [
          notEmptyDir,
          "--template",
          path.join(__dirname, "fixtures/stack"),
          "--no-git-init",
          "--no-install",
        ],
        interactions: [
          {
            question: /where.*create.*project/i,
            type: [emptyDir, ENTER],
          },
        ],
      });

      expect(status).toBe(0);
      expect(stdout).toContain(
        `Hmm... "${maskTempDir(notEmptyDir)}" is not empty!`
      );
      expect(fse.existsSync(path.join(emptyDir, "package.json"))).toBeTruthy();
      expect(fse.existsSync(path.join(emptyDir, "app/root.tsx"))).toBeTruthy();
    });

    it("allows creating an app in the current dir if it's empty", async () => {
      let emptyDir = getProjectDir("empty-dir");
      fse.mkdirSync(emptyDir);
      let cwd = process.cwd();
      process.chdir(emptyDir);

      let { status } = await runCreateRemix({
        args: [
          ".",
          "--template",
          path.join(__dirname, "fixtures/stack"),
          "--no-git-init",
          "--no-install",
        ],
      });

      expect(status).toBe(0);
      expect(fse.existsSync(path.join(emptyDir, "package.json"))).toBeTruthy();
      expect(fse.existsSync(path.join(emptyDir, "app/root.tsx"))).toBeTruthy();

      process.chdir(cwd);
    });

    it("doesn't allow creating an app in the current dir if it's not empty", async () => {
      let emptyDir = getProjectDir("empty-dir");
      let cwd = process.cwd();

      let notEmptyDir = getProjectDir("not-empty-dir");
      fse.mkdirSync(notEmptyDir);
      fse.createFileSync(path.join(notEmptyDir, "some-file.txt"));
      process.chdir(notEmptyDir);

      let { status, stdout } = await runCreateRemix({
        args: [
          ".",
          "--template",
          path.join(__dirname, "fixtures/stack"),
          "--no-git-init",
          "--no-install",
        ],
        interactions: [
          {
            question: /where.*create.*project/i,
            type: [emptyDir, ENTER],
          },
        ],
      });

      expect(status).toBe(0);
      expect(stdout).toContain(`Hmm... "." is not empty!`);
      expect(fse.existsSync(path.join(emptyDir, "package.json"))).toBeTruthy();
      expect(fse.existsSync(path.join(emptyDir, "app/root.tsx"))).toBeTruthy();

      process.chdir(cwd);
    });
  });

  describe("supports proxy usage", () => {
    beforeAll(() => {
      server.close();
    });
    afterAll(() => {
      server.listen({ onUnhandledRequest: "error" });
    });
    it("uses the proxy from env var", async () => {
      let projectDir = await getProjectDir("template");

      let { stderr } = await runCreateRemix({
        args: [
          projectDir,
          "--template",
          "grunge-stack",
          "--no-install",
          "--no-git-init",
          "--debug",
        ],
        mockNetwork: false,
        env: { HTTPS_PROXY: "http://127.0.0.1:33128" },
      });

      expect(stderr.trim()).toMatch("127.0.0.1:33");
    });
  });
});

async function runCreateRemix({
  args = [],
  interactions = [],
  interactive = true,
  env = {},
  mockNetwork = true,
}: {
  args: string[];
  interactive?: boolean;
  interactions?: ShellInteractions;
  env?: Record<string, string>;
  mockNetwork?: boolean;
}) {
  let proc = spawn(
    "node",
    [
      "--require",
      require.resolve("esbuild-register"),
      ...(mockNetwork
        ? ["--require", path.join(__dirname, "./msw-register.ts")]
        : []),
      path.resolve(__dirname, "../cli.ts"),
      ...args,
    ],
    {
      stdio: [null, null, null],
      env: {
        ...process.env,
        ...env,
        CREATE_REMIX_FORCE_INTERACTIVE: String(interactive),
      },
    }
  );

  return await interactWithShell(proc, interactions);
}

interface ShellResult {
  status: number | "timeout" | null;
  stdout: string;
  stderr: string;
}

type ShellInteractions = Array<
  | { question: RegExp; type: Array<String>; answer?: never }
  | { question: RegExp; answer: RegExp; type?: never }
>;

async function interactWithShell(
  proc: ChildProcessWithoutNullStreams,
  interactions: ShellInteractions
): Promise<ShellResult> {
  proc.stdin.setDefaultEncoding("utf-8");

  let deferred = defer<ShellResult>();

  let stepNumber = 0;

  let stdout = "";
  let stderr = "";
  proc.stdout.on("data", (chunk: unknown) => {
    if (chunk instanceof Buffer) {
      chunk = String(chunk);
    }
    if (typeof chunk !== "string") {
      console.error({ stdoutChunk: chunk });
      throw new Error("stdout chunk is not a string");
    }
    stdout += maskTempDir(chunk);
    let step = interactions[stepNumber];
    if (!step) return;
    let { question, answer, type } = step;
    if (question.test(chunk)) {
      if (answer) {
        let currentSelection = chunk
          .split("\n")
          .slice(1)
          .find(
            (line) =>
              line.includes("❯") || line.includes(">") || line.includes("●")
          );

        if (currentSelection && answer.test(currentSelection)) {
          proc.stdin.write(ENTER);
          stepNumber += 1;
        } else {
          proc.stdin.write(DOWN);
        }
      } else if (type) {
        for (let command of type) {
          proc.stdin.write(command);
        }
        stepNumber += 1;
      }
    }

    if (stepNumber === interactions.length) {
      proc.stdin.end();
    }
  });

  proc.stderr.on("data", (chunk: unknown) => {
    if (chunk instanceof Buffer) {
      chunk = String(chunk);
    }
    if (typeof chunk !== "string") {
      console.error({ stderrChunk: chunk });
      throw new Error("stderr chunk is not a string");
    }
    stderr += maskTempDir(chunk);
  });

  proc.on("close", (status) => {
    deferred.resolve({ status, stdout, stderr });
  });

  // this ensures that if we do timeout we at least get as much useful
  // output as possible.
  let timeout = setTimeout(() => {
    if (deferred.state.current === "pending") {
      proc.kill();
      deferred.resolve({ status: "timeout", stdout, stderr });
    }
  }, jestTimeout);

  let result = await deferred.promise;
  clearTimeout(timeout);

  return result;
}

function defer<Value>() {
  let resolve: (value: Value) => void, reject: (reason?: any) => void;
  let state: { current: "pending" | "resolved" | "rejected" } = {
    current: "pending",
  };
  let promise = new Promise<Value>((res, rej) => {
    resolve = (value: Value) => {
      state.current = "resolved";
      return res(value);
    };
    reject = (reason?: any) => {
      state.current = "rejected";
      return rej(reason);
    };
  });
  return { promise, resolve: resolve!, reject: reject!, state };
}
