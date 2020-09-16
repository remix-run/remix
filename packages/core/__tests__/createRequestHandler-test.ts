import path from "path";

import { Request } from "../platform";
import { createRequestHandler } from "../server";

describe("a remix request handler", () => {
  let remixRoot: string;
  beforeAll(() => {
    remixRoot = path.resolve(__dirname, "../../../fixtures/gists-app");
  });

  describe("serving HTML", () => {
    it("renders the server entry", async () => {
      let handleRequest = createRequestHandler(remixRoot);
      let req = new Request("/gists/ryanflorence");
      let res = await handleRequest(req, null);
      let text = await res.text();

      expect(res.headers.get("Content-Type")).toEqual("text/html");
      expect(text).toMatchInlineSnapshot(
        `"<!DOCTYPE html><html lang=\\"en\\"><head><meta charSet=\\"utf-8\\"/><title>1 gists from ryanflorence</title><meta name=\\"description\\" content=\\"View all of the gists from ryanflorence\\"/><link rel=\\"stylesheet\\" href=\\"//unpkg.com/@exampledev/new.css@1.1.3/new.css\\"/></head><body class=\\"m-4\\"><!--$--><div data-test-id=\\"/gists\\"><header><h1>Gists</h1><ul><li><a href=\\"#\\">link</a></li><li><a href=\\"#\\">link</a></li></ul></header><div data-test-id=\\"/gists/$username\\"><h2>All gists from <!-- -->ryanflorence</h2><ul><li><a>remix-server.jsx</a></li></ul></div></div><!--/$--></body></html>"`
      );
    });

    it("renders a 302 when the loader returns a Redirect", async () => {
      let handleRequest = createRequestHandler(remixRoot);
      let req = new Request("/gists/mjijackson");
      let res = await handleRequest(req, null);
      let text = await res.text();

      expect(res.status).toEqual(302);
      expect(res.headers.get("Content-Type")).toMatch("text/plain");
      expect(res.headers.get("Location")).toEqual("/gists/mjackson");
      expect(text).toMatchInlineSnapshot(`"Redirecting to /gists/mjackson"`);
    });

    it("renders a 404 page when the loader returns a NotFound", async () => {
      let handleRequest = createRequestHandler(remixRoot);
      let req = new Request("/gists/_why");
      let res = await handleRequest(req, null);
      let text = await res.text();

      expect(res.status).toEqual(404);
      expect(res.headers.get("Content-Type")).toEqual("text/html");
      expect(text).toMatchInlineSnapshot(
        `"<!DOCTYPE html><html lang=\\"en\\"><head><meta charSet=\\"utf-8\\"/><title>Ain&#x27;t nothing here</title><link rel=\\"stylesheet\\" href=\\"//unpkg.com/@exampledev/new.css@1.1.3/new.css\\"/></head><body class=\\"m-4\\"><!--$--><div data-test-id=\\"/404\\"><h1>404</h1></div><!--/$--></body></html>"`
      );
    });

    it("renders a 500 page when the loader has an error", async () => {
      let handleRequest = createRequestHandler(remixRoot);
      let req = new Request("/gists/DANGER");
      let res = await handleRequest(req, null);
      let text = await res.text();

      expect(res.status).toEqual(500);
      expect(res.headers.get("Content-Type")).toEqual("text/html");
      expect(text).toMatchInlineSnapshot(
        `"<!DOCTYPE html><html lang=\\"en\\"><head><meta charSet=\\"utf-8\\"/><title>Remix Error: Route Not Found</title><meta name=\\"description\\" content=\\"There was an error rendering this page\\"/><link rel=\\"stylesheet\\" href=\\"//unpkg.com/@exampledev/new.css@1.1.3/new.css\\"/></head><body class=\\"m-4\\"><!--$--><div><h1>Error!</h1><div><p>Missing route &quot;<!-- -->routes/500<!-- -->&quot;!</p></div></div><!--/$--></body></html>"`
      );
    });
  });

  describe("serving data", () => {
    it('without a "from" param', async () => {
      let handleRequest = createRequestHandler(remixRoot);

      let req = new Request("/__remix_data?path=/gists");
      let res = await handleRequest(req, null);
      let json = await res.json();

      expect(res.headers.get("Content-Type")).toEqual("application/json");
      expect(json).toMatchInlineSnapshot(`
        Array [
          Object {
            "data": null,
            "routeId": "routes/gists",
            "type": "LoaderResultSuccess",
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
            "routeId": "routes/gists/index",
            "type": "LoaderResultSuccess",
          },
        ]
      `);
    });

    // /gists => /gists/456
    // matches: [gists, gists/456]
    // fromMatches: [gists, gists/index]
    // newMatches: [gists/456]
    // response: [flag, gists/456]
    describe("from parent to child", () => {
      it("returns copy for parent, data for child", async () => {
        let handleRequest = createRequestHandler(remixRoot);
        let req = new Request("/__remix_data?path=/gists/456&from=/gists");
        let res = await handleRequest(req, null);
        let json = await res.json();

        expect(res.headers.get("Content-Type")).toEqual("application/json");
        expect(json).toMatchInlineSnapshot(`
          Array [
            Object {
              "routeId": "routes/gists",
              "type": "LoaderResultCopy",
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
              "routeId": "routes/gists/$username",
              "type": "LoaderResultSuccess",
            },
          ]
        `);
      });
    });

    // /gists/123 => /gists/456
    // matches: [gists, gists/456]
    // fromMatches: [gists, gists/123]
    // newMatches: [gists/456]
    // response: [flag, gists/456]
    describe("for a sibling route", () => {
      it("returns copy for parent, data for sibling", async () => {
        let handleRequest = createRequestHandler(remixRoot);
        let req = new Request("/__remix_data?path=/gists/456&from=/gists/123");
        let res = await handleRequest(req, null);
        let json = await res.json();

        expect(res.headers.get("Content-Type")).toEqual("application/json");
        expect(json).toMatchInlineSnapshot(`
          Array [
            Object {
              "routeId": "routes/gists",
              "type": "LoaderResultCopy",
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
              "routeId": "routes/gists/$username",
              "type": "LoaderResultSuccess",
            },
          ]
        `);
      });
    });

    // /users/123 => /gists/456
    // matches: [gists, gists/456]
    // fromMatches: [users, users/123]
    // newMatches: [gists, gists/456]
    // response: [gists, gists/456]
    describe("for a cousin route", () => {
      it("returns all new data", async () => {
        let handleRequest = createRequestHandler(remixRoot);
        let req = new Request("/__remix_data?path=/gists/456&from=/users/123");
        let res = await handleRequest(req, null);
        let json = await res.json();

        expect(res.headers.get("Content-Type")).toEqual("application/json");
        expect(json).toMatchInlineSnapshot(`
          Array [
            Object {
              "data": null,
              "routeId": "routes/gists",
              "type": "LoaderResultSuccess",
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
              "routeId": "routes/gists/$username",
              "type": "LoaderResultSuccess",
            },
          ]
        `);
      });
    });

    // /gists/123/edit => /gists/456
    // matches: [gists, gists/456]
    // fromMatches: [gists, gists/123, gists/123/edit]
    // newMatches: [gists/456]
    // response: [flag, gists/456]
    describe("from niece to uncle", () => {
      it("returns copy for shared parent, data for niece", async () => {
        let handleRequest = createRequestHandler(remixRoot);
        let req = new Request(
          "/__remix_data?path=/gists/456&from=/gists/123/edit"
        );
        let res = await handleRequest(req, null);
        let json = await res.json();

        expect(res.headers.get("Content-Type")).toEqual("application/json");
        expect(json).toMatchInlineSnapshot(`
          Array [
            Object {
              "routeId": "routes/gists",
              "type": "LoaderResultCopy",
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
              "routeId": "routes/gists/$username",
              "type": "LoaderResultSuccess",
            },
          ]
        `);
      });
    });
  });
});
