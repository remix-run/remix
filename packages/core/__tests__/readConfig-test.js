import path from "path";

import { readConfig } from "../config";

describe("readConfig", () => {
  it("generates a config", async () => {
    let root = path.resolve(__dirname, "../../../fixtures/gists-app");
    let config = await readConfig(root);

    expect(config).toMatchInlineSnapshot(`
      Object {
        "clientBuildDirectory": "/Users/michael/Projects/remix/fixtures/gists-app/public/build",
        "clientPublicPath": "/build",
        "devServerPort": 8002,
        "loadersDirectory": "/Users/michael/Projects/remix/fixtures/gists-app/loaders",
        "rootDirectory": "/Users/michael/Projects/remix/fixtures/gists-app",
        "routesConfig": Array [
          Object {
            "component": "routes/404.js",
            "id": "routes/404",
            "loader": null,
            "parentId": null,
            "path": "*",
          },
          Object {
            "children": Array [
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
            "parentId": null,
            "path": "gists",
          },
          Object {
            "component": "routes/gists.mine.js",
            "id": "routes/gists.mine",
            "loader": null,
            "parentId": null,
            "path": "gists/mine",
          },
          Object {
            "component": "routes/index.js",
            "id": "routes/index",
            "loader": null,
            "parentId": null,
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
            "parentId": null,
            "path": "payments",
          },
          Object {
            "component": "pages/one.mdx",
            "id": "pages/one",
            "loader": null,
            "parentId": null,
            "path": "/page/one",
          },
          Object {
            "component": "pages/two.mdx",
            "id": "pages/two",
            "loader": null,
            "parentId": null,
            "path": "/page/two",
          },
        ],
        "routesDirectory": "/Users/michael/Projects/remix/fixtures/gists-app/src/routes",
        "serverBuildDirectory": "/Users/michael/Projects/remix/fixtures/gists-app/build",
      }
    `);
  });
});
