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
        loadersDirectory: expect.any(String),
        rootDirectory: expect.any(String),
        serverBuildDirectory: expect.any(String)
      },
      `
      Object {
        "appDirectory": Any<String>,
        "browserBuildDirectory": Any<String>,
        "devServerPort": 8002,
        "loadersDirectory": Any<String>,
        "mdx": undefined,
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
          "routes/500": Object {
            "componentFile": "routes/500.js",
            "id": "routes/500",
            "path": "500",
          },
          "routes/gists": Object {
            "componentFile": "routes/gists.js",
            "id": "routes/gists",
            "loaderFile": "routes/gists.js",
            "path": "gists",
            "stylesFile": "routes/gists.css",
          },
          "routes/gists.mine": Object {
            "componentFile": "routes/gists.mine.js",
            "id": "routes/gists.mine",
            "path": "gists/mine",
          },
          "routes/gists/$username": Object {
            "componentFile": "routes/gists/$username.js",
            "id": "routes/gists/$username",
            "loaderFile": "routes/gists/$username.js",
            "parentId": "routes/gists",
            "path": ":username",
          },
          "routes/gists/index": Object {
            "componentFile": "routes/gists/index.js",
            "id": "routes/gists/index",
            "loaderFile": "routes/gists/index.js",
            "parentId": "routes/gists",
            "path": "/",
          },
          "routes/index": Object {
            "componentFile": "routes/index.js",
            "id": "routes/index",
            "path": "/",
          },
          "routes/methods": Object {
            "componentFile": "routes/methods.tsx",
            "id": "routes/methods",
            "loaderFile": "routes/methods.js",
            "path": "methods",
            "stylesFile": "routes/methods.css",
          },
          "routes/page/four": Object {
            "componentFile": "routes/page/four.mdx",
            "id": "routes/page/four",
            "path": "page/four",
          },
          "routes/page/three": Object {
            "componentFile": "routes/page/three.md",
            "id": "routes/page/three",
            "path": "page/three",
          },
        },
        "routes": Array [
          Object {
            "componentFile": "routes/404.js",
            "id": "routes/404",
            "path": "404",
          },
          Object {
            "componentFile": "routes/500.js",
            "id": "routes/500",
            "path": "500",
          },
          Object {
            "children": Array [
              Object {
                "componentFile": "routes/gists/$username.js",
                "id": "routes/gists/$username",
                "loaderFile": "routes/gists/$username.js",
                "parentId": "routes/gists",
                "path": ":username",
              },
              Object {
                "componentFile": "routes/gists/index.js",
                "id": "routes/gists/index",
                "loaderFile": "routes/gists/index.js",
                "parentId": "routes/gists",
                "path": "/",
              },
            ],
            "componentFile": "routes/gists.js",
            "id": "routes/gists",
            "loaderFile": "routes/gists.js",
            "path": "gists",
            "stylesFile": "routes/gists.css",
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
            "componentFile": "routes/methods.tsx",
            "id": "routes/methods",
            "loaderFile": "routes/methods.js",
            "path": "methods",
            "stylesFile": "routes/methods.css",
          },
          Object {
            "componentFile": "routes/page/four.mdx",
            "id": "routes/page/four",
            "path": "page/four",
          },
          Object {
            "componentFile": "routes/page/three.md",
            "id": "routes/page/three",
            "path": "page/three",
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
        "serverMode": "production",
      }
    `
    );
  });
});
