import path from "path";

import { Request } from "../platform";
import { matchAndLoadData } from "../match";
import type { RemixConfig } from "../config";
import { readConfig } from "../config";

describe("matchAndLoadData", () => {
  let root: string;
  let config: RemixConfig;

  beforeAll(async () => {
    root = path.resolve(__dirname, "../../../fixtures/gists-app");
    config = await readConfig(root);
  });

  it("loads data", async () => {
    let req = new Request("/gists");
    let appLoadContext = null;
    let result = await matchAndLoadData(config, req, appLoadContext);
    expect(result).toMatchInlineSnapshot(`
      Array [
        Object {
          "data": null,
          "id": "routes/gists",
          "status": "SUCCESS",
        },
        Object {
          "data": Array [
            Object {
              "files": Object {
                "remix-server.jsx": Object {
                  "filename": "remix-server.jsx",
                },
              },
              "id": "610613b54e5b34f8122d1ba4a3da21a9",
              "owner": Object {
                "avatar_url": "https://avatars0.githubusercontent.com/u/100200?v=4",
                "id": 100200,
                "login": "ryanflorence",
              },
              "url": "https://api.github.com/gists/610613b54e5b34f8122d1ba4a3da21a9",
            },
          ],
          "id": "routes/gists/index",
          "status": "SUCCESS",
        },
      ]
    `);
  });

  describe("when there is no matching route", () => {
    it("returns null", async () => {
      let req = new Request("/carnitas/street/tacos/are/the/best");
      let appLoadContext = null;
      let result = await matchAndLoadData(config, req, appLoadContext);
      expect(result).toBe(null);
    });
  });

  describe("when a nested loader throws", () => {
    it("handles errors", async () => {
      let req = new Request("/payments/error");
      let appLoadContext = null;
      let result = await matchAndLoadData(config, req, appLoadContext);
      expect(result).toMatchInlineSnapshot(`
        Array [
          Object {
            "data": null,
            "id": "routes/payments",
            "status": "SUCCESS",
          },
          Object {
            "error": "Boom",
            "id": "routes/payments/error",
            "status": "ERROR",
          },
        ]
      `);
    });
  });
});
