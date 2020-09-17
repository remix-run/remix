import path from "path";

import { build, BuildTarget } from "../compiler";
import type { RemixConfig } from "../config";
import { readConfig } from "../config";
import { getServerManifest } from "../build";

const remixRoot = path.resolve(__dirname, "../../../fixtures/gists-app");

describe("the server build", () => {
  let remixConfig: RemixConfig;
  beforeEach(async () => {
    remixConfig = await readConfig(remixRoot);
  });

  it("generates a bundle for each input", async () => {
    let serverBuild = await build(remixConfig, { target: BuildTarget.Server });
    let { output } = await serverBuild.generate({
      exports: "named",
      format: "cjs"
    });

    expect(output.map(value => value.name)).toMatchInlineSnapshot(`
      Array [
        "routes/404",
        "routes/gists",
        "routes/gists/$username",
        "routes/gists/$username/edit",
        "routes/gists/index",
        "routes/gists.mine",
        "routes/index",
        "routes/payments",
        "routes/payments/error",
        "routes/users",
        "routes/users/$username",
        "pages/one",
        "pages/two",
        "__entry_server__",
      ]
    `);
  });

  it("writes the server manifest", async () => {
    let serverBuild = await build(remixConfig, { target: BuildTarget.Server });

    await serverBuild.write({
      exports: "named",
      dir: remixConfig.serverBuildDirectory,
      format: "cjs"
    });

    let manifest = getServerManifest(remixConfig.serverBuildDirectory);

    expect(manifest).toMatchInlineSnapshot(`
      Object {
        "__entry_server__": Object {
          "fileName": "__entry_server__.js",
          "imports": Array [
            "react",
            "@remix-run/react",
            "react-dom/server",
            "@remix-run/core",
            "@remix-run/react/server",
          ],
        },
        "pages/one": Object {
          "fileName": "pages/one.js",
          "imports": Array [
            "react",
          ],
        },
        "pages/two": Object {
          "fileName": "pages/two.js",
          "imports": Array [
            "react",
          ],
        },
        "routes/404": Object {
          "fileName": "routes/404.js",
          "imports": Array [
            "react",
          ],
        },
        "routes/gists": Object {
          "fileName": "routes/gists.js",
          "imports": Array [
            "react",
            "react-router-dom",
            "@remix-run/react",
          ],
        },
        "routes/gists.mine": Object {
          "fileName": "routes/gists.mine.js",
          "imports": Array [
            "react",
          ],
        },
        "routes/gists/$username": Object {
          "fileName": "routes/gists/$username.js",
          "imports": Array [
            "react",
            "react-router-dom",
            "@remix-run/react",
          ],
        },
        "routes/gists/$username/edit": Object {
          "fileName": "routes/gists/$username/edit.js",
          "imports": Array [
            "react",
          ],
        },
        "routes/gists/index": Object {
          "fileName": "routes/gists/index.js",
          "imports": Array [
            "react",
            "@remix-run/react",
          ],
        },
        "routes/index": Object {
          "fileName": "routes/index.js",
          "imports": Array [
            "react",
            "@remix-run/react",
          ],
        },
        "routes/payments": Object {
          "fileName": "routes/payments.js",
          "imports": Array [
            "react",
            "react-router-dom",
          ],
        },
        "routes/payments/error": Object {
          "fileName": "routes/payments/error.js",
          "imports": Array [
            "react",
          ],
        },
        "routes/users": Object {
          "fileName": "routes/users.js",
          "imports": Array [
            "react",
          ],
        },
        "routes/users/$username": Object {
          "fileName": "routes/users/$username.js",
          "imports": Array [
            "react",
          ],
        },
      }
    `);
  });
});
