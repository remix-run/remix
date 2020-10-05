import type { Browser, Page } from "puppeteer";
import puppeteer from "puppeteer";

import { prettyHtml } from "./utils";

const testPort = 3000;
const testServer = `http://localhost:${testPort}`;

describe("the server HTML", () => {
  let browser: Browser;
  let page: Page;
  beforeEach(async () => {
    browser = await puppeteer.launch();
    page = await browser.newPage();
  });

  afterEach(() => {
    return browser.close();
  });

  it("is correct", async () => {
    await page.goto(`${testServer}/`);

    // Important: Do NOT wait for React to hydrate because we want to test the
    // server HTML output.

    expect(prettyHtml(await page.content())).toMatchSnapshot("page");
  });
});
