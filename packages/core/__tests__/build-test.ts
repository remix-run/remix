import path from "path";
import type { OutputAsset, RollupOutput } from "rollup";

import { BuildMode, BuildTarget } from "../build";
import type { BuildOptions } from "../compiler";
import { build, generate } from "../compiler";
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

describe.skip("building", () => {
  // describe("building", () => {
  let config: RemixConfig;
  beforeAll(async () => {
    config = await readConfig(remixRoot);
  });

  beforeEach(() => {
    jest.setTimeout(20000);
  });

  describe("the development server build", () => {
    it("generates the correct bundles and manifest", async () => {
      let output = await generateBuild(config, {
        mode: BuildMode.Development,
        target: BuildTarget.Server
      });

      expect(getFilenames(output)).toMatchInlineSnapshot(`
        Array [
          "_shared/Shared-072c977d.js",
          "entry-server.js",
          "layout:root.js",
          "pages/one.js",
          "pages/two.js",
          "routes/404.js",
          "routes/gists.js",
          "routes/gists.mine.js",
          "routes/gists/$username.js",
          "routes/gists/index.js",
          "routes/index.js",
          "routes/loader-errors.js",
          "routes/loader-errors/nested.js",
          "routes/methods.js",
          "routes/page/four.js",
          "routes/page/three.js",
          "routes/render-errors.js",
          "routes/render-errors/nested.js",
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
            "layout:root": Object {
              "file": "layout:root.js",
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
            "routes/loader-errors": Object {
              "file": "routes/loader-errors.js",
            },
            "routes/loader-errors/nested": Object {
              "file": "routes/loader-errors/nested.js",
            },
            "routes/methods": Object {
              "file": "routes/methods.js",
            },
            "routes/page/four": Object {
              "file": "routes/page/four.js",
            },
            "routes/page/three": Object {
              "file": "routes/page/three.js",
            },
            "routes/render-errors": Object {
              "file": "routes/render-errors.js",
            },
            "routes/render-errors/nested": Object {
              "file": "routes/render-errors/nested.js",
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
          "_shared/Shared-072c977d.js",
          "entry-server.js",
          "layout:root.js",
          "pages/one.js",
          "pages/two.js",
          "routes/404.js",
          "routes/gists.js",
          "routes/gists.mine.js",
          "routes/gists/$username.js",
          "routes/gists/index.js",
          "routes/index.js",
          "routes/loader-errors.js",
          "routes/loader-errors/nested.js",
          "routes/methods.js",
          "routes/page/four.js",
          "routes/page/three.js",
          "routes/render-errors.js",
          "routes/render-errors/nested.js",
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
            "layout:root": Object {
              "file": "layout:root.js",
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
            "routes/loader-errors": Object {
              "file": "routes/loader-errors.js",
            },
            "routes/loader-errors/nested": Object {
              "file": "routes/loader-errors/nested.js",
            },
            "routes/methods": Object {
              "file": "routes/methods.js",
            },
            "routes/page/four": Object {
              "file": "routes/page/four.js",
            },
            "routes/page/three": Object {
              "file": "routes/page/three.js",
            },
            "routes/render-errors": Object {
              "file": "routes/render-errors.js",
            },
            "routes/render-errors/nested": Object {
              "file": "routes/render-errors/nested.js",
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
          "_shared/Shared-d9a35912.js",
          "_shared/__babel/runtime-88c72f87.js",
          "_shared/__mdx-js/react-4850335b.js",
          "_shared/__remix-run/react-d405e3fc.js",
          "_shared/history-7c196d23.js",
          "_shared/object-assign-510802f4.js",
          "_shared/prop-types-97465a95.js",
          "_shared/react-583fa859.js",
          "_shared/react-dom-07e69dc3.js",
          "_shared/react-is-61089b68.js",
          "_shared/react-router-8c7dde05.js",
          "_shared/react-router-dom-38d82f2d.js",
          "_shared/scheduler-a3345876.js",
          "asset-manifest.json",
          "entry-browser.js",
          "global.css",
          "layout:root.js",
          "pages/one.js",
          "pages/two.js",
          "routes/404.js",
          "routes/gists.css",
          "routes/gists.js",
          "routes/gists.mine.js",
          "routes/gists/$username.js",
          "routes/gists/index.js",
          "routes/index.js",
          "routes/loader-errors.js",
          "routes/loader-errors/nested.js",
          "routes/methods.css",
          "routes/methods.js",
          "routes/page/four.js",
          "routes/page/three.js",
          "routes/render-errors.js",
          "routes/render-errors/nested.js",
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
            "layout:root": Object {
              "file": "layout:root.js",
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
            "routes/loader-errors": Object {
              "file": "routes/loader-errors.js",
            },
            "routes/loader-errors/nested": Object {
              "file": "routes/loader-errors/nested.js",
            },
            "routes/methods": Object {
              "file": "routes/methods.js",
            },
            "routes/methods.css": Object {
              "file": "routes/methods.css",
            },
            "routes/page/four": Object {
              "file": "routes/page/four.js",
            },
            "routes/page/three": Object {
              "file": "routes/page/three.js",
            },
            "routes/render-errors": Object {
              "file": "routes/render-errors.js",
            },
            "routes/render-errors/nested": Object {
              "file": "routes/render-errors/nested.js",
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
          "_shared/Shared-035a27e3.js",
          "_shared/__babel/runtime-88c72f87.js",
          "_shared/__mdx-js/react-d4d6fcba.js",
          "_shared/__remix-run/react-7e4ead70.js",
          "_shared/history-e6417d88.js",
          "_shared/object-assign-510802f4.js",
          "_shared/prop-types-6a72a2b3.js",
          "_shared/react-b1327803.js",
          "_shared/react-dom-8c4c319e.js",
          "_shared/react-is-5210daad.js",
          "_shared/react-router-050e1eaa.js",
          "_shared/react-router-dom-1a8b67c3.js",
          "_shared/scheduler-f50f12dc.js",
          "asset-manifest.json",
          "entry-browser-51df2af1.js",
          "global-ec887178.css",
          "layout:root-d52df80a.js",
          "pages/one-7135adbb.js",
          "pages/two-133d6f23.js",
          "routes/404-e700f1a9.js",
          "routes/gists-6db1f83b.css",
          "routes/gists-76d43894.js",
          "routes/gists.mine-8daefef7.js",
          "routes/gists/$username-35fe93f1.js",
          "routes/gists/index-957176ca.js",
          "routes/index-340c73f4.js",
          "routes/loader-errors-bba41ff8.js",
          "routes/loader-errors/nested-41482585.js",
          "routes/methods-5f625924.js",
          "routes/methods-e15212f5.css",
          "routes/page/four-529b45e0.js",
          "routes/page/three-5f9a0655.js",
          "routes/render-errors-32c56232.js",
          "routes/render-errors/nested-e3b0a86b.js",
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
              "file": "entry-browser-51df2af1.js",
            },
            "global.css": Object {
              "file": "global-ec887178.css",
            },
            "layout:root": Object {
              "file": "layout:root-d52df80a.js",
            },
            "pages/one": Object {
              "file": "pages/one-7135adbb.js",
            },
            "pages/two": Object {
              "file": "pages/two-133d6f23.js",
            },
            "routes/404": Object {
              "file": "routes/404-e700f1a9.js",
            },
            "routes/gists": Object {
              "file": "routes/gists-76d43894.js",
            },
            "routes/gists.css": Object {
              "file": "routes/gists-6db1f83b.css",
            },
            "routes/gists.mine": Object {
              "file": "routes/gists.mine-8daefef7.js",
            },
            "routes/gists/$username": Object {
              "file": "routes/gists/$username-35fe93f1.js",
            },
            "routes/gists/index": Object {
              "file": "routes/gists/index-957176ca.js",
            },
            "routes/index": Object {
              "file": "routes/index-340c73f4.js",
            },
            "routes/loader-errors": Object {
              "file": "routes/loader-errors-bba41ff8.js",
            },
            "routes/loader-errors/nested": Object {
              "file": "routes/loader-errors/nested-41482585.js",
            },
            "routes/methods": Object {
              "file": "routes/methods-5f625924.js",
            },
            "routes/methods.css": Object {
              "file": "routes/methods-e15212f5.css",
            },
            "routes/page/four": Object {
              "file": "routes/page/four-529b45e0.js",
            },
            "routes/page/three": Object {
              "file": "routes/page/three-5f9a0655.js",
            },
            "routes/render-errors": Object {
              "file": "routes/render-errors-32c56232.js",
            },
            "routes/render-errors/nested": Object {
              "file": "routes/render-errors/nested-e3b0a86b.js",
            },
          },
          "version": Any<String>,
        }
      `
      );
    });
  });
});
