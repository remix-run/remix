import fse from "fs-extra";
import path from "path";
import { setupServer } from "msw/node";
import { rest } from "msw";

let FIXTURES_DIR = path.join(__dirname, "../fixtures");

let handlers = [
  rest.get(
    "https://api.github.com/repos/remix-run/remix/contents/templates",
    (req, res, ctx) => {
      return res(
        ctx.status(200),
        ctx.json([
          { name: "remix" },
          { name: "netlify" },
          { name: "arc" },
          { name: "fly" },
        ])
      );
    }
  ),

  rest.get(
    "https://api.github.com/repos/remix-run/remix/contents/examples",
    (req, res, ctx) => {
      return res(ctx.status(200), ctx.json([{ name: "basic" }]));
    }
  ),

  rest.get(
    "https://codeload.github.com/remix-run/remix/tar.gz/main",
    (req, res, ctx) => {
      let buffer = fse.readFileSync(
        path.join(FIXTURES_DIR, "remix-2022-03-23.tar.gz")
      );
      return res(ctx.status(200), ctx.body(buffer));
    }
  ),

  rest.get(
    "https://codeload.github.com/remix-run/blues-stack/tar.gz/main",
    (req, res, ctx) => {
      let buffer = fse.readFileSync(
        path.join(FIXTURES_DIR, "blues-stack-2022-03-23.tar.gz")
      );
      return res(ctx.status(200), ctx.body(buffer));
    }
  ),

  rest.get(
    "https://codeload.github.com/:owner/:repo/tar.gz/:branch",
    (req, res, ctx) => {
      let buffer = fse.readFileSync(path.join(FIXTURES_DIR, "arc.tar.gz"));
      return res(ctx.status(200), ctx.body(buffer));
    }
  ),

  rest.get(
    "https://github.com/remix-run/remix/blob/635dae1d7fcd19c206f45f1d1b9226b9c3b308b0/packages/remix-dev/__tests__/fixtures/arc.tar.gz",
    (req, res, ctx) => {
      if (req.url.searchParams.get("raw") === "true") {
        let buffer = fse.readFileSync(path.join(FIXTURES_DIR, "arc.tar.gz"));
        return res(ctx.status(200), ctx.body(buffer));
      }

      return res(ctx.status(404));
    }
  ),

  rest.get("https://api.github.com/repos/:owner/:repo", (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        default_branch: "main",
      })
    );
  }),
];

export const server = setupServer(...handlers);
