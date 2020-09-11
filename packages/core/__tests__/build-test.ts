import path from "path";

import { build } from "../compiler";
import type { RemixConfig } from "../config";
import { readConfig } from "../config";

describe("build", () => {
  let remixRoot: string;
  let remixConfig: RemixConfig;

  beforeAll(async () => {
    remixRoot = path.resolve(__dirname, "../../../fixtures/gists-app");
    remixConfig = await readConfig(remixRoot);
  });

  it("generates a bundle for each input", async () => {
    let bundle = await build({ remixRoot });
    let { output } = await bundle.generate({
      exports: "named",
      format: "cjs"
    });

    let names = output.map(value => value.name);

    expect(names).toMatchInlineSnapshot(`
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
        "__entry_server__",
      ]
    `);
  });

  it("writes the manifest", async () => {
    let bundle = await build({ remixRoot });

    await bundle.write({
      exports: "named",
      dir: remixConfig.serverBuildDirectory,
      format: "cjs"
    });

    let manifestFile = path.join(
      remixConfig.serverBuildDirectory,
      "manifest.json"
    );
    let manifest = require(manifestFile);

    expect(manifest).toMatchInlineSnapshot(`
      Object {
        "__entry_server__": Object {
          "imports": Array [
            "react",
            "react-dom/server",
            "@remix-run/core",
          ],
          "requirePath": "/Users/michael/Projects/remix/fixtures/gists-app/build/__entry_server__.js",
        },
        "routes/404": Object {
          "imports": Array [
            "react",
          ],
          "requirePath": "/Users/michael/Projects/remix/fixtures/gists-app/build/routes/404.js",
        },
        "routes/gists": Object {
          "imports": Array [
            "react",
            "react-router-dom",
            "@remix-run/react",
          ],
          "requirePath": "/Users/michael/Projects/remix/fixtures/gists-app/build/routes/gists.js",
        },
        "routes/gists.mine": Object {
          "imports": Array [
            "react",
          ],
          "requirePath": "/Users/michael/Projects/remix/fixtures/gists-app/build/routes/gists.mine.js",
        },
        "routes/gists/$username": Object {
          "imports": Array [
            "react",
            "react-router-dom",
            "@remix-run/react",
          ],
          "requirePath": "/Users/michael/Projects/remix/fixtures/gists-app/build/routes/gists/$username.js",
        },
        "routes/gists/$username/edit": Object {
          "imports": Array [],
          "requirePath": "/Users/michael/Projects/remix/fixtures/gists-app/build/routes/gists/$username/edit.js",
        },
        "routes/gists/index": Object {
          "imports": Array [
            "react",
            "@remix-run/react",
          ],
          "requirePath": "/Users/michael/Projects/remix/fixtures/gists-app/build/routes/gists/index.js",
        },
        "routes/index": Object {
          "imports": Array [
            "react",
            "@remix-run/react",
          ],
          "requirePath": "/Users/michael/Projects/remix/fixtures/gists-app/build/routes/index.js",
        },
        "routes/payments": Object {
          "imports": Array [
            "react",
            "react-router-dom",
          ],
          "requirePath": "/Users/michael/Projects/remix/fixtures/gists-app/build/routes/payments.js",
        },
        "routes/payments/error": Object {
          "imports": Array [
            "react",
          ],
          "requirePath": "/Users/michael/Projects/remix/fixtures/gists-app/build/routes/payments/error.js",
        },
        "routes/users": Object {
          "imports": Array [],
          "requirePath": "/Users/michael/Projects/remix/fixtures/gists-app/build/routes/users.js",
        },
        "routes/users/$username": Object {
          "imports": Array [],
          "requirePath": "/Users/michael/Projects/remix/fixtures/gists-app/build/routes/users/$username.js",
        },
      }
    `);
  });
});
