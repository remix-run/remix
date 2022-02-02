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

    await Promise.all([page.click("button#submit"), page.waitForNavigation()]);

    expect(await getHtml(page, "#results")).toMatchInlineSnapshot(`
      "<div
        id=\\"results\\"
        style=\\"opacity: 1; transition: opacity 300ms; transition-delay: 50ms\\"
      >
        <dl data-test-id=\\"post\\">
          <div>
            <dt>selectedMethod</dt>
            <dd>\\"post\\"</dd>
          </div>
          <div>
            <dt>selectedEnctype</dt>
            <dd>\\"application/x-www-form-urlencoded\\"</dd>
          </div>
          <div>
            <dt>userInput</dt>
            <dd>\\"whatever\\"</dd>
          </div>
          <div>
            <dt>multiple[]</dt>
            <dd>[\\"a\\",\\"b\\"]</dd>
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

    await page.click("button#submit");
    await page.waitForSelector("[data-test-id='post']");

    expect(await getHtml(page, "#results")).toMatchInlineSnapshot(`
      "<div id=\\"results\\" style=\\"opacity: 1; transition: opacity 300ms ease 50ms\\">
        <dl data-test-id=\\"post\\">
          <div>
            <dt>selectedMethod</dt>
            <dd>\\"post\\"</dd>
          </div>
          <div>
            <dt>selectedEnctype</dt>
            <dd>\\"application/x-www-form-urlencoded\\"</dd>
          </div>
          <div>
            <dt>userInput</dt>
            <dd>\\"whatever\\"</dd>
          </div>
          <div>
            <dt>multiple[]</dt>
            <dd>[\\"a\\",\\"b\\"]</dd>
          </div>
        </dl>
      </div>
      "
    `);
  });

  it("posts to a loader with button data", async () => {
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

    await page.click("button#submit-with-data");
    await page.waitForSelector("[data-test-id='post']");

    expect(await getHtml(page, "#results")).toMatchInlineSnapshot(`
      "<div id=\\"results\\" style=\\"opacity: 1; transition: opacity 300ms ease 50ms\\">
        <dl data-test-id=\\"post\\">
          <div>
            <dt>selectedMethod</dt>
            <dd>\\"post\\"</dd>
          </div>
          <div>
            <dt>selectedEnctype</dt>
            <dd>\\"application/x-www-form-urlencoded\\"</dd>
          </div>
          <div>
            <dt>userInput</dt>
            <dd>\\"whatever\\"</dd>
          </div>
          <div>
            <dt>multiple[]</dt>
            <dd>[\\"a\\",\\"b\\"]</dd>
          </div>
          <div>
            <dt>data</dt>
            <dd>\\"c\\"</dd>
          </div>
        </dl>
      </div>
      "
    `);
  });

  it("posts to a loader with button data even when the button is outside the form", async () => {
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

    await page.click("button#submit-with-data-outside-form");
    await page.waitForSelector("[data-test-id='post']");

    expect(await getHtml(page, "#results")).toMatchInlineSnapshot(`
      "<div id=\\"results\\" style=\\"opacity: 1; transition: opacity 300ms ease 50ms\\">
        <dl data-test-id=\\"post\\">
          <div>
            <dt>selectedMethod</dt>
            <dd>\\"post\\"</dd>
          </div>
          <div>
            <dt>selectedEnctype</dt>
            <dd>\\"application/x-www-form-urlencoded\\"</dd>
          </div>
          <div>
            <dt>userInput</dt>
            <dd>\\"whatever\\"</dd>
          </div>
          <div>
            <dt>multiple[]</dt>
            <dd>[\\"a\\",\\"b\\"]</dd>
          </div>
          <div>
            <dt>data</dt>
            <dd>\\"d\\"</dd>
          </div>
        </dl>
      </div>
      "
    `);
  });

  it("posts with the correct checkbox data", async () => {
    await page.goto(`${testServer}/methods`);
    await reactIsHydrated(page);

    page.click("button#submit-with-data");

    let res = await page.waitForRequest(
      req => req.method().toLowerCase() === "post"
    );

    let postData = res.postData();
    expect(postData).toEqual(expect.any(String));
    expect(postData!.includes(encodeURI("multiple[]=a&multiple[]=b"))).toBe(
      true
    );
  });

  describe("with keyboard events", () => {
    it("posts to a loader with button data", async () => {
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

      await page.focus("input[name=userInput]");
      await page.keyboard.press("Enter");
      await page.waitForSelector("[data-test-id='post']");

      // Because the submit-with-data is the first button in the form, its value
      // should appear in the results.
      expect(await getHtml(page, "#results")).toMatchInlineSnapshot(`
          "<div id=\\"results\\" style=\\"opacity: 1; transition: opacity 300ms ease 50ms\\">
            <dl data-test-id=\\"post\\">
              <div>
                <dt>selectedMethod</dt>
                <dd>\\"post\\"</dd>
              </div>
              <div>
                <dt>selectedEnctype</dt>
                <dd>\\"application/x-www-form-urlencoded\\"</dd>
              </div>
              <div>
                <dt>userInput</dt>
                <dd>\\"whatever\\"</dd>
              </div>
              <div>
                <dt>multiple[]</dt>
                <dd>[\\"a\\",\\"b\\"]</dd>
              </div>
              <div>
                <dt>data</dt>
                <dd>\\"c\\"</dd>
              </div>
            </dl>
          </div>
          "
        `);
    });
  });
});
