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
          "_shared/Shared-b97a0af4.js",
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
          "routes/methods.js",
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
            "routes/methods": Object {
              "file": "routes/methods.js",
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
          "_shared/Shared-b97a0af4.js",
          "entry-server-4bebe6c1.js",
          "pages/one-53b19748.js",
          "pages/two-2f475173.js",
          "routes/404-d16cca2b.js",
          "routes/500-e47be9b7.js",
          "routes/gists-3129f28e.js",
          "routes/gists.mine-f34b0db7.js",
          "routes/gists/$username-79d26e83.js",
          "routes/gists/index-fec260b4.js",
          "routes/index-50d745c3.js",
          "routes/methods-a4281924.js",
          "routes/page/four-11933b23.js",
          "routes/page/three-fd4284d2.js",
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
              "file": "entry-server-4bebe6c1.js",
            },
            "pages/one": Object {
              "file": "pages/one-53b19748.js",
            },
            "pages/two": Object {
              "file": "pages/two-2f475173.js",
            },
            "routes/404": Object {
              "file": "routes/404-d16cca2b.js",
            },
            "routes/500": Object {
              "file": "routes/500-e47be9b7.js",
            },
            "routes/gists": Object {
              "file": "routes/gists-3129f28e.js",
            },
            "routes/gists.mine": Object {
              "file": "routes/gists.mine-f34b0db7.js",
            },
            "routes/gists/$username": Object {
              "file": "routes/gists/$username-79d26e83.js",
            },
            "routes/gists/index": Object {
              "file": "routes/gists/index-fec260b4.js",
            },
            "routes/index": Object {
              "file": "routes/index-50d745c3.js",
            },
            "routes/methods": Object {
              "file": "routes/methods-a4281924.js",
            },
            "routes/page/four": Object {
              "file": "routes/page/four-11933b23.js",
            },
            "routes/page/three": Object {
              "file": "routes/page/three-fd4284d2.js",
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
          "_shared/Shared-f413059e.js",
          "_shared/node_modules/@babel/runtime-f4ff0cc0.js",
          "_shared/node_modules/@mdx-js/react-273b70e4.js",
          "_shared/node_modules/@remix-run/react-20d518de.js",
          "_shared/node_modules/history-45437576.js",
          "_shared/node_modules/object-assign-c47a16a6.js",
          "_shared/node_modules/prop-types-10e9577e.js",
          "_shared/node_modules/react-5eb30eef.js",
          "_shared/node_modules/react-dom-a40050cb.js",
          "_shared/node_modules/react-is-16d950a1.js",
          "_shared/node_modules/react-router-953744b1.js",
          "_shared/node_modules/react-router-dom-774c78bd.js",
          "_shared/node_modules/scheduler-0ec08ff9.js",
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
          "routes/methods.css",
          "routes/methods.js",
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
          "_shared/Shared-d3b72835.js",
          "_shared/node_modules/@babel/runtime-f4ff0cc0.js",
          "_shared/node_modules/@mdx-js/react-a6870c6c.js",
          "_shared/node_modules/@remix-run/react-872ba3a3.js",
          "_shared/node_modules/history-8b818913.js",
          "_shared/node_modules/object-assign-c47a16a6.js",
          "_shared/node_modules/prop-types-d62d43a5.js",
          "_shared/node_modules/react-2ea82506.js",
          "_shared/node_modules/react-dom-f1b98511.js",
          "_shared/node_modules/react-is-08ef681b.js",
          "_shared/node_modules/react-router-21790491.js",
          "_shared/node_modules/react-router-dom-3dd78536.js",
          "_shared/node_modules/scheduler-db377390.js",
          "asset-manifest.json",
          "entry-browser-79f83a1b.js",
          "global-ec887178.css",
          "pages/one-5e26c998.js",
          "pages/two-ecffc1f5.js",
          "routes/404-05f74ff9.js",
          "routes/500-83189ced.js",
          "routes/gists-6db1f83b.css",
          "routes/gists-d4dac369.js",
          "routes/gists.mine-65276ff1.js",
          "routes/gists/$username-5d38ef92.js",
          "routes/gists/index-6be545ac.js",
          "routes/index-23df3a5b.js",
          "routes/methods-b79e3f8c.js",
          "routes/methods-e15212f5.css",
          "routes/page/four-e83669e5.js",
          "routes/page/three-e439ecde.js",
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
              "file": "entry-browser-79f83a1b.js",
            },
            "global.css": Object {
              "file": "global-ec887178.css",
            },
            "pages/one": Object {
              "file": "pages/one-5e26c998.js",
            },
            "pages/two": Object {
              "file": "pages/two-ecffc1f5.js",
            },
            "routes/404": Object {
              "file": "routes/404-05f74ff9.js",
            },
            "routes/500": Object {
              "file": "routes/500-83189ced.js",
            },
            "routes/gists": Object {
              "file": "routes/gists-d4dac369.js",
            },
            "routes/gists.css": Object {
              "file": "routes/gists-6db1f83b.css",
            },
            "routes/gists.mine": Object {
              "file": "routes/gists.mine-65276ff1.js",
            },
            "routes/gists/$username": Object {
              "file": "routes/gists/$username-5d38ef92.js",
            },
            "routes/gists/index": Object {
              "file": "routes/gists/index-6be545ac.js",
            },
            "routes/index": Object {
              "file": "routes/index-23df3a5b.js",
            },
            "routes/methods": Object {
              "file": "routes/methods-b79e3f8c.js",
            },
            "routes/methods.css": Object {
              "file": "routes/methods-e15212f5.css",
            },
            "routes/page/four": Object {
              "file": "routes/page/four-e83669e5.js",
            },
            "routes/page/three": Object {
              "file": "routes/page/three-e439ecde.js",
            },
          },
          "version": Any<String>,
        }
      `
      );
    });
  });
});
