import type { Browser, Page } from "puppeteer";
import puppeteer from "puppeteer";

import { disableJavaScript, getHtml, reactIsHydrated } from "./utils";

const testPort = 3000;
const testServer = `http://localhost:${testPort}`;

describe("form", () => {
  let browser: Browser;
  let page: Page;
  beforeEach(async () => {
    browser = await puppeteer.launch();
    page = await browser.newPage();
  });

  afterEach(() => browser.close());

  it("posts to a loader without JavaScript", async () => {
    await disableJavaScript(page);
    await page.goto(`${testServer}/methods`);

    expect(await getHtml(page, "#results")).toMatchInlineSnapshot(`
      "<div
        id=\\"results\\"
        style=\\"opacity: 1; transition: opacity 300ms; transition-delay: 50ms\\"
      >
        <p>null</p>
      </div>
      "
    `);

    await Promise.all([
      page.click("button[type=submit]"),
      page.waitForNavigation()
    ]);

    expect(await getHtml(page, "#results")).toMatchInlineSnapshot(`
      "<div
        id=\\"results\\"
        style=\\"opacity: 1; transition: opacity 300ms; transition-delay: 50ms\\"
      >
        <dl data-test-id=\\"post\\">
          <div>
            <dt>selectedMethod</dt>
            <dd>post</dd>
          </div>
          <div>
            <dt>selectedEnctype</dt>
            <dd>application/x-www-form-urlencoded</dd>
          </div>
          <div>
            <dt>userInput</dt>
            <dd>whatever</dd>
          </div>
        </dl>
      </div>
      "
    `);
  });

  it("posts to a loader", async () => {
    await page.goto(`${testServer}/methods`);
    await reactIsHydrated(page);

    expect(await getHtml(page, "#results")).toMatchInlineSnapshot(`
      "<div
        id=\\"results\\"
        style=\\"opacity: 1; transition: opacity 300ms; transition-delay: 50ms\\"
      >
        <p>null</p>
      </div>
      "
    `);

    await page.click("button[type=submit]");
    await page.waitForSelector("[data-test-id='post']");

    expect(await getHtml(page, "#results")).toMatchInlineSnapshot(`
      "<div id=\\"results\\" style=\\"opacity: 1; transition: opacity 300ms ease 50ms\\">
        <dl data-test-id=\\"post\\">
          <div>
            <dt>selectedMethod</dt>
            <dd>post</dd>
          </div>
          <div>
            <dt>selectedEnctype</dt>
            <dd>application/x-www-form-urlencoded</dd>
          </div>
          <div>
            <dt>userInput</dt>
            <dd>whatever</dd>
          </div>
        </dl>
      </div>
      "
    `);
  });
});
