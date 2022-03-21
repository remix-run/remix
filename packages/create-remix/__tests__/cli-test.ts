/* eslint-disable import/first */
jest.mock("inquirer");
import childProcess from "child_process";
import path from "path";
import util from "util";
// @ts-expect-error - we add it in our mock
import { expectPrompts } from "inquirer";

const execFile =
  process.platform === "win32"
    ? util.promisify(childProcess.exec)
    : util.promisify(childProcess.execFile);

const remix = path.resolve(
  __dirname,
  "../../../build/node_modules/create-remix/cli.js"
);

describe("create-remix cli", () => {
  it("works", async () => {
    expectPrompts([
      {
        message: "What type of app do you want to create?",
        choices: [
          "A pre-configured stack ready for production",
          "Just the basics",
        ],
        choose: 1,
      },
      {
        message: `Where do you want to deploy? Choose Remix if you're unsure, it's easy to change deployment targets.`,
        choices: [
          "Remix App Server",
          "Express Server",
          "Architect (AWS Lambda)",
          "Fly.io",
          "Netlify",
          "Vercel",
          "Cloudflare Pages",
          "Cloudflare Workers",
        ],
        choose: 0,
      },
      {
        message: "TypeScript or JavaScript?",
        choices: ["TypeScript", "JavaScript"],
        choose: 0,
      },
      {
        message: "install",
        confirm: true,
      },
    ]);
    let { stdout } = await execFile("node", [remix, "./my-remix-app"]);
    expect(stdout).toMatchInlineSnapshot();
  });

  // `create-remix` is just a proxy for `@remix-run/dev create`
  // other tests are in `@remix-run/dev`
});
