import semver from "semver";

import { execRemix } from "./cli-utils";

describe("remix flags", () => {
  describe("the --help flag", () => {
    it("prints help info", async () => {
      let { stdout } = await execRemix(["--help"]);
      expect(stdout.trim()).toMatchInlineSnapshot(`
        "R E M I X

          Usage:
            $ remix create <projectDir> --template <template>
            $ remix init [projectDir]
            $ remix build [projectDir]
            $ remix dev [projectDir]
            $ remix routes [projectDir]
            $ remix setup [remixPlatform]

          Options:
            --help, -h          Print this help message and exit
            --version, -v       Print the CLI version and exit
            --no-color          Disable ANSI colors in console output
          \`create\` Options:
            --template          The template to use
            --no-install        Skip installing dependencies after creation
            --no-typescript     Convert the template to JavaScript
            --remix-version     The version of Remix to use
          \`build\` Options:
            --sourcemap         Generate source maps for production
          \`dev\` Options:
            --debug             Attach Node.js inspector
          \`routes\` Options:
            --json              Print the routes as JSON

          Values:
            - projectDir        The Remix project directory
            - template          The project template to use
            - remixPlatform     node or cloudflare

          Creating a new project:

            Remix projects are created from templates. A template can be:

            - a file path to a directory of files
            - a file path to a tarball
            - the name of a :username/:repo on GitHub
            - the URL of a tarball

            $ remix create my-app --template /path/to/remix-template
            $ remix create my-app --template /path/to/remix-template.tar.gz
            $ remix create my-app --template remix-run/grunge-stack
            $ remix create my-app --template :username/:repo
            $ remix create my-app --template https://github.com/:username/:repo
            $ remix create my-app --template https://github.com/:username/:repo/tree/:branch
            $ remix create my-app --template https://github.com/:username/:repo/archive/refs/tags/:tag.tar.gz
            $ remix create my-app --template https://example.com/remix-template.tar.gz

            To create a new project from a template in a private GitHub repo,
            set the \`GITHUB_TOKEN\` environment variable to a personal access
            token with access to that repo.

          Initialize a project::

            Remix project templates may contain a \`remix.init\` directory
            with a script that initializes the project. This script automatically
            runs during \`remix create\`, but if you ever need to run it manually
            (e.g. to test it out) you can:

            $ remix init

          Build your project:

            $ remix build
            $ remix build --sourcemap
            $ remix build my-app

          Run your project locally in development:

            $ remix dev
            $ remix dev my-app
            $ remix dev --debug

          Show all routes in your app:

            $ remix routes
            $ remix routes my-app
            $ remix routes --json"
      `);
    });
  });

  describe("the --version flag", () => {
    it("prints the current version", async () => {
      let { stdout } = await execRemix(["--version"]);
      expect(!!semver.valid(stdout.trim())).toBe(true);
    });
  });
});
