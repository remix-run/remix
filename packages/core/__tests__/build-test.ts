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
          "routes/render-errors.js",
          "routes/render-errors/nested.js",
          "server-manifest.json",
          "styles/app.css",
          "styles/gists.css",
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
            "entry-server": Object {
              "file": "entry-server.js",
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
            "styles/app.css": Object {
              "file": "styles/app.css",
            },
            "styles/gists.css": Object {
              "file": "styles/gists.css",
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
          "entry-server.js",
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
          "routes/render-errors.js",
          "routes/render-errors/nested.js",
          "server-manifest.json",
          "styles/app.css",
          "styles/gists.css",
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
            "entry-server": Object {
              "file": "entry-server.js",
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
            "styles/app.css": Object {
              "file": "styles/app.css",
            },
            "styles/gists.css": Object {
              "file": "styles/gists.css",
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
          "_shared/__remix-run/react-aec6a826.js",
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
          "routes/render-errors.js",
          "routes/render-errors/nested.js",
          "styles/app.css",
          "styles/gists.css",
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
            "entry-browser": Object {
              "file": "entry-browser.js",
              "imports": Array [
                "_shared/react-583fa859.js",
                "_shared/object-assign-510802f4.js",
                "_shared/scheduler-a3345876.js",
                "_shared/react-dom-07e69dc3.js",
                "_shared/__babel/runtime-88c72f87.js",
                "_shared/history-7c196d23.js",
                "_shared/__remix-run/react-aec6a826.js",
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
                "_shared/__remix-run/react-aec6a826.js",
                "_shared/react-is-61089b68.js",
                "_shared/prop-types-97465a95.js",
                "_shared/react-router-8c7dde05.js",
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
                "_shared/__remix-run/react-aec6a826.js",
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
                "_shared/__remix-run/react-aec6a826.js",
                "_shared/react-is-61089b68.js",
                "_shared/prop-types-97465a95.js",
                "_shared/react-router-8c7dde05.js",
              ],
            },
            "routes/gists/index": Object {
              "file": "routes/gists/index.js",
              "imports": Array [
                "_shared/react-583fa859.js",
                "_shared/object-assign-510802f4.js",
                "_shared/__babel/runtime-88c72f87.js",
                "_shared/history-7c196d23.js",
                "_shared/__remix-run/react-aec6a826.js",
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
                "_shared/__remix-run/react-aec6a826.js",
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
                "_shared/__remix-run/react-aec6a826.js",
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
            "styles/app.css": Object {
              "file": "styles/app.css",
            },
            "styles/gists.css": Object {
              "file": "styles/gists.css",
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
          "_shared/__remix-run/react-87d9556c.js",
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
          "entry-browser-2e3910d6.js",
          "pages/one-0fd8bd3b.js",
          "pages/two-6106cbf5.js",
          "root-10f380cc.js",
          "routes/404-4d24480a.js",
          "routes/gists-8373ba50.js",
          "routes/gists.mine-b346be55.js",
          "routes/gists/$username-e6b5ce1f.js",
          "routes/gists/index-0d7f7de4.js",
          "routes/index-e4d24854.js",
          "routes/links-f7e1ba11.js",
          "routes/loader-errors-6a4be853.js",
          "routes/loader-errors/nested-139ef80b.js",
          "routes/methods-a4d8fd13.js",
          "routes/page/four-6f3ea2c5.js",
          "routes/page/three-6a9d7bf4.js",
          "routes/render-errors-44a36bf5.js",
          "routes/render-errors/nested-6a140eed.js",
          "styles/app-2250dc4b.css",
          "styles/gists-7bb6bc1f.css",
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
            "entry-browser": Object {
              "file": "entry-browser-2e3910d6.js",
              "imports": Array [
                "_shared/react-b1327803.js",
                "_shared/object-assign-510802f4.js",
                "_shared/scheduler-f50f12dc.js",
                "_shared/react-dom-8c4c319e.js",
                "_shared/__babel/runtime-88c72f87.js",
                "_shared/history-e6417d88.js",
                "_shared/__remix-run/react-87d9556c.js",
                "_shared/react-router-050e1eaa.js",
              ],
            },
            "pages/one": Object {
              "file": "pages/one-0fd8bd3b.js",
              "imports": Array [
                "_shared/react-b1327803.js",
                "_shared/object-assign-510802f4.js",
                "_shared/__mdx-js/react-d4d6fcba.js",
              ],
            },
            "pages/two": Object {
              "file": "pages/two-6106cbf5.js",
              "imports": Array [
                "_shared/react-b1327803.js",
                "_shared/object-assign-510802f4.js",
                "_shared/__mdx-js/react-d4d6fcba.js",
              ],
            },
            "root": Object {
              "file": "root-10f380cc.js",
              "imports": Array [
                "_shared/react-b1327803.js",
                "_shared/object-assign-510802f4.js",
                "_shared/__babel/runtime-88c72f87.js",
                "_shared/history-e6417d88.js",
                "_shared/__remix-run/react-87d9556c.js",
                "_shared/react-router-050e1eaa.js",
              ],
            },
            "routes/404": Object {
              "file": "routes/404-4d24480a.js",
              "imports": Array [
                "_shared/react-b1327803.js",
                "_shared/object-assign-510802f4.js",
              ],
            },
            "routes/gists": Object {
              "file": "routes/gists-8373ba50.js",
              "imports": Array [
                "_shared/react-b1327803.js",
                "_shared/object-assign-510802f4.js",
                "_shared/__babel/runtime-88c72f87.js",
                "_shared/history-e6417d88.js",
                "_shared/__remix-run/react-87d9556c.js",
                "_shared/react-router-050e1eaa.js",
                "_shared/react-router-dom-1a8b67c3.js",
                "_shared/Shared-035a27e3.js",
              ],
            },
            "routes/gists.mine": Object {
              "file": "routes/gists.mine-b346be55.js",
              "imports": Array [
                "_shared/react-b1327803.js",
                "_shared/object-assign-510802f4.js",
              ],
            },
            "routes/gists/$username": Object {
              "file": "routes/gists/$username-e6b5ce1f.js",
              "imports": Array [
                "_shared/react-b1327803.js",
                "_shared/object-assign-510802f4.js",
                "_shared/__babel/runtime-88c72f87.js",
                "_shared/history-e6417d88.js",
                "_shared/__remix-run/react-87d9556c.js",
                "_shared/react-router-050e1eaa.js",
              ],
            },
            "routes/gists/index": Object {
              "file": "routes/gists/index-0d7f7de4.js",
              "imports": Array [
                "_shared/react-b1327803.js",
                "_shared/object-assign-510802f4.js",
                "_shared/__babel/runtime-88c72f87.js",
                "_shared/history-e6417d88.js",
                "_shared/__remix-run/react-87d9556c.js",
                "_shared/react-router-050e1eaa.js",
              ],
            },
            "routes/index": Object {
              "file": "routes/index-e4d24854.js",
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
              "file": "routes/links-f7e1ba11.js",
              "imports": Array [
                "_shared/react-b1327803.js",
                "_shared/object-assign-510802f4.js",
                "_shared/__babel/runtime-88c72f87.js",
                "_shared/history-e6417d88.js",
                "_shared/__remix-run/react-87d9556c.js",
                "_shared/react-router-050e1eaa.js",
                "_shared/react-router-dom-1a8b67c3.js",
              ],
            },
            "routes/loader-errors": Object {
              "file": "routes/loader-errors-6a4be853.js",
              "imports": Array [
                "_shared/react-b1327803.js",
                "_shared/object-assign-510802f4.js",
                "_shared/__babel/runtime-88c72f87.js",
                "_shared/history-e6417d88.js",
                "_shared/react-router-050e1eaa.js",
              ],
            },
            "routes/loader-errors/nested": Object {
              "file": "routes/loader-errors/nested-139ef80b.js",
              "imports": Array [
                "_shared/react-b1327803.js",
                "_shared/object-assign-510802f4.js",
              ],
            },
            "routes/methods": Object {
              "file": "routes/methods-a4d8fd13.js",
              "imports": Array [
                "_shared/react-b1327803.js",
                "_shared/object-assign-510802f4.js",
                "_shared/__babel/runtime-88c72f87.js",
                "_shared/history-e6417d88.js",
                "_shared/__remix-run/react-87d9556c.js",
                "_shared/react-router-050e1eaa.js",
              ],
            },
            "routes/page/four": Object {
              "file": "routes/page/four-6f3ea2c5.js",
              "imports": Array [
                "_shared/react-b1327803.js",
                "_shared/object-assign-510802f4.js",
                "_shared/__mdx-js/react-d4d6fcba.js",
              ],
            },
            "routes/page/three": Object {
              "file": "routes/page/three-6a9d7bf4.js",
              "imports": Array [
                "_shared/react-b1327803.js",
                "_shared/object-assign-510802f4.js",
                "_shared/__mdx-js/react-d4d6fcba.js",
              ],
            },
            "routes/render-errors": Object {
              "file": "routes/render-errors-44a36bf5.js",
              "imports": Array [
                "_shared/react-b1327803.js",
                "_shared/object-assign-510802f4.js",
                "_shared/__babel/runtime-88c72f87.js",
                "_shared/history-e6417d88.js",
                "_shared/react-router-050e1eaa.js",
              ],
            },
            "routes/render-errors/nested": Object {
              "file": "routes/render-errors/nested-6a140eed.js",
              "imports": Array [
                "_shared/react-b1327803.js",
                "_shared/object-assign-510802f4.js",
              ],
            },
            "styles/app.css": Object {
              "file": "styles/app-2250dc4b.css",
            },
            "styles/gists.css": Object {
              "file": "styles/gists-7bb6bc1f.css",
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
