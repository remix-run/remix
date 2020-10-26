import path from "path";
import type { OutputAsset, RollupOutput } from "rollup";

import type { BuildOptions } from "../compiler";
import { BuildMode, BuildTarget, build, generate } from "../compiler";
import type { RemixConfig } from "../config";
import { readConfig } from "../config";

async function generateBuild(config: RemixConfig, options: BuildOptions) {
  return await generate(await build(config, options));
}

function getFilenames(output: RollupOutput) {
  return output.output.map(item => item.fileName).sort();
}

function getManifest(output: RollupOutput, name: string) {
  let asset = output.output.find(
    item => item.type === "asset" && item.fileName === name
  ) as OutputAsset;

  return JSON.parse(asset.source as string);
}

const remixRoot = path.resolve(__dirname, "../../../fixtures/gists-app");

describe("building", () => {
  let config: RemixConfig;
  beforeAll(async () => {
    config = await readConfig(remixRoot);
  });

  beforeEach(() => {
    jest.setTimeout(10000);
  });

  describe("the development server build", () => {
    it("generates the correct bundles and manifest", async () => {
      let output = await generateBuild(config, {
        mode: BuildMode.Development,
        target: BuildTarget.Server
      });

      expect(getFilenames(output)).toMatchInlineSnapshot(`
        Array [
          "_shared/Shared-4f69c99e.js",
          "_shared/_rollupPluginBabelHelpers-8a275fd9.js",
          "entry-server.js",
          "pages/one.js",
          "pages/two.js",
          "routes/404.js",
          "routes/500.js",
          "routes/gists.js",
          "routes/gists.mine.js",
          "routes/gists/$username.js",
          "routes/gists/index.js",
          "routes/index.js",
          "routes/page/four.js",
          "routes/page/three.js",
          "server-manifest.json",
        ]
      `);

      expect(getManifest(output, "server-manifest.json")).toMatchInlineSnapshot(
        {
          version: expect.any(String)
        },
        `
        Object {
          "entries": Object {
            "entry-server": Object {
              "file": "entry-server.js",
            },
            "pages/one": Object {
              "file": "pages/one.js",
            },
            "pages/two": Object {
              "file": "pages/two.js",
            },
            "routes/404": Object {
              "file": "routes/404.js",
            },
            "routes/500": Object {
              "file": "routes/500.js",
            },
            "routes/gists": Object {
              "file": "routes/gists.js",
            },
            "routes/gists.mine": Object {
              "file": "routes/gists.mine.js",
            },
            "routes/gists/$username": Object {
              "file": "routes/gists/$username.js",
            },
            "routes/gists/index": Object {
              "file": "routes/gists/index.js",
            },
            "routes/index": Object {
              "file": "routes/index.js",
            },
            "routes/page/four": Object {
              "file": "routes/page/four.js",
            },
            "routes/page/three": Object {
              "file": "routes/page/three.js",
            },
          },
          "version": Any<String>,
        }
      `
      );
    });
  });

  describe("the production server build", () => {
    it("generates the correct bundles and manifest", async () => {
      let output = await generateBuild(config, {
        mode: BuildMode.Production,
        target: BuildTarget.Server
      });

      expect(getFilenames(output)).toMatchInlineSnapshot(`
        Array [
          "_shared/Shared-4f69c99e.js",
          "_shared/_rollupPluginBabelHelpers-8a275fd9.js",
          "entry-server-8861fcaf.js",
          "pages/one-84a0981a.js",
          "pages/two-c45d0835.js",
          "routes/404-660aace6.js",
          "routes/500-3568401c.js",
          "routes/gists-30e67783.js",
          "routes/gists.mine-9c786e2b.js",
          "routes/gists/$username-ebf86aaf.js",
          "routes/gists/index-c6bcfd56.js",
          "routes/index-933c0125.js",
          "routes/page/four-c9ce2fc6.js",
          "routes/page/three-cbc19f53.js",
          "server-manifest.json",
        ]
      `);

      expect(getManifest(output, "server-manifest.json")).toMatchInlineSnapshot(
        {
          version: expect.any(String)
        },
        `
        Object {
          "entries": Object {
            "entry-server": Object {
              "file": "entry-server-8861fcaf.js",
            },
            "pages/one": Object {
              "file": "pages/one-84a0981a.js",
            },
            "pages/two": Object {
              "file": "pages/two-c45d0835.js",
            },
            "routes/404": Object {
              "file": "routes/404-660aace6.js",
            },
            "routes/500": Object {
              "file": "routes/500-3568401c.js",
            },
            "routes/gists": Object {
              "file": "routes/gists-30e67783.js",
            },
            "routes/gists.mine": Object {
              "file": "routes/gists.mine-9c786e2b.js",
            },
            "routes/gists/$username": Object {
              "file": "routes/gists/$username-ebf86aaf.js",
            },
            "routes/gists/index": Object {
              "file": "routes/gists/index-c6bcfd56.js",
            },
            "routes/index": Object {
              "file": "routes/index-933c0125.js",
            },
            "routes/page/four": Object {
              "file": "routes/page/four-c9ce2fc6.js",
            },
            "routes/page/three": Object {
              "file": "routes/page/three-cbc19f53.js",
            },
          },
          "version": Any<String>,
        }
      `
      );
    });
  });

  describe("the development browser build", () => {
    it("generates the correct bundles and manifest", async () => {
      let output = await generateBuild(config, {
        mode: BuildMode.Development,
        target: BuildTarget.Browser
      });

      expect(getFilenames(output)).toMatchInlineSnapshot(`
        Array [
          "_shared/Shared-cef07a94.js",
          "_shared/_rollupPluginBabelHelpers-bfa6c712.js",
          "_shared/node_modules/@babel/runtime-f4ff0cc0.js",
          "_shared/node_modules/@mdx-js/react-0e8f3297.js",
          "_shared/node_modules/@remix-run/react-8d54131a.js",
          "_shared/node_modules/history-45437576.js",
          "_shared/node_modules/object-assign-c47a16a6.js",
          "_shared/node_modules/prop-types-a68204f7.js",
          "_shared/node_modules/react-409c253d.js",
          "_shared/node_modules/react-dom-756cf4b2.js",
          "_shared/node_modules/react-is-fda2a98c.js",
          "_shared/node_modules/react-router-2cee1434.js",
          "_shared/node_modules/react-router-dom-3388b7e7.js",
          "_shared/node_modules/scheduler-e81ceb73.js",
          "asset-manifest.json",
          "entry-browser.js",
          "global.css",
          "pages/one.js",
          "pages/two.js",
          "routes/404.js",
          "routes/500.js",
          "routes/gists.css",
          "routes/gists.js",
          "routes/gists.mine.js",
          "routes/gists/$username.js",
          "routes/gists/index.js",
          "routes/index.js",
          "routes/page/four.js",
          "routes/page/three.js",
        ]
      `);

      expect(getManifest(output, "asset-manifest.json")).toMatchInlineSnapshot(
        {
          version: expect.any(String)
        },
        `
        Object {
          "entries": Object {
            "entry-browser": Object {
              "file": "entry-browser.js",
            },
            "global.css": Object {
              "file": "global.css",
            },
            "pages/one": Object {
              "file": "pages/one.js",
            },
            "pages/two": Object {
              "file": "pages/two.js",
            },
            "routes/404": Object {
              "file": "routes/404.js",
            },
            "routes/500": Object {
              "file": "routes/500.js",
            },
            "routes/gists": Object {
              "file": "routes/gists.js",
            },
            "routes/gists.css": Object {
              "file": "routes/gists.css",
            },
            "routes/gists.mine": Object {
              "file": "routes/gists.mine.js",
            },
            "routes/gists/$username": Object {
              "file": "routes/gists/$username.js",
            },
            "routes/gists/index": Object {
              "file": "routes/gists/index.js",
            },
            "routes/index": Object {
              "file": "routes/index.js",
            },
            "routes/page/four": Object {
              "file": "routes/page/four.js",
            },
            "routes/page/three": Object {
              "file": "routes/page/three.js",
            },
          },
          "version": Any<String>,
        }
      `
      );
    });
  });

  describe("the production browser build", () => {
    it("generates the correct bundles and manifest", async () => {
      let output = await generateBuild(config, {
        mode: BuildMode.Production,
        target: BuildTarget.Browser
      });

      expect(getFilenames(output)).toMatchInlineSnapshot(`
        Array [
          "_shared/Shared-2223a4e1.js",
          "_shared/_rollupPluginBabelHelpers-bfa6c712.js",
          "_shared/node_modules/@babel/runtime-f4ff0cc0.js",
          "_shared/node_modules/@mdx-js/react-fa2b156c.js",
          "_shared/node_modules/@remix-run/react-570c1c45.js",
          "_shared/node_modules/history-8b818913.js",
          "_shared/node_modules/object-assign-c47a16a6.js",
          "_shared/node_modules/prop-types-d4c4f9f2.js",
          "_shared/node_modules/react-dom-5925df33.js",
          "_shared/node_modules/react-e32d0f6a.js",
          "_shared/node_modules/react-is-f87125b7.js",
          "_shared/node_modules/react-router-dom-2942caf0.js",
          "_shared/node_modules/react-router-fa8780cf.js",
          "_shared/node_modules/scheduler-99859fcd.js",
          "asset-manifest.json",
          "entry-browser-de5a0e60.js",
          "global-ec887178.css",
          "pages/one-33b3e281.js",
          "pages/two-6e39a2d3.js",
          "routes/404-81cdf991.js",
          "routes/500-0c9b194f.js",
          "routes/gists-a6d2a823.css",
          "routes/gists-e9ff3bf8.js",
          "routes/gists.mine-f12f3533.js",
          "routes/gists/$username-0bd267b7.js",
          "routes/gists/index-a5e7dff4.js",
          "routes/index-990e13ed.js",
          "routes/page/four-7c11fa85.js",
          "routes/page/three-5de4b3e5.js",
        ]
      `);

      expect(getManifest(output, "asset-manifest.json")).toMatchInlineSnapshot(
        {
          version: expect.any(String)
        },
        `
        Object {
          "entries": Object {
            "entry-browser": Object {
              "file": "entry-browser-de5a0e60.js",
            },
            "global.css": Object {
              "file": "global-ec887178.css",
            },
            "pages/one": Object {
              "file": "pages/one-33b3e281.js",
            },
            "pages/two": Object {
              "file": "pages/two-6e39a2d3.js",
            },
            "routes/404": Object {
              "file": "routes/404-81cdf991.js",
            },
            "routes/500": Object {
              "file": "routes/500-0c9b194f.js",
            },
            "routes/gists": Object {
              "file": "routes/gists-e9ff3bf8.js",
            },
            "routes/gists.css": Object {
              "file": "routes/gists-a6d2a823.css",
            },
            "routes/gists.mine": Object {
              "file": "routes/gists.mine-f12f3533.js",
            },
            "routes/gists/$username": Object {
              "file": "routes/gists/$username-0bd267b7.js",
            },
            "routes/gists/index": Object {
              "file": "routes/gists/index-a5e7dff4.js",
            },
            "routes/index": Object {
              "file": "routes/index-990e13ed.js",
            },
            "routes/page/four": Object {
              "file": "routes/page/four-7c11fa85.js",
            },
            "routes/page/three": Object {
              "file": "routes/page/three-5de4b3e5.js",
            },
          },
          "version": Any<String>,
        }
      `
      );
    });
  });
});
