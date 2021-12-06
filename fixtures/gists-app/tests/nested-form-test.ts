import type { Browser, Page } from "puppeteer";
import puppeteer from "puppeteer";

import { reactIsHydrated } from "./utils";

const testPort = 3000;
const testServer = `http://localhost:${testPort}`;

describe("nested form", () => {
  let browser: Browser;
  let page: Page;
  beforeEach(async () => {
    browser = await puppeteer.launch();
    page = await browser.newPage();
  });

  afterEach(() => browser.close());

  it("keep query string on post", async () => {
    await page.goto(`${testServer}/nested-forms?q=1`);
    await reactIsHydrated(page);

    const originalUrl = page.url();
    await page.click("button[type=submit]");
    expect(page.url()).toEqual(originalUrl);
  });
});
