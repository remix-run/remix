import path from "path";
import fse from "fs-extra";
import cp from "child_process";
import type { Writable } from "stream";
import type {
  Page,
  Response as HTTPResponse,
  Request as HTTPRequest,
} from "@playwright/test";
import { test } from "@playwright/test";
import express from "express";
import cheerio from "cheerio";
import prettier from "prettier";
import getPort from "get-port";
import stripIndent from "strip-indent";
import chalk from "chalk";
import { sync as spawnSync } from "cross-spawn";

import type { ServerBuild } from "../../build/node_modules/@remix-run/server-runtime";
import { createRequestHandler } from "../../build/node_modules/@remix-run/server-runtime";
import { createRequestHandler as createExpressHandler } from "../../build/node_modules/@remix-run/express";

const TMP_DIR = path.join(process.cwd(), ".tmp", "integration");

interface FixtureInit {
  buildStdio?: Writable;
  sourcemap?: boolean;
  files: { [filename: string]: string };
  template?: "cf-template" | "node-template";
}

export type Fixture = Awaited<ReturnType<typeof createFixture>>;
export type AppFixture = Awaited<ReturnType<typeof createAppFixture>>;

export const js = String.raw;
export const json = String.raw;
export const mdx = String.raw;
export const css = String.raw;

export async function createFixture(init: FixtureInit) {
  let projectDir = await createFixtureProject(init);
  let buildPath = path.resolve(projectDir, "build");
  if (!fse.existsSync(buildPath)) {
    throw new Error(
      chalk.red(
        `Expected build directory to exist at ${chalk.dim(
          buildPath
        )}. The build probably failed. Did you maybe have a syntax error in your test code strings?`
      )
    );
  }
  let app: ServerBuild = await import(buildPath);
  let handler = createRequestHandler(app, "production");

  let requestDocument = async (href: string, init?: RequestInit) => {
    let url = new URL(href, "test://test");
    let request = new Request(url.toString(), init);
    return handler(request);
  };

  let requestData = async (
    href: string,
    routeId: string,
    init?: RequestInit
  ) => {
    let url = new URL(href, "test://test");
    url.searchParams.set("_data", routeId);
    let request = new Request(url.toString(), init);
    return handler(request);
  };

  let postDocument = async (href: string, data: URLSearchParams | FormData) => {
    return requestDocument(href, {
      method: "POST",
      body: data,
      headers: {
        "Content-Type":
          data instanceof URLSearchParams
            ? "application/x-www-form-urlencoded"
            : "multipart/form-data",
      },
    });
  };

  let getBrowserAsset = async (asset: string) => {
    return fse.readFile(
      path.join(projectDir, "public", asset.replace(/^\//, "")),
      "utf8"
    );
  };

  return {
    projectDir,
    build: app,
    requestDocument,
    requestData,
    postDocument,
    getBrowserAsset,
  };
}

export async function createAppFixture(fixture: Fixture) {
  let startAppServer = async (): Promise<{
    port: number;
    stop: () => Promise<void>;
  }> => {
    return new Promise(async (accept) => {
      let port = await getPort();
      let app = express();
      app.use(express.static(path.join(fixture.projectDir, "public")));
      app.all(
        "*",
        createExpressHandler({ build: fixture.build, mode: "production" })
      );

      let server = app.listen(port);

      let stop = (): Promise<void> => {
        return new Promise((res) => {
          server.close(() => res());
        });
      };

      accept({ stop, port });
    });
  };

  let start = async () => {
    let { stop, port } = await startAppServer();

    let serverUrl = `http://localhost:${port}`;

    return {
      serverUrl,
      /**
       * Shuts down the fixture app, **you need to call this
       * at the end of a test** or `afterAll` if the fixture is initialized in a
       * `beforeAll` block. Also make sure to `await app.close()` or else you'll
       * have memory leaks.
       */
      close: async () => {
        return stop();
      },

      /**
       * Visits the href with a document request.
       *
       * @param page The page from the Playwright context
       * @param href The href you want to visit
       * @param waitForHydration Will wait for the network to be idle, so
       * everything should be loaded and ready to go
       */
      goto: async (page: Page, href: string, waitForHydration?: true) => {
        return page.goto(`${serverUrl}${href}`, {
          // waitUntil: waitForHydration ? "networkidle" : undefined,
        });
      },

      /**
       * Finds a link on the page with a matching href, clicks it, and waits for
       * the network to be idle before continuing.
       *
       * @param page The page from the Playwright context
       * @param href The href of the link you want to click
       * @param options `{ wait }` waits for the network to be idle before moving on
       */
      clickLink: async (
        page: Page,
        href: string,
        options: { wait: boolean } = { wait: true }
      ) => {
        let selector = `a[href="${href}"]`;
        let el = await page.$(selector);
        if (!el) {
          throw new Error(`Could not find link for ${selector}`);
        }
        if (options.wait) {
          await doAndWait(page, () => el.click());
        } else {
          await el.click();
        }
      },

      /**
       * Find the input element and fill for file uploads.
       *
       * @param page The page from the Playwright context
       * @param inputSelector The selector of the input you want to fill
       * @param filePaths The paths to the files you want to upload
       */
      uploadFile: async (
        page: Page,
        inputSelector: string,
        ...filePaths: string[]
      ) => {
        let el = await page.$(inputSelector);
        if (!el) {
          throw new Error(`Could not find input for: ${inputSelector}`);
        }
        await el.setInputFiles(filePaths);
      },

      /**
       * Finds the first submit button with `formAction` that matches the
       * `action` supplied, clicks it, and optionally waits for the network to
       * be idle before continuing.
       *
       * @param page The page from the Playwright context
       * @param action The formAction of the button you want to click
       * @param options `{ wait }` waits for the network to be idle before moving on
       */
      clickSubmitButton: async (
        page: Page,
        action: string,
        options: { wait?: boolean; method?: string } = { wait: true }
      ) => {
        let selector: string;
        if (options.method) {
          selector = `button[formAction="${action}"][formMethod="${options.method}"]`;
        } else {
          selector = `button[formAction="${action}"]`;
        }

        let el = await page.$(selector);
        if (!el) {
          if (options.method) {
            selector = `form[action="${action}"] button[type="submit"][formMethod="${options.method}"]`;
          } else {
            selector = `form[action="${action}"] button[type="submit"]`;
          }
          el = await page.$(selector);
          if (!el) {
            throw new Error(`Can't find button for: ${action}`);
          }
        }
        if (options.wait) {
          await doAndWait(page, () => el.click());
        } else {
          await el.click();
        }
      },

      /**
       * Clicks any element and waits for the network to be idle.
       */
      clickElement: async (page: Page, selector: string) => {
        let el = await page.$(selector);
        if (!el) {
          throw new Error(`Can't find element for: ${selector}`);
        }
        await doAndWait(page, () => el.click());
      },

      /**
       * Perform any interaction and wait for the network to be idle:
       *
       * ```js
       * await app.waitForNetworkAfter(page, () => app.page.focus("#el"))
       * ```
       */
      waitForNetworkAfter: async (page: Page, fn: () => Promise<unknown>) => {
        await doAndWait(page, fn);
      },

      /**
       * "Clicks" the back button and optionally waits for the network to be
       * idle (defaults to waiting).
       */
      goBack: async (
        page: Page,
        options: { wait: boolean } = { wait: true }
      ) => {
        if (options.wait) {
          await doAndWait(page, () => page.goBack());
        } else {
          await page.goBack();
        }
      },

      /**
       * Collects data responses from the network, usually after a link click or
       * form submission. This is useful for asserting that specific loaders
       * were called (or not).
       */
      collectDataResponses: (page: Page) => collectDataResponses(page),

      /**
       * Collects all responses from the network, usually after a link click or
       * form submission. A filter can be provided to only collect responses
       * that meet a certain criteria.
       */
      collectResponses: (page: Page, filter?: UrlFilter) =>
        collectResponses(page, filter),

      /**
       * Get HTML from the page. Useful for asserting something rendered that
       * you expected.
       *
       * @param page The page from the Playwright context
       * @param selector CSS Selector for the element's HTML you want
       */
      getHtml: (page: Page, selector?: string) => getHtml(page, selector),

      /**
       * Get a cheerio instance of an element from the page.
       *
       * @param page The page from the Playwright context
       * @param selector CSS Selector for the element's HTML you want
       */
      getElement: async (page: Page, selector: string) => {
        return getElement(await getHtml(page), selector);
      },

      /**
       * Keeps the fixture running for as many seconds as you want so you can go
       * poke around in the browser to see what's up.
       *
       * @param seconds How long you want the app to stay open
       */
      poke: async (seconds: number = 10, href: string = "/") => {
        let ms = seconds * 1000;
        test.setTimeout(ms);
        console.log(`🙈 Poke around for ${seconds} seconds 👉 ${serverUrl}`);
        cp.exec(`open ${serverUrl}${href}`);
        return new Promise((res) => setTimeout(res, ms));
      },
    };
  };

  return start();
}

////////////////////////////////////////////////////////////////////////////////
export async function createFixtureProject(init: FixtureInit): Promise<string> {
  let template = init.template ?? "node-template";
  let integrationTemplateDir = path.join(__dirname, template);
  let projectName = `remix-${template}-${Math.random().toString(32).slice(2)}`;
  let projectDir = path.join(TMP_DIR, projectName);

  await fse.ensureDir(projectDir);
  await fse.copy(integrationTemplateDir, projectDir);
  await fse.copy(
    path.join(__dirname, "../../build/node_modules"),
    path.join(projectDir, "node_modules"),
    { overwrite: true }
  );
  await writeTestFiles(init, projectDir);
  build(projectDir, init.buildStdio, init.sourcemap);

  return projectDir;
}

function build(projectDir: string, buildStdio?: Writable, sourcemap?: boolean) {
  let buildArgs = ["node_modules/@remix-run/dev/cli.js", "build"];
  if (sourcemap) {
    buildArgs.push("--sourcemap");
  }
  let buildSpawn = spawnSync("node", buildArgs, {
    cwd: projectDir,
  });
  if (buildStdio) {
    buildStdio.write(buildSpawn.stdout.toString("utf-8"));
    buildStdio.write(buildSpawn.stderr.toString("utf-8"));
    buildStdio.end();
  }
}

async function writeTestFiles(init: FixtureInit, dir: string) {
  await Promise.all(
    Object.keys(init.files).map(async (filename) => {
      let filePath = path.join(dir, filename);
      await fse.ensureDir(path.dirname(filePath));
      await fse.writeFile(filePath, stripIndent(init.files[filename]));
    })
  );
}

export async function getHtml(page: Page, selector?: string) {
  let html = await page.content();
  return selector ? selectHtml(html, selector) : prettyHtml(html);
}

export function getAttribute(
  source: string,
  selector: string,
  attributeName: string
) {
  let el = getElement(source, selector);
  return el.attr(attributeName);
}

export function getElement(source: string, selector: string) {
  let el = cheerio(selector, source);
  if (!el.length) {
    throw new Error(`No element matches selector "${selector}"`);
  }
  return el;
}

export function selectHtml(source: string, selector: string) {
  let el = getElement(source, selector);
  return prettyHtml(cheerio.html(el)).trim();
}

export function prettyHtml(source: string): string {
  return prettier.format(source, { parser: "html" });
}

async function doAndWait(
  page: Page,
  action: () => Promise<unknown>,
  longPolls = 0
) {
  let networkSettledCallback;
  let networkSettledPromise = new Promise((f) => (networkSettledCallback = f));

  let requestCounter = 0;
  let actionDone = false;
  let pending = new Set<HTTPRequest>();

  let maybeSettle = () => {
    if (actionDone && requestCounter <= longPolls) networkSettledCallback();
  };

  let onRequest = (request: HTTPRequest) => {
    ++requestCounter;
    process.env.DEBUG && pending.add(request);
    process.env.DEBUG && console.log(`+[${requestCounter}]: ${request.url()}`);
  };
  let onRequestDone = (request: HTTPRequest) => {
    // Let the page handle responses asynchronously (via setTimeout(0)).
    //
    // Note: this might be changed to use delay, e.g. setTimeout(f, 100),
    // when the page uses delay itself.
    let evaluate = page.evaluate(() => new Promise((f) => setTimeout(f, 0)));
    evaluate
      .catch((e) => null)
      .then(() => {
        --requestCounter;
        maybeSettle();
        process.env.DEBUG && pending.delete(request);
        process.env.DEBUG &&
          console.log(`-[${requestCounter}]: ${request.url()}`);
      });
  };

  page.on("request", onRequest);
  page.on("requestfinished", onRequestDone);
  page.on("requestfailed", onRequestDone);

  let timeoutId: NodeJS.Timer;
  process.env.DEBUG &&
    (timeoutId = setInterval(() => {
      console.log(`${requestCounter} requests pending:`);
      for (let request of pending) console.log(`  ${request.url()}`);
    }, 5000));

  let result = await action();
  actionDone = true;
  maybeSettle();
  process.env.DEBUG &&
    console.log(`action done, ${requestCounter} requests pending`);
  await networkSettledPromise;
  process.env.DEBUG && console.log(`action done, network settled`);

  page.removeListener("request", onRequest);
  page.removeListener("requestfinished", onRequestDone);
  page.removeListener("requestfailed", onRequestDone);

  process.env.DEBUG && clearTimeout(timeoutId);

  return result;
}

type UrlFilter = (url: URL) => boolean;

export function collectResponses(
  page: Page,
  filter?: UrlFilter
): HTTPResponse[] {
  let responses: HTTPResponse[] = [];

  page.on("response", (res) => {
    if (!filter || filter(new URL(res.url()))) {
      responses.push(res);
    }
  });

  return responses;
}

export function collectDataResponses(page: Page) {
  return collectResponses(page, (url) => url.searchParams.has("_data"));
}
