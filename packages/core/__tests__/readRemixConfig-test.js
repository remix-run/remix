import path from "path";
// import { fileURLToPath } from "url";

import readRemixConfig from "../readRemixConfig";

// let dirname = path.dirname(fileURLToPath(import.meta.url));

describe("readRemixConfig", () => {
  it("generates a config", async () => {
    let root = path.resolve(__dirname, "../../../fixtures/gists-app");
    let config = await readRemixConfig(root);
    expect(config).toMatchInlineSnapshot(`
      Object {
        "appRoot": "/Users/ryan/Work/remix/fixtures/gists-app",
        "devServer": Object {
          "port": 8002,
        },
        "paths": Object {
          "clientBuildDirectory": "./public/build",
          "clientPublicPath": "/build/",
          "loadersDirectory": "./loaders",
          "serverBuildDirectory": "./build",
        },
        "routes": [Function],
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
      }
    `);
  });
});
