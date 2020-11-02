import type { Browser, Page } from "puppeteer";
import puppeteer from "puppeteer";

import { getHtml, reactIsHydrated } from "./utils";

const testPort = 3000;
const testServer = `http://localhost:${testPort}`;

describe("mdx component", () => {
  let browser: Browser;
  let page: Page;
  beforeEach(async () => {
    browser = await puppeteer.launch();
    page = await browser.newPage();
  });

  afterEach(() => browser.close());

  it("works", async () => {
    await page.goto(`${testServer}/page/one`);
    await reactIsHydrated(page);

    expect(
      await getHtml(page, '[data-test-id="counter-button"]')
    ).toMatchSnapshot();

    await page.click('[data-test-id="counter-button"]');

    expect(
      await getHtml(page, '[data-test-id="counter-button"]')
    ).toMatchSnapshot();
  });
});
