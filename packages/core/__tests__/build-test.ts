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
          "_shared/Shared-4f69c99e.js",
          "_shared/_rollupPluginBabelHelpers-8a275fd9.js",
          "entry-server-8861fcaf.js",
          "pages/one-84a0981a.js",
          "pages/two-c45d0835.js",
          "routes/404-660aace6.js",
          "routes/500-3568401c.js",
          "routes/gists-18c0bb36.js",
          "routes/gists.mine-9c786e2b.js",
          "routes/gists/$username-ebf86aaf.js",
          "routes/gists/index-c6bcfd56.js",
          "routes/index-d1c358fc.js",
          "routes/methods-7b965f7c.js",
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
              "file": "routes/gists-18c0bb36.js",
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
              "file": "routes/index-d1c358fc.js",
            },
            "routes/methods": Object {
              "file": "routes/methods-7b965f7c.js",
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
          "_shared/@babel/runtime-4ffe6868.js",
          "_shared/@mdx-js/react-f3c08f98.js",
          "_shared/@remix-run/react-471f5842.js",
          "_shared/Shared-737ae555.js",
          "_shared/_rollupPluginBabelHelpers-bfa6c712.js",
          "_shared/history-579b5dca.js",
          "_shared/object-assign-510802f4.js",
          "_shared/prop-types-b8d5f836.js",
          "_shared/react-16e984aa.js",
          "_shared/react-dom-170dd97b.js",
          "_shared/react-is-0f58df40.js",
          "_shared/react-router-dom-6c12787b.js",
          "_shared/react-router-eacaf940.js",
          "_shared/scheduler-71df0177.js",
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
          "_shared/@babel/runtime-4ffe6868.js",
          "_shared/@mdx-js/react-87a33684.js",
          "_shared/@remix-run/react-7f1f1c44.js",
          "_shared/Shared-528fb759.js",
          "_shared/_rollupPluginBabelHelpers-bfa6c712.js",
          "_shared/history-9011ea48.js",
          "_shared/object-assign-510802f4.js",
          "_shared/prop-types-1f3fb7f3.js",
          "_shared/react-749813df.js",
          "_shared/react-dom-b91f308e.js",
          "_shared/react-is-24198c9a.js",
          "_shared/react-router-44dcf4cc.js",
          "_shared/react-router-dom-c82b116a.js",
          "_shared/scheduler-34f5a05f.js",
          "asset-manifest.json",
          "entry-browser-7d37ad4c.js",
          "global-ec887178.css",
          "pages/one-dbdf3864.js",
          "pages/two-0edab43e.js",
          "routes/404-e1f9d6df.js",
          "routes/500-5b7951eb.js",
          "routes/gists-6db1f83b.css",
          "routes/gists-c8b9d7fa.js",
          "routes/gists.mine-3d220efc.js",
          "routes/gists/$username-03229302.js",
          "routes/gists/index-9fab3574.js",
          "routes/index-59e82e2c.js",
          "routes/methods-2ae92c5a.js",
          "routes/methods-e15212f5.css",
          "routes/page/four-7f717111.js",
          "routes/page/three-3e2483cf.js",
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
              "file": "entry-browser-7d37ad4c.js",
            },
            "global.css": Object {
              "file": "global-ec887178.css",
            },
            "pages/one": Object {
              "file": "pages/one-dbdf3864.js",
            },
            "pages/two": Object {
              "file": "pages/two-0edab43e.js",
            },
            "routes/404": Object {
              "file": "routes/404-e1f9d6df.js",
            },
            "routes/500": Object {
              "file": "routes/500-5b7951eb.js",
            },
            "routes/gists": Object {
              "file": "routes/gists-c8b9d7fa.js",
            },
            "routes/gists.css": Object {
              "file": "routes/gists-6db1f83b.css",
            },
            "routes/gists.mine": Object {
              "file": "routes/gists.mine-3d220efc.js",
            },
            "routes/gists/$username": Object {
              "file": "routes/gists/$username-03229302.js",
            },
            "routes/gists/index": Object {
              "file": "routes/gists/index-9fab3574.js",
            },
            "routes/index": Object {
              "file": "routes/index-59e82e2c.js",
            },
            "routes/methods": Object {
              "file": "routes/methods-2ae92c5a.js",
            },
            "routes/methods.css": Object {
              "file": "routes/methods-e15212f5.css",
            },
            "routes/page/four": Object {
              "file": "routes/page/four-7f717111.js",
            },
            "routes/page/three": Object {
              "file": "routes/page/three-3e2483cf.js",
            },
          },
          "version": Any<String>,
        }
      `
      );
    });
  });
});
