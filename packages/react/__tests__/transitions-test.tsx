import puppeteer from "puppeteer";

import { prettyHtml } from "../../core/__tests__/utils";

import app from "../../../fixtures/gists-app/app-server";

describe("transitioning to a new route with data", () => {
  let server;
  beforeAll(() => {
    server = app.listen(3000);
  });

  afterAll(() => {
    server.close();
  });

  it("works", async () => {
    let browser = await puppeteer.launch();
    let page = await browser.newPage();
    await page.goto("http://localhost:3000");
    let content = await page.content();

    expect(prettyHtml(content)).toMatchInlineSnapshot(`
      "<!DOCTYPE html>
      <html lang=\\"en\\">
        <head>
          <meta charset=\\"utf-8\\" />
          <!--$-->
          <title>Gists Fixture App</title>
          <meta
            name=\\"description\\"
            content=\\"We're just tryin' to make sure stuff works, ya know?!\\"
          />
          <!--/$-->
          <link
            rel=\\"stylesheet\\"
            href=\\"//unpkg.com/@exampledev/new.css@1.1.3/new.css\\"
          />
        </head>
        <body class=\\"m-4\\">
          <nav>
            <div><a href=\\"/users\\">Users</a></div>
            <div><a href=\\"/gists\\">Gists</a></div>
          </nav>
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
              browserManifest: {
                __entry_browser__: {
                  fileName: \\"__entry_browser__.js\\",
                  imports: [
                    \\"index-d9da1d1d.js\\",
                    \\"index-bb339f26.js\\",
                    \\"index-dc0da983.js\\",
                  ],
                },
                \\"routes/index\\": {
                  fileName: \\"routes/index.js\\",
                  imports: [
                    \\"index-d9da1d1d.js\\",
                    \\"index-bb339f26.js\\",
                    \\"index-dc0da983.js\\",
                  ],
                },
              },
              matchedRouteIds: [\\"routes/index\\"],
              publicPath: \\"/build/\\",
              routeManifest: { \\"routes/index\\": { id: \\"routes/index\\", path: \\"/\\" } },
              routeData: { \\"routes/index\\": null },
              routeParams: { \\"routes/index\\": {} },
            };
          </script>
          <script type=\\"module\\" src=\\"/build/__entry_browser__.js\\"></script>
        </body>
      </html>
      "
    `);

    await page.click('a[href="/gists"]');
    await page.waitForSelector('[data-test-id="/gists/index"]');
    content = await page.content();

    expect(prettyHtml(content)).toMatchInlineSnapshot(`
      "<!DOCTYPE html>
      <html lang=\\"en\\">
        <head>
          <meta charset=\\"utf-8\\" />
          <!--$-->
          <title>Public Gists</title>
          <meta name=\\"description\\" content=\\"View the latest gists from the public\\" />
          <!--/$-->
          <link
            rel=\\"stylesheet\\"
            href=\\"//unpkg.com/@exampledev/new.css@1.1.3/new.css\\"
          />
        </head>
        <body class=\\"m-4\\">
          <nav>
            <div><a href=\\"/users\\">Users</a></div>
            <div><a href=\\"/gists\\">Gists</a></div>
          </nav>
          <!--$-->
          <div data-test-id=\\"/gists\\">
            <header>
              <h1>Gists</h1>
              <ul>
                <li>
                  <a class=\\"text-blue-700 underline\\" href=\\"/gists/ryanflorence\\"
                    >Ryan Florence<!-- -->
                  </a>
                </li>
                <li>
                  <a class=\\"text-blue-700 underline\\" href=\\"/gists/mjackson\\"
                    >Michael Jackson<!-- -->
                  </a>
                </li>
              </ul>
            </header>
            <div data-test-id=\\"/gists/index\\">
              <h2>Public Gists</h2>
              <ul>
                <li><a>remix-server.jsx</a></li>
              </ul>
            </div>
          </div>
          <!--/$-->
          <script>
            __remixContext = {
              browserManifest: {
                __entry_browser__: {
                  fileName: \\"__entry_browser__.js\\",
                  imports: [
                    \\"index-d9da1d1d.js\\",
                    \\"index-bb339f26.js\\",
                    \\"index-dc0da983.js\\",
                  ],
                },
                \\"routes/gists\\": {
                  fileName: \\"routes/gists.js\\",
                  imports: [
                    \\"index-d9da1d1d.js\\",
                    \\"index-bb339f26.js\\",
                    \\"index-dc0da983.js\\",
                  ],
                },
                \\"routes/gists/index\\": {
                  fileName: \\"routes/gists/index.js\\",
                  imports: [
                    \\"index-d9da1d1d.js\\",
                    \\"index-bb339f26.js\\",
                    \\"index-dc0da983.js\\",
                  ],
                },
              },
              matchedRouteIds: [\\"routes/gists\\", \\"routes/gists/index\\"],
              publicPath: \\"/build/\\",
              routeManifest: {
                \\"routes/gists\\": { id: \\"routes/gists\\", path: \\"gists\\" },
                \\"routes/gists/index\\": {
                  id: \\"routes/gists/index\\",
                  path: \\"/\\",
                  parentId: \\"routes/gists\\",
                },
              },
              routeData: {
                \\"routes/gists\\": {
                  users: [
                    { id: \\"ryanflorence\\", name: \\"Ryan Florence\\" },
                    { id: \\"mjackson\\", name: \\"Michael Jackson\\" },
                  ],
                },
                \\"routes/gists/index\\": [
                  {
                    url:
                      \\"https://api.github.com/gists/610613b54e5b34f8122d1ba4a3da21a9\\",
                    id: \\"610613b54e5b34f8122d1ba4a3da21a9\\",
                    files: { \\"remix-server.jsx\\": { filename: \\"remix-server.jsx\\" } },
                    owner: {
                      login: \\"ryanflorence\\",
                      id: 100200,
                      avatar_url:
                        \\"https://avatars0.githubusercontent.com/u/100200?v=4\\",
                    },
                  },
                ],
              },
              routeParams: { \\"routes/gists\\": {}, \\"routes/gists/index\\": {} },
            };
          </script>
          <script type=\\"module\\" src=\\"/build/__entry_browser__.js\\"></script>
        </body>
      </html>
      "
    `);

    return browser.close();
  });
});
