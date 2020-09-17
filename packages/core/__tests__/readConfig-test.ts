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
            "component": "routes/404.js",
            "id": "routes/404",
            "loader": null,
            "path": "*",
          },
          Object {
            "children": Array [
              Object {
                "children": Array [
                  Object {
                    "component": "routes/gists/$username/edit.js",
                    "id": "routes/gists/$username/edit",
                    "loader": null,
                    "parentId": "routes/gists/$username",
                    "path": "edit",
                  },
                ],
                "component": "routes/gists/$username.js",
                "id": "routes/gists/$username",
                "loader": "gists/$username.js",
                "parentId": "routes/gists",
                "path": ":username",
              },
              Object {
                "component": "routes/gists/$username.js",
                "id": "routes/gists/$username",
                "loader": "gists/$username.js",
                "parentId": "routes/gists",
                "path": ":username",
              },
              Object {
                "component": "routes/gists/index.js",
                "id": "routes/gists/index",
                "loader": "gists/index.js",
                "parentId": "routes/gists",
                "path": "/",
              },
            ],
            "component": "routes/gists.js",
            "id": "routes/gists",
            "loader": null,
            "path": "gists",
          },
          Object {
            "component": "routes/gists.mine.js",
            "id": "routes/gists.mine",
            "loader": null,
            "path": "gists/mine",
          },
          Object {
            "component": "routes/index.js",
            "id": "routes/index",
            "loader": null,
            "path": "/",
          },
          Object {
            "children": Array [
              Object {
                "component": "routes/payments/error.js",
                "id": "routes/payments/error",
                "loader": "payments/error.js",
                "parentId": "routes/payments",
                "path": "error",
              },
            ],
            "component": "routes/payments.js",
            "id": "routes/payments",
            "loader": null,
            "path": "payments",
          },
          Object {
            "children": Array [
              Object {
                "component": "routes/users/$username.js",
                "id": "routes/users/$username",
                "loader": "users/$username.js",
                "parentId": "routes/users",
                "path": ":username",
              },
            ],
            "component": "routes/users.js",
            "id": "routes/users",
            "loader": null,
            "path": "users",
          },
          Object {
            "component": "pages/one.js",
            "id": "pages/one",
            "loader": null,
            "path": "/page/one",
          },
          Object {
            "component": "pages/two.js",
            "id": "pages/two",
            "loader": null,
            "path": "/page/two",
          },
        ],
        "serverBuildDirectory": "/Users/michael/Projects/remix/fixtures/gists-app/build",
        "sourceDirectory": "/Users/michael/Projects/remix/fixtures/gists-app/src",
      }
    `);
  });
});
