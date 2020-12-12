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

  describe("the development browser build", () => {
    it("generates the correct bundles and manifest", async () => {
      let output = await generateBuild(config, {
        mode: BuildMode.Development,
        target: BuildTarget.Browser
      });

      expect(getFilenames(output)).toMatchInlineSnapshot(`
        Array [
          "_shared/Shared-96366458.js",
          "_shared/__babel/runtime-88c72f87.js",
          "_shared/__mdx-js/react-95913140.js",
          "_shared/__remix-run/react-cde80f5e.js",
          "_shared/history-4d09a8ec.js",
          "_shared/object-assign-510802f4.js",
          "_shared/prop-types-dba85e17.js",
          "_shared/react-25ab190f.js",
          "_shared/react-dom-366265b2.js",
          "_shared/react-is-d37fbdde.js",
          "_shared/react-router-d1437d00.js",
          "_shared/react-router-dom-a453ee32.js",
          "_shared/scheduler-2e024e35.js",
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
          "_shared/Shared-901c4c50.js",
          "_shared/__babel/runtime-88c72f87.js",
          "_shared/__mdx-js/react-7d23cc18.js",
          "_shared/__remix-run/react-5a424f9a.js",
          "_shared/history-e6417d88.js",
          "_shared/object-assign-510802f4.js",
          "_shared/prop-types-dbe6eedb.js",
          "_shared/react-c26b1730.js",
          "_shared/react-dom-2b0040a5.js",
          "_shared/react-is-8eac45b9.js",
          "_shared/react-router-10d3b386.js",
          "_shared/react-router-dom-f0b00c95.js",
          "_shared/scheduler-240bd53d.js",
          "asset-manifest.json",
          "entry-browser-5aae29b7.js",
          "global-ec887178.css",
          "pages/one-6e4f5f3a.js",
          "pages/two-b6fe9a86.js",
          "routes/404-28c42fa3.js",
          "routes/500-53a4a2d5.js",
          "routes/gists-3ab00298.js",
          "routes/gists-6db1f83b.css",
          "routes/gists.mine-793a5f58.js",
          "routes/gists/$username-c4ddecda.js",
          "routes/gists/index-7ea1cb78.js",
          "routes/index-812a1332.js",
          "routes/methods-72ab071f.js",
          "routes/methods-e15212f5.css",
          "routes/page/four-f90c3608.js",
          "routes/page/three-97073d4a.js",
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
              "file": "entry-browser-5aae29b7.js",
            },
            "global.css": Object {
              "file": "global-ec887178.css",
            },
            "pages/one": Object {
              "file": "pages/one-6e4f5f3a.js",
            },
            "pages/two": Object {
              "file": "pages/two-b6fe9a86.js",
            },
            "routes/404": Object {
              "file": "routes/404-28c42fa3.js",
            },
            "routes/500": Object {
              "file": "routes/500-53a4a2d5.js",
            },
            "routes/gists": Object {
              "file": "routes/gists-3ab00298.js",
            },
            "routes/gists.css": Object {
              "file": "routes/gists-6db1f83b.css",
            },
            "routes/gists.mine": Object {
              "file": "routes/gists.mine-793a5f58.js",
            },
            "routes/gists/$username": Object {
              "file": "routes/gists/$username-c4ddecda.js",
            },
            "routes/gists/index": Object {
              "file": "routes/gists/index-7ea1cb78.js",
            },
            "routes/index": Object {
              "file": "routes/index-812a1332.js",
            },
            "routes/methods": Object {
              "file": "routes/methods-72ab071f.js",
            },
            "routes/methods.css": Object {
              "file": "routes/methods-e15212f5.css",
            },
            "routes/page/four": Object {
              "file": "routes/page/four-f90c3608.js",
            },
            "routes/page/three": Object {
              "file": "routes/page/three-97073d4a.js",
            },
          },
          "version": Any<String>,
        }
      `
      );
    });
  });
});
