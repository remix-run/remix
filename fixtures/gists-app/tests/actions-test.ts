import path from "path";
import type { Browser, Page } from "puppeteer";
import puppeteer from "puppeteer";

import * as Utils from "./utils";

const testPort = 3000;
const testServer = `http://localhost:${testPort}`;

describe("action", () => {
  let browser: Browser;
  let page: Page;

  beforeEach(async () => {
    browser = await puppeteer.launch();
    page = await browser.newPage();
  });

  afterEach(() => browser.close());

  it("can return data and headers without JavaScript", async () => {
    await Promise.all([
      page.goto(`${testServer}/actions`),
      Utils.disableJavaScript(page)
    ]);

    let html = await Utils.getHtml(page, "#form");
    expect(html).toMatchInlineSnapshot(`
      "<form method=\\"post\\" action=\\"/actions\\" enctype=\\"multipart/form-data\\" id=\\"form\\">
        <p id=\\"action-text\\">Waiting...</p>
        <p>
          <label for=\\"file\\">Choose a file:</label
          ><input type=\\"file\\" id=\\"file\\" name=\\"file\\" />
        </p>
        <p>
          <input type=\\"text\\" name=\\"field1\\" value=\\"stuff\\" /><button
            type=\\"submit\\"
            id=\\"submit\\"
          >
            Go
          </button>
        </p>
        <p>ay! data from the loader!</p>
      </form>
      "
    `);

    let [response] = await Promise.all([
      page.waitForNavigation(),
      page.click("#submit")
    ]);

    expect(response!.status()).toBe(200);
    expect(response!.headers()["x-test"]).toBe("works");

    html = await Utils.getHtml(page, "#form");
    expect(html).toMatchInlineSnapshot(`
      "<form method=\\"post\\" action=\\"/actions\\" enctype=\\"multipart/form-data\\" id=\\"form\\">
        <p id=\\"action-text\\">
          <span id=\\"action-data\\">heyooo, data from the action: stuff</span>
        </p>
        <ul></ul>
        <p>
          <label for=\\"file\\">Choose a file:</label
          ><input type=\\"file\\" id=\\"file\\" name=\\"file\\" />
        </p>
        <p>
          <input type=\\"text\\" name=\\"field1\\" value=\\"stuff\\" /><button
            type=\\"submit\\"
            id=\\"submit\\"
          >
            Go
          </button>
        </p>
        <p>ay! data from the loader!</p>
      </form>
      "
    `);
  });

  it("can return data with JavaScript", async () => {
    await page.goto(`${testServer}/actions`);
    await Utils.reactIsHydrated(page);

    let html = await Utils.getHtml(page, "#form");
    expect(html).toMatchInlineSnapshot(`
      "<form method=\\"post\\" action=\\"/actions\\" enctype=\\"multipart/form-data\\" id=\\"form\\">
        <p id=\\"action-text\\">Waiting...</p>
        <p>
          <label for=\\"file\\">Choose a file:</label
          ><input type=\\"file\\" id=\\"file\\" name=\\"file\\" />
        </p>
        <p>
          <input type=\\"text\\" name=\\"field1\\" value=\\"stuff\\" /><button
            type=\\"submit\\"
            id=\\"submit\\"
          >
            Go
          </button>
        </p>
        <p>ay! data from the loader!</p>
      </form>
      "
    `);

    await page.click("button[type=submit]");
    await page.waitForSelector("#action-data");

    html = await Utils.getHtml(page, "#form");
    expect(html).toMatchInlineSnapshot(`
      "<form method=\\"post\\" action=\\"/actions\\" enctype=\\"multipart/form-data\\" id=\\"form\\">
        <p id=\\"action-text\\">
          <span id=\\"action-data\\">heyooo, data from the action: stuff</span>
        </p>
        <ul></ul>
        <p>
          <label for=\\"file\\">Choose a file:</label
          ><input type=\\"file\\" id=\\"file\\" name=\\"file\\" />
        </p>
        <p>
          <input type=\\"text\\" name=\\"field1\\" value=\\"stuff\\" /><button
            type=\\"submit\\"
            id=\\"submit\\"
          >
            Go
          </button>
        </p>
        <p>ay! data from the loader!</p>
      </form>
      "
    `);
  });

  it("can redirect on client for thrown responses in actions", async () => {
    await page.goto(`${testServer}/redirects/login`);
    await Utils.reactIsHydrated(page);

    await page.click("button[type=submit]");
    await page.waitForSelector("[data-testid='done'");
  });

  it("can upload file without JavaScript", async () => {
    await Promise.all([
      page.goto(`${testServer}/actions`),
      Utils.disableJavaScript(page)
    ]);

    let html = await Utils.getHtml(page, "#form");
    expect(html).toMatchInlineSnapshot(`
      "<form method=\\"post\\" action=\\"/actions\\" enctype=\\"multipart/form-data\\" id=\\"form\\">
        <p id=\\"action-text\\">Waiting...</p>
        <p>
          <label for=\\"file\\">Choose a file:</label
          ><input type=\\"file\\" id=\\"file\\" name=\\"file\\" />
        </p>
        <p>
          <input type=\\"text\\" name=\\"field1\\" value=\\"stuff\\" /><button
            type=\\"submit\\"
            id=\\"submit\\"
          >
            Go
          </button>
        </p>
        <p>ay! data from the loader!</p>
      </form>
      "
    `);

    let fileInput = await page.$("#file");
    await fileInput!.uploadFile(path.resolve(__dirname, "assets/toupload.txt"));

    let [response] = await Promise.all([
      page.waitForNavigation(),
      page.click("#submit")
    ]);

    expect(response!.status()).toBe(200);
    expect(response!.headers()["x-test"]).toBe("works");

    html = await Utils.getHtml(page, "#form");
    expect(html).toMatchInlineSnapshot(`
      "<form method=\\"post\\" action=\\"/actions\\" enctype=\\"multipart/form-data\\" id=\\"form\\">
        <p id=\\"action-text\\">
          <span id=\\"action-data\\">heyooo, data from the action: stuff</span>
        </p>
        <ul>
          <li>
            <pre><code>{
        \\"name\\": \\"toupload.txt\\",
        \\"size\\": 14
      }</code></pre>
          </li>
        </ul>
        <p>
          <label for=\\"file\\">Choose a file:</label
          ><input type=\\"file\\" id=\\"file\\" name=\\"file\\" />
        </p>
        <p>
          <input type=\\"text\\" name=\\"field1\\" value=\\"stuff\\" /><button
            type=\\"submit\\"
            id=\\"submit\\"
          >
            Go
          </button>
        </p>
        <p>ay! data from the loader!</p>
      </form>
      "
    `);
  });

  it("can upload file with JavaScript", async () => {
    await page.goto(`${testServer}/actions`);
    await Utils.reactIsHydrated(page);

    let html = await Utils.getHtml(page, "#form");
    expect(html).toMatchInlineSnapshot(`
      "<form method=\\"post\\" action=\\"/actions\\" enctype=\\"multipart/form-data\\" id=\\"form\\">
        <p id=\\"action-text\\">Waiting...</p>
        <p>
          <label for=\\"file\\">Choose a file:</label
          ><input type=\\"file\\" id=\\"file\\" name=\\"file\\" />
        </p>
        <p>
          <input type=\\"text\\" name=\\"field1\\" value=\\"stuff\\" /><button
            type=\\"submit\\"
            id=\\"submit\\"
          >
            Go
          </button>
        </p>
        <p>ay! data from the loader!</p>
      </form>
      "
    `);

    let fileInput = await page.$("#file");
    await fileInput!.uploadFile(path.resolve(__dirname, "assets/toupload.txt"));

    await page.click("button[type=submit]");
    await page.waitForSelector("#action-data");

    html = await Utils.getHtml(page, "#form");
    expect(html).toMatchInlineSnapshot(`
      "<form method=\\"post\\" action=\\"/actions\\" enctype=\\"multipart/form-data\\" id=\\"form\\">
        <p id=\\"action-text\\">
          <span id=\\"action-data\\">heyooo, data from the action: stuff</span>
        </p>
        <ul>
          <li>
            <pre><code>{
        \\"name\\": \\"toupload.txt\\",
        \\"size\\": 14
      }</code></pre>
          </li>
        </ul>
        <p>
          <label for=\\"file\\">Choose a file:</label
          ><input type=\\"file\\" id=\\"file\\" name=\\"file\\" />
        </p>
        <p>
          <input type=\\"text\\" name=\\"field1\\" value=\\"stuff\\" /><button
            type=\\"submit\\"
            id=\\"submit\\"
          >
            Go
          </button>
        </p>
        <p>ay! data from the loader!</p>
      </form>
      "
    `);
  });

  it("rejects too big of an upload without JavaScript", async () => {
    await Promise.all([
      page.goto(`${testServer}/actions`),
      Utils.disableJavaScript(page)
    ]);

    let html = await Utils.getHtml(page, "#form");
    expect(html).toMatchInlineSnapshot(`
      "<form method=\\"post\\" action=\\"/actions\\" enctype=\\"multipart/form-data\\" id=\\"form\\">
        <p id=\\"action-text\\">Waiting...</p>
        <p>
          <label for=\\"file\\">Choose a file:</label
          ><input type=\\"file\\" id=\\"file\\" name=\\"file\\" />
        </p>
        <p>
          <input type=\\"text\\" name=\\"field1\\" value=\\"stuff\\" /><button
            type=\\"submit\\"
            id=\\"submit\\"
          >
            Go
          </button>
        </p>
        <p>ay! data from the loader!</p>
      </form>
      "
    `);

    let fileInput = await page.$("#file");
    await fileInput!.uploadFile(
      path.resolve(__dirname, "assets/touploadtoobig.txt")
    );

    let [response] = await Promise.all([
      page.waitForNavigation(),
      page.click("#submit")
    ]);

    expect(response!.status()).toBe(500);

    html = await Utils.getHtml(page, "#actions-error-boundary");
    expect(html).toMatchInlineSnapshot(`
      "<div id=\\"actions-error-boundary\\">
        <h1>Actions Error Boundary</h1>
        <p>Field \\"file\\" exceeded upload size of 1234 bytes.</p>
      </div>
      "
    `);
  });

  it("rejects too big of an upload with JavaScript", async () => {
    await page.goto(`${testServer}/actions`);
    await Utils.reactIsHydrated(page);

    let html = await Utils.getHtml(page, "#form");
    expect(html).toMatchInlineSnapshot(`
      "<form method=\\"post\\" action=\\"/actions\\" enctype=\\"multipart/form-data\\" id=\\"form\\">
        <p id=\\"action-text\\">Waiting...</p>
        <p>
          <label for=\\"file\\">Choose a file:</label
          ><input type=\\"file\\" id=\\"file\\" name=\\"file\\" />
        </p>
        <p>
          <input type=\\"text\\" name=\\"field1\\" value=\\"stuff\\" /><button
            type=\\"submit\\"
            id=\\"submit\\"
          >
            Go
          </button>
        </p>
        <p>ay! data from the loader!</p>
      </form>
      "
    `);

    let fileInput = await page.$("#file");
    await fileInput!.uploadFile(
      path.resolve(__dirname, "assets/touploadtoobig.txt")
    );

    await page.click("button[type=submit]");
    await page.waitForSelector("#actions-error-boundary");

    html = await Utils.getHtml(page, "#actions-error-boundary");
    expect(html).toMatchInlineSnapshot(`
      "<div id=\\"actions-error-boundary\\">
        <h1>Actions Error Boundary</h1>
        <p>Unexpected Server Error</p>
      </div>
      "
    `);
  });
});
