import path from "path";

import { readConfig } from "../config";

describe("readConfig", () => {
  it("generates a config", async () => {
    let root = path.resolve(__dirname, "../../../fixtures/gists-app");
    let config = await readConfig(root);

    expect(config).toMatchInlineSnapshot(`
      Object {
        "browserBuildDirectory": "/Users/michael/Projects/remix/fixtures/gists-app/public/build",
        "devServerPort": 8002,
        "loadersDirectory": "/Users/michael/Projects/remix/fixtures/gists-app/loaders",
        "publicPath": "/build/",
        "rootDirectory": "/Users/michael/Projects/remix/fixtures/gists-app",
        "routes": Array [
          Object {
            "componentFile": "routes/404.js",
            "id": "routes/404",
            "path": "*",
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
                "loaderFile": "gists/$username.js",
                "parentId": "routes/gists",
                "path": ":username",
              },
              Object {
                "componentFile": "routes/gists/$username.js",
                "id": "routes/gists/$username",
                "loaderFile": "gists/$username.js",
                "parentId": "routes/gists",
                "path": ":username",
              },
              Object {
                "componentFile": "routes/gists/index.js",
                "id": "routes/gists/index",
                "loaderFile": "gists/index.js",
                "parentId": "routes/gists",
                "path": "/",
              },
            ],
            "componentFile": "routes/gists.js",
            "id": "routes/gists",
            "loaderFile": "gists.js",
            "path": "gists",
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
                "loaderFile": "payments/error.js",
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
                "loaderFile": "users/$username.js",
                "parentId": "routes/users",
                "path": ":username",
              },
            ],
            "componentFile": "routes/users.js",
            "id": "routes/users",
            "path": "users",
            "stylesFile": "users.css",
          },
          Object {
            "componentFile": "pages/one.js",
            "id": "pages/one",
            "path": "/page/one",
          },
          Object {
            "componentFile": "pages/two.js",
            "id": "pages/two",
            "path": "/page/two",
          },
        ],
        "serverBuildDirectory": "/Users/michael/Projects/remix/fixtures/gists-app/build",
        "sourceDirectory": "/Users/michael/Projects/remix/fixtures/gists-app/src",
        "stylesDirectory": "/Users/michael/Projects/remix/fixtures/gists-app/src/styles",
      }
    `);
  });
});
