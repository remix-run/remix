const shell = require("shelljs");
const puppeteer = require("puppeteer");
const app = require("../app-server");
const prettier = require("prettier");

if (process.env.REBUILD !== "false") {
  console.log("Skip the build with `REBUILD=false yarn test`");
  shell.exec("NODE_ENV=test remix build");
} else {
  console.log("Skipped the build, be careful!");
}

describe("gists-app fixture", () => {
  let server;

  beforeAll(() => {
    server = app.listen(3000);
  });

  afterAll(() => {
    server.close();
  });

  it("as we navigate around and stuff", async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto("http://localhost:3000");
    let content = prettier.format(await page.content(), { parser: "html" });
    expect(content).toMatchInlineSnapshot(`
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

    // navigate to /gists
    await page.click("a[href='/gists']");
    await page.waitForSelector("[data-test-id='/gists/index']");
    content = prettier.format(await page.content(), { parser: "html" });
    expect(content).toMatchInlineSnapshot(`
      "<!DOCTYPE html>
      <html lang=\\"en\\">
        <head>
          <meta charset=\\"utf-8\\" />
          <link
            rel=\\"stylesheet\\"
            href=\\"//unpkg.com/@exampledev/new.css@1.1.3/new.css\\"
          />
          <script src=\\"/build/routes/gists.js\\"></script>
          <script src=\\"/build/routes/gists/index.js\\"></script>
        </head>
        <body class=\\"m-4\\">
          <!--$--><!--/$-->
          <div data-test-id=\\"/gists\\">
            <header>
              <h1>Gists</h1>
              <ul>
                <li>
                  <a class=\\"text-blue-700 underline\\" href=\\"/gists/ryanflorence\\"
                    >Ryan Florence</a
                  >
                </li>
                <li>
                  <a class=\\"text-blue-700 underline\\" href=\\"/gists/mjackson\\"
                    >Michael Jackson</a
                  >
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
                \\"routes/gists\\": {
                  path: \\"gists\\",
                  parentId: null,
                  manifest: {
                    js: [
                      \\"runtime.js\\",
                      \\"vendors~main~pages/one~pages/two~routes/404~routes/gists~routes/gists.mine~routes/gists/$username~ro~2b3cdd21.js\\",
                      \\"vendors~main~routes/gists~routes/gists/$username~routes/gists/index~routes/index.js\\",
                      \\"main~routes/gists~routes/gists/$username~routes/gists/index~routes/index.js\\",
                      \\"routes/gists.js\\",
                    ],
                  },
                },
                \\"routes/gists/index\\": {
                  path: \\"/\\",
                  parentId: \\"routes/gists\\",
                  manifest: {
                    js: [
                      \\"runtime.js\\",
                      \\"vendors~main~pages/one~pages/two~routes/404~routes/gists~routes/gists.mine~routes/gists/$username~ro~2b3cdd21.js\\",
                      \\"vendors~main~routes/gists~routes/gists/$username~routes/gists/index~routes/index.js\\",
                      \\"main~routes/gists~routes/gists/$username~routes/gists/index~routes/index.js\\",
                      \\"routes/gists/index.js\\",
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
    return browser.close();
  });
});
