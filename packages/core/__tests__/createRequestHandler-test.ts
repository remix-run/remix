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
      let req = new Request("/");
      let res = await handleRequest(req, null);
      let text = await res.text();

      expect(res.headers.get("Content-Type")).toEqual("text/html");
      expect(text).toMatchInlineSnapshot(`"<!DOCTYPE html><div>hello</div>"`);
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
                  "id": "routes/gists",
                  "params": Object {},
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
                  "params": Object {},
                  "status": "SUCCESS",
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
                      "id": "routes/gists",
                      "params": Object {},
                      "status": "COPY",
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
                      "id": "routes/gists/$username",
                      "params": Object {
                        "username": "456",
                      },
                      "status": "SUCCESS",
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
                      "id": "routes/gists",
                      "params": Object {},
                      "status": "COPY",
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
                      "id": "routes/gists/$username",
                      "params": Object {
                        "username": "456",
                      },
                      "status": "SUCCESS",
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
                      "id": "routes/gists",
                      "params": Object {},
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
                      "id": "routes/gists/$username",
                      "params": Object {
                        "username": "456",
                      },
                      "status": "SUCCESS",
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
                      "id": "routes/gists",
                      "params": Object {},
                      "status": "COPY",
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
                      "id": "routes/gists/$username",
                      "params": Object {
                        "username": "456",
                      },
                      "status": "SUCCESS",
                    },
                  ]
              `);
      });
    });
  });
});
