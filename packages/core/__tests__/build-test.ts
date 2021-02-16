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
          "entry.server.js",
          "pages/one.js",
          "pages/two.js",
          "root.js",
          "routes/404.js",
          "routes/gists.js",
          "routes/gists.mine.js",
          "routes/gists/$username.js",
          "routes/gists/index.js",
          "routes/index.js",
          "routes/links.js",
          "routes/loader-errors.js",
          "routes/loader-errors/nested.js",
          "routes/methods.js",
          "routes/page/four.js",
          "routes/page/three.js",
          "routes/prefs.js",
          "routes/render-errors.js",
          "routes/render-errors/nested.js",
          "server-manifest.json",
          "styles/methods.css",
          "styles/redText.css",
        ]
      `);

      expect(getManifest(output, "server-manifest.json")).toMatchInlineSnapshot(
        {
          version: expect.any(String)
        },
        `
        Object {
          "entries": Object {
            "entry.server": Object {
              "file": "entry.server.js",
              "imports": Array [
                "react/jsx-runtime",
                "react-dom/server",
                "@remix-run/react/server",
              ],
            },
            "pages/one": Object {
              "file": "pages/one.js",
              "imports": Array [
                "react/jsx-runtime",
                "react",
                "@mdx-js/react",
              ],
            },
            "pages/two": Object {
              "file": "pages/two.js",
              "imports": Array [
                "@mdx-js/react",
              ],
            },
            "root": Object {
              "file": "root.js",
              "imports": Array [
                "react/jsx-runtime",
                "react",
                "@remix-run/react",
                "react-router-dom",
              ],
            },
            "routes/404": Object {
              "file": "routes/404.js",
              "imports": Array [
                "react/jsx-runtime",
              ],
            },
            "routes/gists": Object {
              "file": "routes/gists.js",
              "imports": Array [
                "react/jsx-runtime",
                "@remix-run/react",
                "react-router-dom",
                "@remix-run/data",
                "_shared/Shared-072c977d.js",
              ],
            },
            "routes/gists.mine": Object {
              "file": "routes/gists.mine.js",
              "imports": Array [
                "react/jsx-runtime",
              ],
            },
            "routes/gists/$username": Object {
              "file": "routes/gists/$username.js",
              "imports": Array [
                "react/jsx-runtime",
                "@remix-run/react",
                "react-router-dom",
                "@remix-run/data",
              ],
            },
            "routes/gists/index": Object {
              "file": "routes/gists/index.js",
              "imports": Array [
                "react/jsx-runtime",
                "@remix-run/react",
              ],
            },
            "routes/index": Object {
              "file": "routes/index.js",
              "imports": Array [
                "react/jsx-runtime",
                "react",
                "@remix-run/react",
                "_shared/Shared-072c977d.js",
              ],
            },
            "routes/links": Object {
              "file": "routes/links.js",
              "imports": Array [
                "react/jsx-runtime",
                "@remix-run/react",
              ],
            },
            "routes/loader-errors": Object {
              "file": "routes/loader-errors.js",
              "imports": Array [
                "react/jsx-runtime",
                "react-router-dom",
              ],
            },
            "routes/loader-errors/nested": Object {
              "file": "routes/loader-errors/nested.js",
              "imports": Array [
                "react/jsx-runtime",
              ],
            },
            "routes/methods": Object {
              "file": "routes/methods.js",
              "imports": Array [
                "react/jsx-runtime",
                "react",
                "@remix-run/react",
                "@remix-run/data",
              ],
            },
            "routes/page/four": Object {
              "file": "routes/page/four.js",
              "imports": Array [
                "@mdx-js/react",
              ],
            },
            "routes/page/three": Object {
              "file": "routes/page/three.js",
              "imports": Array [
                "@mdx-js/react",
              ],
            },
            "routes/prefs": Object {
              "file": "routes/prefs.js",
              "imports": Array [
                "react/jsx-runtime",
                "@remix-run/react",
                "react-router-dom",
                "@remix-run/data",
              ],
            },
            "routes/render-errors": Object {
              "file": "routes/render-errors.js",
              "imports": Array [
                "react/jsx-runtime",
                "react-router-dom",
              ],
            },
            "routes/render-errors/nested": Object {
              "file": "routes/render-errors/nested.js",
              "imports": Array [
                "react/jsx-runtime",
              ],
            },
            "styles/methods.css": Object {
              "file": "styles/methods.css",
            },
            "styles/redText.css": Object {
              "file": "styles/redText.css",
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
          "entry.server.js",
          "pages/one.js",
          "pages/two.js",
          "root.js",
          "routes/404.js",
          "routes/gists.js",
          "routes/gists.mine.js",
          "routes/gists/$username.js",
          "routes/gists/index.js",
          "routes/index.js",
          "routes/links.js",
          "routes/loader-errors.js",
          "routes/loader-errors/nested.js",
          "routes/methods.js",
          "routes/page/four.js",
          "routes/page/three.js",
          "routes/prefs.js",
          "routes/render-errors.js",
          "routes/render-errors/nested.js",
          "server-manifest.json",
          "styles/methods.css",
          "styles/redText.css",
        ]
      `);

      expect(getManifest(output, "server-manifest.json")).toMatchInlineSnapshot(
        {
          version: expect.any(String)
        },
        `
        Object {
          "entries": Object {
            "entry.server": Object {
              "file": "entry.server.js",
              "imports": Array [
                "react/jsx-runtime",
                "react-dom/server",
                "@remix-run/react/server",
              ],
            },
            "pages/one": Object {
              "file": "pages/one.js",
              "imports": Array [
                "react/jsx-runtime",
                "react",
                "@mdx-js/react",
              ],
            },
            "pages/two": Object {
              "file": "pages/two.js",
              "imports": Array [
                "@mdx-js/react",
              ],
            },
            "root": Object {
              "file": "root.js",
              "imports": Array [
                "react/jsx-runtime",
                "react",
                "@remix-run/react",
                "react-router-dom",
              ],
            },
            "routes/404": Object {
              "file": "routes/404.js",
              "imports": Array [
                "react/jsx-runtime",
              ],
            },
            "routes/gists": Object {
              "file": "routes/gists.js",
              "imports": Array [
                "react/jsx-runtime",
                "@remix-run/react",
                "react-router-dom",
                "@remix-run/data",
                "_shared/Shared-072c977d.js",
              ],
            },
            "routes/gists.mine": Object {
              "file": "routes/gists.mine.js",
              "imports": Array [
                "react/jsx-runtime",
              ],
            },
            "routes/gists/$username": Object {
              "file": "routes/gists/$username.js",
              "imports": Array [
                "react/jsx-runtime",
                "@remix-run/react",
                "react-router-dom",
                "@remix-run/data",
              ],
            },
            "routes/gists/index": Object {
              "file": "routes/gists/index.js",
              "imports": Array [
                "react/jsx-runtime",
                "@remix-run/react",
              ],
            },
            "routes/index": Object {
              "file": "routes/index.js",
              "imports": Array [
                "react/jsx-runtime",
                "react",
                "@remix-run/react",
                "_shared/Shared-072c977d.js",
              ],
            },
            "routes/links": Object {
              "file": "routes/links.js",
              "imports": Array [
                "react/jsx-runtime",
                "@remix-run/react",
              ],
            },
            "routes/loader-errors": Object {
              "file": "routes/loader-errors.js",
              "imports": Array [
                "react/jsx-runtime",
                "react-router-dom",
              ],
            },
            "routes/loader-errors/nested": Object {
              "file": "routes/loader-errors/nested.js",
              "imports": Array [
                "react/jsx-runtime",
              ],
            },
            "routes/methods": Object {
              "file": "routes/methods.js",
              "imports": Array [
                "react/jsx-runtime",
                "react",
                "@remix-run/react",
                "@remix-run/data",
              ],
            },
            "routes/page/four": Object {
              "file": "routes/page/four.js",
              "imports": Array [
                "@mdx-js/react",
              ],
            },
            "routes/page/three": Object {
              "file": "routes/page/three.js",
              "imports": Array [
                "@mdx-js/react",
              ],
            },
            "routes/prefs": Object {
              "file": "routes/prefs.js",
              "imports": Array [
                "react/jsx-runtime",
                "@remix-run/react",
                "react-router-dom",
                "@remix-run/data",
              ],
            },
            "routes/render-errors": Object {
              "file": "routes/render-errors.js",
              "imports": Array [
                "react/jsx-runtime",
                "react-router-dom",
              ],
            },
            "routes/render-errors/nested": Object {
              "file": "routes/render-errors/nested.js",
              "imports": Array [
                "react/jsx-runtime",
              ],
            },
            "styles/methods.css": Object {
              "file": "styles/methods.css",
            },
            "styles/redText.css": Object {
              "file": "styles/redText.css",
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
          "_shared/__remix-run/react-ec984e27.js",
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
          "entry.client.js",
          "pages/one.js",
          "pages/two.js",
          "root.js",
          "routes/404.js",
          "routes/gists.js",
          "routes/gists.mine.js",
          "routes/gists/$username.js",
          "routes/gists/index.js",
          "routes/index.js",
          "routes/links.js",
          "routes/loader-errors.js",
          "routes/loader-errors/nested.js",
          "routes/methods.js",
          "routes/page/four.js",
          "routes/page/three.js",
          "routes/prefs.js",
          "routes/render-errors.js",
          "routes/render-errors/nested.js",
          "styles/methods.css",
          "styles/redText.css",
        ]
      `);

      expect(getManifest(output, "asset-manifest.json")).toMatchInlineSnapshot(
        {
          version: expect.any(String)
        },
        `
        Object {
          "entries": Object {
            "entry.client": Object {
              "file": "entry.client.js",
              "imports": Array [
                "_shared/react-583fa859.js",
                "_shared/object-assign-510802f4.js",
                "_shared/scheduler-a3345876.js",
                "_shared/react-dom-07e69dc3.js",
                "_shared/__babel/runtime-88c72f87.js",
                "_shared/history-7c196d23.js",
                "_shared/__remix-run/react-ec984e27.js",
                "_shared/react-is-61089b68.js",
                "_shared/prop-types-97465a95.js",
                "_shared/react-router-8c7dde05.js",
              ],
            },
            "pages/one": Object {
              "file": "pages/one.js",
              "imports": Array [
                "_shared/react-583fa859.js",
                "_shared/object-assign-510802f4.js",
                "_shared/__mdx-js/react-4850335b.js",
              ],
            },
            "pages/two": Object {
              "file": "pages/two.js",
              "imports": Array [
                "_shared/react-583fa859.js",
                "_shared/object-assign-510802f4.js",
                "_shared/__mdx-js/react-4850335b.js",
              ],
            },
            "root": Object {
              "file": "root.js",
              "imports": Array [
                "_shared/react-583fa859.js",
                "_shared/object-assign-510802f4.js",
                "_shared/__babel/runtime-88c72f87.js",
                "_shared/history-7c196d23.js",
                "_shared/__remix-run/react-ec984e27.js",
                "_shared/react-is-61089b68.js",
                "_shared/prop-types-97465a95.js",
                "_shared/react-router-8c7dde05.js",
                "_shared/react-router-dom-38d82f2d.js",
              ],
            },
            "routes/404": Object {
              "file": "routes/404.js",
              "imports": Array [
                "_shared/react-583fa859.js",
                "_shared/object-assign-510802f4.js",
              ],
            },
            "routes/gists": Object {
              "file": "routes/gists.js",
              "imports": Array [
                "_shared/react-583fa859.js",
                "_shared/object-assign-510802f4.js",
                "_shared/__babel/runtime-88c72f87.js",
                "_shared/history-7c196d23.js",
                "_shared/__remix-run/react-ec984e27.js",
                "_shared/react-is-61089b68.js",
                "_shared/prop-types-97465a95.js",
                "_shared/react-router-8c7dde05.js",
                "_shared/react-router-dom-38d82f2d.js",
                "_shared/Shared-d9a35912.js",
              ],
            },
            "routes/gists.mine": Object {
              "file": "routes/gists.mine.js",
              "imports": Array [
                "_shared/react-583fa859.js",
                "_shared/object-assign-510802f4.js",
              ],
            },
            "routes/gists/$username": Object {
              "file": "routes/gists/$username.js",
              "imports": Array [
                "_shared/react-583fa859.js",
                "_shared/object-assign-510802f4.js",
                "_shared/__babel/runtime-88c72f87.js",
                "_shared/history-7c196d23.js",
                "_shared/__remix-run/react-ec984e27.js",
                "_shared/react-is-61089b68.js",
                "_shared/prop-types-97465a95.js",
                "_shared/react-router-8c7dde05.js",
                "_shared/react-router-dom-38d82f2d.js",
              ],
            },
            "routes/gists/index": Object {
              "file": "routes/gists/index.js",
              "imports": Array [
                "_shared/react-583fa859.js",
                "_shared/object-assign-510802f4.js",
                "_shared/__babel/runtime-88c72f87.js",
                "_shared/history-7c196d23.js",
                "_shared/__remix-run/react-ec984e27.js",
                "_shared/react-is-61089b68.js",
                "_shared/prop-types-97465a95.js",
                "_shared/react-router-8c7dde05.js",
              ],
            },
            "routes/index": Object {
              "file": "routes/index.js",
              "imports": Array [
                "_shared/react-583fa859.js",
                "_shared/object-assign-510802f4.js",
                "_shared/__babel/runtime-88c72f87.js",
                "_shared/history-7c196d23.js",
                "_shared/react-is-61089b68.js",
                "_shared/prop-types-97465a95.js",
                "_shared/react-router-8c7dde05.js",
                "_shared/react-router-dom-38d82f2d.js",
                "_shared/Shared-d9a35912.js",
              ],
            },
            "routes/links": Object {
              "file": "routes/links.js",
              "imports": Array [
                "_shared/react-583fa859.js",
                "_shared/object-assign-510802f4.js",
                "_shared/__babel/runtime-88c72f87.js",
                "_shared/history-7c196d23.js",
                "_shared/__remix-run/react-ec984e27.js",
                "_shared/react-is-61089b68.js",
                "_shared/prop-types-97465a95.js",
                "_shared/react-router-8c7dde05.js",
                "_shared/react-router-dom-38d82f2d.js",
              ],
            },
            "routes/loader-errors": Object {
              "file": "routes/loader-errors.js",
              "imports": Array [
                "_shared/react-583fa859.js",
                "_shared/object-assign-510802f4.js",
                "_shared/__babel/runtime-88c72f87.js",
                "_shared/history-7c196d23.js",
                "_shared/react-is-61089b68.js",
                "_shared/prop-types-97465a95.js",
                "_shared/react-router-8c7dde05.js",
              ],
            },
            "routes/loader-errors/nested": Object {
              "file": "routes/loader-errors/nested.js",
              "imports": Array [
                "_shared/react-583fa859.js",
                "_shared/object-assign-510802f4.js",
              ],
            },
            "routes/methods": Object {
              "file": "routes/methods.js",
              "imports": Array [
                "_shared/react-583fa859.js",
                "_shared/object-assign-510802f4.js",
                "_shared/__babel/runtime-88c72f87.js",
                "_shared/history-7c196d23.js",
                "_shared/__remix-run/react-ec984e27.js",
                "_shared/react-is-61089b68.js",
                "_shared/prop-types-97465a95.js",
                "_shared/react-router-8c7dde05.js",
              ],
            },
            "routes/page/four": Object {
              "file": "routes/page/four.js",
              "imports": Array [
                "_shared/react-583fa859.js",
                "_shared/object-assign-510802f4.js",
                "_shared/__mdx-js/react-4850335b.js",
              ],
            },
            "routes/page/three": Object {
              "file": "routes/page/three.js",
              "imports": Array [
                "_shared/react-583fa859.js",
                "_shared/object-assign-510802f4.js",
                "_shared/__mdx-js/react-4850335b.js",
              ],
            },
            "routes/prefs": Object {
              "file": "routes/prefs.js",
              "imports": Array [
                "_shared/react-583fa859.js",
                "_shared/object-assign-510802f4.js",
                "_shared/__babel/runtime-88c72f87.js",
                "_shared/history-7c196d23.js",
                "_shared/__remix-run/react-ec984e27.js",
                "_shared/react-is-61089b68.js",
                "_shared/prop-types-97465a95.js",
                "_shared/react-router-8c7dde05.js",
                "_shared/react-router-dom-38d82f2d.js",
              ],
            },
            "routes/render-errors": Object {
              "file": "routes/render-errors.js",
              "imports": Array [
                "_shared/react-583fa859.js",
                "_shared/object-assign-510802f4.js",
                "_shared/__babel/runtime-88c72f87.js",
                "_shared/history-7c196d23.js",
                "_shared/react-is-61089b68.js",
                "_shared/prop-types-97465a95.js",
                "_shared/react-router-8c7dde05.js",
              ],
            },
            "routes/render-errors/nested": Object {
              "file": "routes/render-errors/nested.js",
              "imports": Array [
                "_shared/react-583fa859.js",
                "_shared/object-assign-510802f4.js",
              ],
            },
            "styles/methods.css": Object {
              "file": "styles/methods.css",
            },
            "styles/redText.css": Object {
              "file": "styles/redText.css",
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
          "_shared/__remix-run/react-2149dd78.js",
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
          "entry.client-d9290a5c.js",
          "pages/one-a5cda75b.js",
          "pages/two-59f43e4b.js",
          "root-3a6f2c16.js",
          "routes/404-2d58ffe6.js",
          "routes/gists-8c182da2.js",
          "routes/gists.mine-7f496bc0.js",
          "routes/gists/$username-f2295d96.js",
          "routes/gists/index-f45d25a5.js",
          "routes/index-28a55b13.js",
          "routes/links-cb29a12e.js",
          "routes/loader-errors-0cf20bb7.js",
          "routes/loader-errors/nested-5fec12d3.js",
          "routes/methods-d689bab4.js",
          "routes/page/four-b70b700e.js",
          "routes/page/three-19a1b743.js",
          "routes/prefs-812bf987.js",
          "routes/render-errors-d80e1e9b.js",
          "routes/render-errors/nested-b93fd3ee.js",
          "styles/methods-4b89abbd.css",
          "styles/redText-1bade075.css",
        ]
      `);

      expect(getManifest(output, "asset-manifest.json")).toMatchInlineSnapshot(
        {
          version: expect.any(String)
        },
        `
        Object {
          "entries": Object {
            "entry.client": Object {
              "file": "entry.client-d9290a5c.js",
              "imports": Array [
                "_shared/react-b1327803.js",
                "_shared/object-assign-510802f4.js",
                "_shared/scheduler-f50f12dc.js",
                "_shared/react-dom-8c4c319e.js",
                "_shared/__babel/runtime-88c72f87.js",
                "_shared/history-e6417d88.js",
                "_shared/__remix-run/react-2149dd78.js",
                "_shared/react-router-050e1eaa.js",
              ],
            },
            "pages/one": Object {
              "file": "pages/one-a5cda75b.js",
              "imports": Array [
                "_shared/react-b1327803.js",
                "_shared/object-assign-510802f4.js",
                "_shared/__mdx-js/react-d4d6fcba.js",
              ],
            },
            "pages/two": Object {
              "file": "pages/two-59f43e4b.js",
              "imports": Array [
                "_shared/react-b1327803.js",
                "_shared/object-assign-510802f4.js",
                "_shared/__mdx-js/react-d4d6fcba.js",
              ],
            },
            "root": Object {
              "file": "root-3a6f2c16.js",
              "imports": Array [
                "_shared/react-b1327803.js",
                "_shared/object-assign-510802f4.js",
                "_shared/__babel/runtime-88c72f87.js",
                "_shared/history-e6417d88.js",
                "_shared/__remix-run/react-2149dd78.js",
                "_shared/react-router-050e1eaa.js",
                "_shared/react-router-dom-1a8b67c3.js",
              ],
            },
            "routes/404": Object {
              "file": "routes/404-2d58ffe6.js",
              "imports": Array [
                "_shared/react-b1327803.js",
                "_shared/object-assign-510802f4.js",
              ],
            },
            "routes/gists": Object {
              "file": "routes/gists-8c182da2.js",
              "imports": Array [
                "_shared/react-b1327803.js",
                "_shared/object-assign-510802f4.js",
                "_shared/__babel/runtime-88c72f87.js",
                "_shared/history-e6417d88.js",
                "_shared/__remix-run/react-2149dd78.js",
                "_shared/react-router-050e1eaa.js",
                "_shared/react-router-dom-1a8b67c3.js",
                "_shared/Shared-035a27e3.js",
              ],
            },
            "routes/gists.mine": Object {
              "file": "routes/gists.mine-7f496bc0.js",
              "imports": Array [
                "_shared/react-b1327803.js",
                "_shared/object-assign-510802f4.js",
              ],
            },
            "routes/gists/$username": Object {
              "file": "routes/gists/$username-f2295d96.js",
              "imports": Array [
                "_shared/react-b1327803.js",
                "_shared/object-assign-510802f4.js",
                "_shared/__babel/runtime-88c72f87.js",
                "_shared/history-e6417d88.js",
                "_shared/__remix-run/react-2149dd78.js",
                "_shared/react-router-050e1eaa.js",
                "_shared/react-router-dom-1a8b67c3.js",
              ],
            },
            "routes/gists/index": Object {
              "file": "routes/gists/index-f45d25a5.js",
              "imports": Array [
                "_shared/react-b1327803.js",
                "_shared/object-assign-510802f4.js",
                "_shared/__babel/runtime-88c72f87.js",
                "_shared/history-e6417d88.js",
                "_shared/__remix-run/react-2149dd78.js",
                "_shared/react-router-050e1eaa.js",
              ],
            },
            "routes/index": Object {
              "file": "routes/index-28a55b13.js",
              "imports": Array [
                "_shared/react-b1327803.js",
                "_shared/object-assign-510802f4.js",
                "_shared/__babel/runtime-88c72f87.js",
                "_shared/history-e6417d88.js",
                "_shared/react-router-050e1eaa.js",
                "_shared/react-router-dom-1a8b67c3.js",
                "_shared/Shared-035a27e3.js",
              ],
            },
            "routes/links": Object {
              "file": "routes/links-cb29a12e.js",
              "imports": Array [
                "_shared/react-b1327803.js",
                "_shared/object-assign-510802f4.js",
                "_shared/__babel/runtime-88c72f87.js",
                "_shared/history-e6417d88.js",
                "_shared/__remix-run/react-2149dd78.js",
                "_shared/react-router-050e1eaa.js",
                "_shared/react-router-dom-1a8b67c3.js",
              ],
            },
            "routes/loader-errors": Object {
              "file": "routes/loader-errors-0cf20bb7.js",
              "imports": Array [
                "_shared/react-b1327803.js",
                "_shared/object-assign-510802f4.js",
                "_shared/__babel/runtime-88c72f87.js",
                "_shared/history-e6417d88.js",
                "_shared/react-router-050e1eaa.js",
              ],
            },
            "routes/loader-errors/nested": Object {
              "file": "routes/loader-errors/nested-5fec12d3.js",
              "imports": Array [
                "_shared/react-b1327803.js",
                "_shared/object-assign-510802f4.js",
              ],
            },
            "routes/methods": Object {
              "file": "routes/methods-d689bab4.js",
              "imports": Array [
                "_shared/react-b1327803.js",
                "_shared/object-assign-510802f4.js",
                "_shared/__babel/runtime-88c72f87.js",
                "_shared/history-e6417d88.js",
                "_shared/__remix-run/react-2149dd78.js",
                "_shared/react-router-050e1eaa.js",
              ],
            },
            "routes/page/four": Object {
              "file": "routes/page/four-b70b700e.js",
              "imports": Array [
                "_shared/react-b1327803.js",
                "_shared/object-assign-510802f4.js",
                "_shared/__mdx-js/react-d4d6fcba.js",
              ],
            },
            "routes/page/three": Object {
              "file": "routes/page/three-19a1b743.js",
              "imports": Array [
                "_shared/react-b1327803.js",
                "_shared/object-assign-510802f4.js",
                "_shared/__mdx-js/react-d4d6fcba.js",
              ],
            },
            "routes/prefs": Object {
              "file": "routes/prefs-812bf987.js",
              "imports": Array [
                "_shared/react-b1327803.js",
                "_shared/object-assign-510802f4.js",
                "_shared/__babel/runtime-88c72f87.js",
                "_shared/history-e6417d88.js",
                "_shared/__remix-run/react-2149dd78.js",
                "_shared/react-router-050e1eaa.js",
                "_shared/react-router-dom-1a8b67c3.js",
              ],
            },
            "routes/render-errors": Object {
              "file": "routes/render-errors-d80e1e9b.js",
              "imports": Array [
                "_shared/react-b1327803.js",
                "_shared/object-assign-510802f4.js",
                "_shared/__babel/runtime-88c72f87.js",
                "_shared/history-e6417d88.js",
                "_shared/react-router-050e1eaa.js",
              ],
            },
            "routes/render-errors/nested": Object {
              "file": "routes/render-errors/nested-b93fd3ee.js",
              "imports": Array [
                "_shared/react-b1327803.js",
                "_shared/object-assign-510802f4.js",
              ],
            },
            "styles/methods.css": Object {
              "file": "styles/methods-4b89abbd.css",
            },
            "styles/redText.css": Object {
              "file": "styles/redText-1bade075.css",
            },
          },
          "version": Any<String>,
        }
      `
      );
    });
  });
});
