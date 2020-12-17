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
        rootDirectory: expect.any(String),
        serverBuildDirectory: expect.any(String)
      },
      `
      Object {
        "appDirectory": Any<String>,
        "browserBuildDirectory": Any<String>,
        "devServerPort": 8002,
        "mdx": undefined,
        "publicPath": "/build/",
        "rootDirectory": Any<String>,
        "routeManifest": Object {
          "pages/one": Object {
            "id": "pages/one",
            "moduleFile": "pages/one.mdx",
            "path": "/page/one",
          },
          "pages/two": Object {
            "id": "pages/two",
            "moduleFile": "pages/two.mdx",
            "path": "/page/two",
          },
          "routes/404": Object {
            "id": "routes/404",
            "moduleFile": "routes/404.js",
            "path": "404",
          },
          "routes/500": Object {
            "id": "routes/500",
            "moduleFile": "routes/500.js",
            "path": "500",
          },
          "routes/gists": Object {
            "id": "routes/gists",
            "moduleFile": "routes/gists.js",
            "path": "gists",
            "stylesFile": "routes/gists.css",
          },
          "routes/gists.mine": Object {
            "id": "routes/gists.mine",
            "moduleFile": "routes/gists.mine.js",
            "path": "gists/mine",
          },
          "routes/gists/$username": Object {
            "id": "routes/gists/$username",
            "moduleFile": "routes/gists/$username.js",
            "parentId": "routes/gists",
            "path": ":username",
          },
          "routes/gists/index": Object {
            "id": "routes/gists/index",
            "moduleFile": "routes/gists/index.js",
            "parentId": "routes/gists",
            "path": "/",
          },
          "routes/index": Object {
            "id": "routes/index",
            "moduleFile": "routes/index.js",
            "path": "/",
          },
          "routes/methods": Object {
            "id": "routes/methods",
            "moduleFile": "routes/methods.tsx",
            "path": "methods",
            "stylesFile": "routes/methods.css",
          },
          "routes/page/four": Object {
            "id": "routes/page/four",
            "moduleFile": "routes/page/four.mdx",
            "path": "page/four",
          },
          "routes/page/three": Object {
            "id": "routes/page/three",
            "moduleFile": "routes/page/three.md",
            "path": "page/three",
          },
        },
        "routes": Array [
          Object {
            "id": "routes/404",
            "moduleFile": "routes/404.js",
            "path": "404",
          },
          Object {
            "id": "routes/500",
            "moduleFile": "routes/500.js",
            "path": "500",
          },
          Object {
            "children": Array [
              Object {
                "id": "routes/gists/$username",
                "moduleFile": "routes/gists/$username.js",
                "parentId": "routes/gists",
                "path": ":username",
              },
              Object {
                "id": "routes/gists/index",
                "moduleFile": "routes/gists/index.js",
                "parentId": "routes/gists",
                "path": "/",
              },
            ],
            "id": "routes/gists",
            "moduleFile": "routes/gists.js",
            "path": "gists",
            "stylesFile": "routes/gists.css",
          },
          Object {
            "id": "routes/gists.mine",
            "moduleFile": "routes/gists.mine.js",
            "path": "gists/mine",
          },
          Object {
            "id": "routes/index",
            "moduleFile": "routes/index.js",
            "path": "/",
          },
          Object {
            "id": "routes/methods",
            "moduleFile": "routes/methods.tsx",
            "path": "methods",
            "stylesFile": "routes/methods.css",
          },
          Object {
            "id": "routes/page/four",
            "moduleFile": "routes/page/four.mdx",
            "path": "page/four",
          },
          Object {
            "id": "routes/page/three",
            "moduleFile": "routes/page/three.md",
            "path": "page/three",
          },
          Object {
            "id": "pages/one",
            "moduleFile": "pages/one.mdx",
            "path": "/page/one",
          },
          Object {
            "id": "pages/two",
            "moduleFile": "pages/two.mdx",
            "path": "/page/two",
          },
        ],
        "serverBuildDirectory": Any<String>,
        "serverMode": "production",
      }
    `
    );
  });
});
