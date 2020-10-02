import path from "path";

import type { RemixConfig } from "../config";
import { readConfig } from "../config";

const remixRoot = path.resolve(__dirname, "../../../fixtures/gists-app");

describe("readConfig", () => {
  let config: RemixConfig;
  beforeEach(async () => {
    config = await readConfig(remixRoot);
  });

  it("generates a config", async () => {
    expect(config).toMatchInlineSnapshot(
      {
        appDirectory: expect.any(String),
        browserBuildDirectory: expect.any(String),
        dataDirectory: expect.any(String),
        rootDirectory: expect.any(String),
        serverBuildDirectory: expect.any(String)
      },
      `
      Object {
        "appDirectory": Any<String>,
        "browserBuildDirectory": Any<String>,
        "dataDirectory": Any<String>,
        "devServerPort": 8002,
        "publicPath": "/build/",
        "rootDirectory": Any<String>,
        "routeManifest": Object {
          "pages/one": Object {
            "componentFile": "pages/one.mdx",
            "id": "pages/one",
            "path": "/page/one",
          },
          "pages/two": Object {
            "componentFile": "pages/two.mdx",
            "id": "pages/two",
            "path": "/page/two",
          },
          "routes/404": Object {
            "componentFile": "routes/404.js",
            "id": "routes/404",
            "path": "404",
          },
          "routes/gists": Object {
            "children": Array [
              Object {
                "children": Array [
                  Object {
                    "componentFile": "routes/gists/$username/edit.js",
                    "id": "routes/gists/$username/edit",
                    "parentId": "routes/gists/$username",
                    "path": "edit",
                  },
                ],
                "componentFile": "routes/gists/$username.js",
                "id": "routes/gists/$username",
                "loaderFile": "loaders/gists/$username.js",
                "parentId": "routes/gists",
                "path": ":username",
              },
              Object {
                "componentFile": "routes/gists/index.js",
                "id": "routes/gists/index",
                "loaderFile": "loaders/gists/index.js",
                "parentId": "routes/gists",
                "path": "/",
              },
            ],
            "componentFile": "routes/gists.js",
            "id": "routes/gists",
            "loaderFile": "loaders/gists.js",
            "path": "gists",
            "stylesFile": "styles/gists.css",
          },
          "routes/gists.mine": Object {
            "componentFile": "routes/gists.mine.js",
            "id": "routes/gists.mine",
            "path": "gists/mine",
          },
          "routes/gists/$username": Object {
            "children": Array [
              Object {
                "componentFile": "routes/gists/$username/edit.js",
                "id": "routes/gists/$username/edit",
                "parentId": "routes/gists/$username",
                "path": "edit",
              },
            ],
            "componentFile": "routes/gists/$username.js",
            "id": "routes/gists/$username",
            "loaderFile": "loaders/gists/$username.js",
            "parentId": "routes/gists",
            "path": ":username",
          },
          "routes/gists/$username/edit": Object {
            "componentFile": "routes/gists/$username/edit.js",
            "id": "routes/gists/$username/edit",
            "parentId": "routes/gists/$username",
            "path": "edit",
          },
          "routes/gists/index": Object {
            "componentFile": "routes/gists/index.js",
            "id": "routes/gists/index",
            "loaderFile": "loaders/gists/index.js",
            "parentId": "routes/gists",
            "path": "/",
          },
          "routes/index": Object {
            "componentFile": "routes/index.js",
            "id": "routes/index",
            "path": "/",
          },
          "routes/payments": Object {
            "children": Array [
              Object {
                "componentFile": "routes/payments/error.js",
                "id": "routes/payments/error",
                "loaderFile": "loaders/payments/error.js",
                "parentId": "routes/payments",
                "path": "error",
              },
            ],
            "componentFile": "routes/payments.js",
            "id": "routes/payments",
            "path": "payments",
          },
          "routes/payments/error": Object {
            "componentFile": "routes/payments/error.js",
            "id": "routes/payments/error",
            "loaderFile": "loaders/payments/error.js",
            "parentId": "routes/payments",
            "path": "error",
          },
          "routes/users": Object {
            "children": Array [
              Object {
                "componentFile": "routes/users/$username.js",
                "id": "routes/users/$username",
                "loaderFile": "loaders/users/$username.js",
                "parentId": "routes/users",
                "path": ":username",
              },
            ],
            "componentFile": "routes/users.js",
            "id": "routes/users",
            "path": "users",
            "stylesFile": "styles/users.css",
          },
          "routes/users/$username": Object {
            "componentFile": "routes/users/$username.js",
            "id": "routes/users/$username",
            "loaderFile": "loaders/users/$username.js",
            "parentId": "routes/users",
            "path": ":username",
          },
        },
        "routes": Array [
          Object {
            "componentFile": "routes/404.js",
            "id": "routes/404",
            "path": "404",
          },
          Object {
            "children": Array [
              Object {
                "children": Array [
                  Object {
                    "componentFile": "routes/gists/$username/edit.js",
                    "id": "routes/gists/$username/edit",
                    "parentId": "routes/gists/$username",
                    "path": "edit",
                  },
                ],
                "componentFile": "routes/gists/$username.js",
                "id": "routes/gists/$username",
                "loaderFile": "loaders/gists/$username.js",
                "parentId": "routes/gists",
                "path": ":username",
              },
              Object {
                "componentFile": "routes/gists/index.js",
                "id": "routes/gists/index",
                "loaderFile": "loaders/gists/index.js",
                "parentId": "routes/gists",
                "path": "/",
              },
            ],
            "componentFile": "routes/gists.js",
            "id": "routes/gists",
            "loaderFile": "loaders/gists.js",
            "path": "gists",
            "stylesFile": "styles/gists.css",
          },
          Object {
            "componentFile": "routes/gists.mine.js",
            "id": "routes/gists.mine",
            "path": "gists/mine",
          },
          Object {
            "componentFile": "routes/index.js",
            "id": "routes/index",
            "path": "/",
          },
          Object {
            "children": Array [
              Object {
                "componentFile": "routes/payments/error.js",
                "id": "routes/payments/error",
                "loaderFile": "loaders/payments/error.js",
                "parentId": "routes/payments",
                "path": "error",
              },
            ],
            "componentFile": "routes/payments.js",
            "id": "routes/payments",
            "path": "payments",
          },
          Object {
            "children": Array [
              Object {
                "componentFile": "routes/users/$username.js",
                "id": "routes/users/$username",
                "loaderFile": "loaders/users/$username.js",
                "parentId": "routes/users",
                "path": ":username",
              },
            ],
            "componentFile": "routes/users.js",
            "id": "routes/users",
            "path": "users",
            "stylesFile": "styles/users.css",
          },
          Object {
            "componentFile": "pages/one.mdx",
            "id": "pages/one",
            "path": "/page/one",
          },
          Object {
            "componentFile": "pages/two.mdx",
            "id": "pages/two",
            "path": "/page/two",
          },
        ],
        "serverBuildDirectory": Any<String>,
      }
    `
    );
  });
});
