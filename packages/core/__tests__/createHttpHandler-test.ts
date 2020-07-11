import path from "path";
import prettier from "prettier";

import createHttpHandler from "../createHttpHandler";

describe("createHttpHandler", () => {
  // We ask the platform how to find the url, how to find a request header, how
  // to send JSON, etc. We pass in a delegate from something like
  // @remix-run/express and then we can share all the rest of the code between
  // platforms.
  let handler = createHttpHandler(
    {
      getUrl(mockReq) {
        return mockReq.url;
      },
      sendJson(data, mockReq, mockRes) {
        mockRes.json(data);
        mockRes.end();
      }
    },
    appRoot
  )({});

  // TODO: we should see if we can get away with only doing URLs and not routeId `paths`.
  // 1. Payload size sent to the server. We'd probably need to use a post with
  //    body since URL's and headers have limits
  // 2. How fast `matchRoutes` is, if we're matching 2000 urls in one request,
  //    how long does that take?
  it("responds with manifest patches for URLs", async done => {
    let responseJson;
    let mockReq = {
      url: `/_remix-patch?paths=${JSON.stringify([
        "/gists/alice",
        "/gists/aaron",
        "/gists/mine"
      ])}`
    };
    let mockRes = {
      json(json) {
        responseJson = json;
      },
      end: done
    };
    await handler(mockReq, mockRes);
    expect(responseJson).toMatchInlineSnapshot(`
      Object {
        "routes/gists": Object {
          "manifest": Object {
            "js": Array [
              "runtime.js",
              "vendors~main~pages/one~pages/two~routes/404~routes/gists~routes/gists.mine~routes/gists/$username~ro~2b3cdd21.js",
              "vendors~main~routes/gists~routes/gists/$username~routes/gists/index~routes/index.js",
              "main~routes/gists~routes/gists/$username~routes/gists/index~routes/index.js",
              "routes/gists.js",
            ],
            "js.map": Array [
              "runtime.js.map",
              "vendors~main~pages/one~pages/two~routes/404~routes/gists~routes/gists.mine~routes/gists/$username~ro~2b3cdd21.js.map",
              "vendors~main~routes/gists~routes/gists/$username~routes/gists/index~routes/index.js.map",
              "main~routes/gists~routes/gists/$username~routes/gists/index~routes/index.js.map",
              "routes/gists.js.map",
            ],
          },
          "parentId": null,
          "path": "gists",
        },
        "routes/gists.mine": Object {
          "manifest": Object {
            "js": Array [
              "runtime.js",
              "vendors~main~pages/one~pages/two~routes/404~routes/gists~routes/gists.mine~routes/gists/$username~ro~2b3cdd21.js",
              "routes/gists.mine.js",
            ],
            "js.map": Array [
              "runtime.js.map",
              "vendors~main~pages/one~pages/two~routes/404~routes/gists~routes/gists.mine~routes/gists/$username~ro~2b3cdd21.js.map",
              "routes/gists.mine.js.map",
            ],
          },
          "parentId": null,
          "path": "gists/mine",
        },
        "routes/gists/$username": Object {
          "manifest": Object {
            "js": Array [
              "runtime.js",
              "vendors~main~pages/one~pages/two~routes/404~routes/gists~routes/gists.mine~routes/gists/$username~ro~2b3cdd21.js",
              "vendors~main~routes/gists~routes/gists/$username~routes/gists/index~routes/index.js",
              "main~routes/gists~routes/gists/$username~routes/gists/index~routes/index.js",
              "routes/gists/$username.js",
            ],
            "js.map": Array [
              "runtime.js.map",
              "vendors~main~pages/one~pages/two~routes/404~routes/gists~routes/gists.mine~routes/gists/$username~ro~2b3cdd21.js.map",
              "vendors~main~routes/gists~routes/gists/$username~routes/gists/index~routes/index.js.map",
              "main~routes/gists~routes/gists/$username~routes/gists/index~routes/index.js.map",
              "routes/gists/$username.js.map",
            ],
          },
          "parentId": "routes/gists",
          "path": ":username",
        },
      }
    `);
  });

  it("responds with manifest patches for route IDs", async done => {
    let responseJSON;
    let mockReq = {
      url: `/_remix-patch?paths=${JSON.stringify([
        "routes/gists/$username",
        "routes/gists.mine"
      ])}`
    };
    let mockRes = {
      json(json) {
        responseJSON = json;
      },
      end: done
    };
    await handler(mockReq, mockRes);
    expect(responseJSON).toMatchInlineSnapshot(`
      Object {
        "routes/gists": Object {
          "manifest": Object {
            "js": Array [
              "runtime.js",
              "vendors~main~pages/one~pages/two~routes/404~routes/gists~routes/gists.mine~routes/gists/$username~ro~2b3cdd21.js",
              "vendors~main~routes/gists~routes/gists/$username~routes/gists/index~routes/index.js",
              "main~routes/gists~routes/gists/$username~routes/gists/index~routes/index.js",
              "routes/gists.js",
            ],
            "js.map": Array [
              "runtime.js.map",
              "vendors~main~pages/one~pages/two~routes/404~routes/gists~routes/gists.mine~routes/gists/$username~ro~2b3cdd21.js.map",
              "vendors~main~routes/gists~routes/gists/$username~routes/gists/index~routes/index.js.map",
              "main~routes/gists~routes/gists/$username~routes/gists/index~routes/index.js.map",
              "routes/gists.js.map",
            ],
          },
          "parentId": null,
          "path": "gists",
        },
        "routes/gists.mine": Object {
          "manifest": Object {
            "js": Array [
              "runtime.js",
              "vendors~main~pages/one~pages/two~routes/404~routes/gists~routes/gists.mine~routes/gists/$username~ro~2b3cdd21.js",
              "routes/gists.mine.js",
            ],
            "js.map": Array [
              "runtime.js.map",
              "vendors~main~pages/one~pages/two~routes/404~routes/gists~routes/gists.mine~routes/gists/$username~ro~2b3cdd21.js.map",
              "routes/gists.mine.js.map",
            ],
          },
          "parentId": null,
          "path": "gists/mine",
        },
        "routes/gists/$username": Object {
          "manifest": Object {
            "js": Array [
              "runtime.js",
              "vendors~main~pages/one~pages/two~routes/404~routes/gists~routes/gists.mine~routes/gists/$username~ro~2b3cdd21.js",
              "vendors~main~routes/gists~routes/gists/$username~routes/gists/index~routes/index.js",
              "main~routes/gists~routes/gists/$username~routes/gists/index~routes/index.js",
              "routes/gists/$username.js",
            ],
            "js.map": Array [
              "runtime.js.map",
              "vendors~main~pages/one~pages/two~routes/404~routes/gists~routes/gists.mine~routes/gists/$username~ro~2b3cdd21.js.map",
              "vendors~main~routes/gists~routes/gists/$username~routes/gists/index~routes/index.js.map",
              "main~routes/gists~routes/gists/$username~routes/gists/index~routes/index.js.map",
              "routes/gists/$username.js.map",
            ],
          },
          "parentId": "routes/gists",
          "path": ":username",
        },
      }
    `);
  });

  it("responds with route data for data requests", async done => {
    let responseJSON;
    let mockReq = {
      url: `/_remix-data?to=/gists&from=/`
    };
    let mockRes = {
      json(json) {
        responseJSON = json;
      },
      end: done
    };
    await handler(mockReq, mockRes);
    expect(responseJSON).toMatchInlineSnapshot(`
      Array [
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
      ]
    `);
  });

  it.only("renders the html", async done => {
    let responseText = null;
    let mockReq = { url: "/" };
    let mockRes = {
      write(markup) {
        responseText = prettier.format(markup, { parser: "html" });
      },
      end: done
    };
    await handler(mockReq, mockRes);
    expect(responseText).toMatchInlineSnapshot(`
      "<!DOCTYPE html>
      <html lang=\\"en\\">
        <head>
          <meta charset=\\"utf-8\\" />
          <link
            rel=\\"stylesheet\\"
            href=\\"//unpkg.com/@exampledev/new.css@1.1.3/new.css\\"
          />
        </head>
        <body class=\\"m-4\\">
          <!--$-->
          <div data-test-id=\\"/\\">
            <header><h1>Cool Gists App</h1></header>
            <nav>
              <ul>
                <li>
                  <a class=\\"text-blue-700 underline\\" href=\\"/gists\\">View Some gists</a>
                </li>
                <li>
                  <a class=\\"text-blue-700 underline\\" href=\\"/user-gists/ryanflorence\\"
                    >Server Redirect</a
                  >
                </li>
                <li>
                  <a class=\\"text-blue-700 underline\\" href=\\"/fart\\">Broken link</a>
                </li>
              </ul>
            </nav>
          </div>
          <!--/$-->
          <script>
            __remixContext = {
              assets: {
                meta: [],
                web: {
                  chunks: [
                    \\"runtime.js\\",
                    \\"vendors~main~pages/one~pages/two~routes/404~routes/gists~routes/gists.mine~routes/gists/$username~ro~2b3cdd21.js\\",
                    \\"vendors~main~routes/gists~routes/gists/$username~routes/gists/index~routes/index.js\\",
                    \\"vendors~main.js\\",
                    \\"main~routes/gists~routes/gists/$username~routes/gists/index~routes/index.js\\",
                    \\"main.js\\",
                    \\"routes/index.js\\",
                  ],
                  \\"main.css\\": \\"1.css\\",
                },
              },
              data: [{ id: \\"routes/index\\", data: null }],
              publicPath: \\"/build\\",
              manifest: {
                \\"routes/index\\": {
                  path: \\"/\\",
                  parentId: null,
                  manifest: {
                    js: [
                      \\"runtime.js\\",
                      \\"vendors~main~pages/one~pages/two~routes/404~routes/gists~routes/gists.mine~routes/gists/$username~ro~2b3cdd21.js\\",
                      \\"vendors~main~routes/gists~routes/gists/$username~routes/gists/index~routes/index.js\\",
                      \\"main~routes/gists~routes/gists/$username~routes/gists/index~routes/index.js\\",
                      \\"routes/index.js\\",
                    ],
                  },
                },
              },
            };
          </script>
          <script src=\\"/build/runtime.js\\"></script>
          <script src=\\"/build/vendors~main~pages/one~pages/two~routes/404~routes/gists~routes/gists.mine~routes/gists/$username~ro~2b3cdd21.js\\"></script>
          <script src=\\"/build/vendors~main~routes/gists~routes/gists/$username~routes/gists/index~routes/index.js\\"></script>
          <script src=\\"/build/vendors~main.js\\"></script>
          <script src=\\"/build/main~routes/gists~routes/gists/$username~routes/gists/index~routes/index.js\\"></script>
          <script src=\\"/build/main.js\\"></script>
          <script src=\\"/build/routes/index.js\\"></script>
        </body>
      </html>
      "
    `);
  });
});
