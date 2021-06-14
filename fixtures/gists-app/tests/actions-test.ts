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
      "<form
        method=\\"post\\"
        action=\\"/actions\\"
        enctype=\\"application/x-www-form-urlencoded\\"
        id=\\"form\\"
      >
        <p id=\\"action-text\\">Waiting...</p>
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
      "<form
        method=\\"post\\"
        action=\\"/actions\\"
        enctype=\\"application/x-www-form-urlencoded\\"
        id=\\"form\\"
      >
        <p id=\\"action-text\\">
          <span id=\\"action-data\\">heyooo, data from the action</span>
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
      "<form
        method=\\"post\\"
        action=\\"/actions\\"
        enctype=\\"application/x-www-form-urlencoded\\"
        id=\\"form\\"
      >
        <p id=\\"action-text\\">Waiting...</p>
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
      "<form
        method=\\"post\\"
        action=\\"/actions\\"
        enctype=\\"application/x-www-form-urlencoded\\"
        id=\\"form\\"
      >
        <p id=\\"action-text\\">
          <span id=\\"action-data\\">heyooo, data from the action</span>
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

  it("reloads loaders on the page", async () => {
    await page.goto(`${testServer}/actions`);
    await Utils.reactIsHydrated(page);

    let responses = Utils.collectDataResponses(page);

    await page.click("button[type=submit]");
    await page.waitForSelector("#action-data");

    expect(responses.length).toBe(3);
  });

  it("resubmits on pop events", async () => {
    await page.goto(`${testServer}/actions`);
    await Utils.reactIsHydrated(page);

    await page.click("button[type=submit]");
    await page.waitForSelector("#action-data");

    await page.goBack();
    let html = await Utils.getHtml(page, "#action-text");
    expect(html).toMatchInlineSnapshot(`
      "<p id=\\"action-text\\">Waiting...</p>
      "
    `);

    let responses = Utils.collectDataResponses(page);
    await page.goForward();
    await page.waitForSelector("#action-data");

    // reposted
    let actionReq = responses[0].request();
    expect(actionReq.url()).toBe(
      "http://localhost:3000/actions?_data=routes%2Factions"
    );
    expect(actionReq.method()).toBe("POST");

    // re-called loaders
    expect(responses.length).toBe(3);
  });

  it.todo("reposts if the user clicks refresh");
  it.todo("reloads all loaders if action redirects");
});
