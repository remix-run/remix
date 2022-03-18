import type { Browser, Page } from "puppeteer";
import puppeteer from "puppeteer";

import * as Utils from "./utils";

const testPort = 3000;
const testServer = `http://localhost:${testPort}`;

describe("_layout routes", () => {
  let browser: Browser;
  let page: Page;
  beforeEach(async () => {
    browser = await puppeteer.launch();
    page = await browser.newPage();
  });

  afterEach(() => browser.close());

  it("applied as parent route without javascript", async () => {
    await Utils.disableJavaScript(page);
    let response = await page.goto(`${testServer}/with-layout`);
    expect(response!.status()).toBe(200);
    expect(await Utils.getHtml(page, '[data-test-id="_layout"]'))
      .toMatchInlineSnapshot(`
      "<div data-test-id=\\"_layout\\">
        <h1>Layout Test</h1>
        <div><h1>Page inside layout</h1></div>
      </div>
      "
    `);
  });

  it("applied as parent route with javascript", async () => {
    await page.goto(`${testServer}/`);
    await Utils.reactIsHydrated(page);

    await page.click('a[href="/with-layout"]');
    await page.waitForSelector('[data-test-id="_layout"]');

    expect(await Utils.getHtml(page, '[data-test-id="_layout"]'))
      .toMatchInlineSnapshot(`
      "<div data-test-id=\\"_layout\\">
        <h1>Layout Test</h1>
        <div><h1>Page inside layout</h1></div>
      </div>
      "
    `);
  });
});
