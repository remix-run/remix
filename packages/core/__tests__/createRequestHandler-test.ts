import path from "path";
import { Request, createRequestHandler } from "../platform";

describe("a remix request handler", () => {
  it("works", async () => {
    let handleRequest = createRequestHandler(
      path.resolve(__dirname, "../../../fixtures/gists-app")
    );

    let req = new Request("/gists");
    let res = await handleRequest(req, null);

    expect(res.headers.get("Content-Type")).toEqual("application/json");
    expect(JSON.parse(res.body as string)).toMatchInlineSnapshot(`
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
});
