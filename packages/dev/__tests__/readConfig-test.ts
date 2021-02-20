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
            "parentId": "root",
            "path": "/page/one",
          },
          "pages/two": Object {
            "id": "pages/two",
            "moduleFile": "pages/two.mdx",
            "parentId": "root",
            "path": "/page/two",
          },
          "root": Object {
            "id": "root",
            "moduleFile": "root.js",
            "path": "/",
          },
          "routes/404": Object {
            "id": "routes/404",
            "moduleFile": "routes/404.js",
            "parentId": "root",
            "path": "*",
          },
          "routes/gists": Object {
            "id": "routes/gists",
            "moduleFile": "routes/gists.js",
            "parentId": "root",
            "path": "gists",
          },
          "routes/gists.mine": Object {
            "id": "routes/gists.mine",
            "moduleFile": "routes/gists.mine.js",
            "parentId": "root",
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
            "parentId": "root",
            "path": "/",
          },
          "routes/links": Object {
            "id": "routes/links",
            "moduleFile": "routes/links.tsx",
            "parentId": "root",
            "path": "links",
          },
          "routes/loader-errors": Object {
            "id": "routes/loader-errors",
            "moduleFile": "routes/loader-errors.js",
            "parentId": "root",
            "path": "loader-errors",
          },
          "routes/loader-errors/nested": Object {
            "id": "routes/loader-errors/nested",
            "moduleFile": "routes/loader-errors/nested.js",
            "parentId": "routes/loader-errors",
            "path": "nested",
          },
          "routes/methods": Object {
            "id": "routes/methods",
            "moduleFile": "routes/methods.tsx",
            "parentId": "root",
            "path": "methods",
          },
          "routes/page/four": Object {
            "id": "routes/page/four",
            "moduleFile": "routes/page/four.mdx",
            "parentId": "root",
            "path": "page/four",
          },
          "routes/page/three": Object {
            "id": "routes/page/three",
            "moduleFile": "routes/page/three.md",
            "parentId": "root",
            "path": "page/three",
          },
          "routes/prefs": Object {
            "id": "routes/prefs",
            "moduleFile": "routes/prefs.tsx",
            "parentId": "root",
            "path": "prefs",
          },
          "routes/render-errors": Object {
            "id": "routes/render-errors",
            "moduleFile": "routes/render-errors.js",
            "parentId": "root",
            "path": "render-errors",
          },
          "routes/render-errors/nested": Object {
            "id": "routes/render-errors/nested",
            "moduleFile": "routes/render-errors/nested.js",
            "parentId": "routes/render-errors",
            "path": "nested",
          },
        },
        "routes": Array [
          Object {
            "children": Array [
              Object {
                "id": "routes/404",
                "moduleFile": "routes/404.js",
                "parentId": "root",
                "path": "*",
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
                "parentId": "root",
                "path": "gists",
              },
              Object {
                "id": "routes/gists.mine",
                "moduleFile": "routes/gists.mine.js",
                "parentId": "root",
                "path": "gists/mine",
              },
              Object {
                "id": "routes/index",
                "moduleFile": "routes/index.js",
                "parentId": "root",
                "path": "/",
              },
              Object {
                "id": "routes/links",
                "moduleFile": "routes/links.tsx",
                "parentId": "root",
                "path": "links",
              },
              Object {
                "children": Array [
                  Object {
                    "id": "routes/loader-errors/nested",
                    "moduleFile": "routes/loader-errors/nested.js",
                    "parentId": "routes/loader-errors",
                    "path": "nested",
                  },
                ],
                "id": "routes/loader-errors",
                "moduleFile": "routes/loader-errors.js",
                "parentId": "root",
                "path": "loader-errors",
              },
              Object {
                "id": "routes/methods",
                "moduleFile": "routes/methods.tsx",
                "parentId": "root",
                "path": "methods",
              },
              Object {
                "id": "routes/page/four",
                "moduleFile": "routes/page/four.mdx",
                "parentId": "root",
                "path": "page/four",
              },
              Object {
                "id": "routes/page/three",
                "moduleFile": "routes/page/three.md",
                "parentId": "root",
                "path": "page/three",
              },
              Object {
                "id": "routes/prefs",
                "moduleFile": "routes/prefs.tsx",
                "parentId": "root",
                "path": "prefs",
              },
              Object {
                "children": Array [
                  Object {
                    "id": "routes/render-errors/nested",
                    "moduleFile": "routes/render-errors/nested.js",
                    "parentId": "routes/render-errors",
                    "path": "nested",
                  },
                ],
                "id": "routes/render-errors",
                "moduleFile": "routes/render-errors.js",
                "parentId": "root",
                "path": "render-errors",
              },
              Object {
                "id": "pages/one",
                "moduleFile": "pages/one.mdx",
                "parentId": "root",
                "path": "/page/one",
              },
              Object {
                "id": "pages/two",
                "moduleFile": "pages/two.mdx",
                "parentId": "root",
                "path": "/page/two",
              },
            ],
            "id": "root",
            "moduleFile": "root.js",
            "path": "/",
          },
        ],
        "serverBuildDirectory": Any<String>,
        "serverMode": "production",
      }
    `
    );
  });
});
