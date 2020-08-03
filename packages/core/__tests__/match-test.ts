import { matchAndLoadData } from "../match";
import readRemixConfig from "../readRemixConfig";
import path from "path";

describe("matchAndLoadData", () => {
  let root;
  let config;

  beforeAll(async () => {
    root = path.resolve(__dirname, "../../../fixtures/gists-app");
    config = await readRemixConfig(root);
  });

  it("loads data", async () => {
    let url = "/gists";
    let appLoadContext = null;
    let result = await matchAndLoadData(config, url, appLoadContext);
    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": Array [
          Object {
            "data": null,
            "id": "routes/gists",
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
          },
        ],
        "status": "SUCCESS",
      }
    `);
  });

  it("returns NoMatch status", async () => {
    let url = "/carnitas/street/tacos/are/the/best";
    let appLoadContext = null;
    let result = await matchAndLoadData(config, url, appLoadContext);
    expect(result).toMatchInlineSnapshot(`
      Object {
        "status": "NO_MATCH",
      }
    `);
  });

  it.todo("handles errors");
  it.todo("can send 404 based on data availability not just route matching");
});
