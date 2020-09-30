import type { Page, Request, Response } from "puppeteer";
import prettier from "prettier";

export function prettyHtml(source: string): string {
  return prettier.format(source, { parser: "html" });
}

export function reactIsHydrated(page: Page) {
  return page.waitForFunction("window.reactIsHydrated === true");
}

export function collectRequests(page: Page): Request[] {
  let requests: Request[] = [];

  page.on("request", req => {
    requests.push(req);
  });

  return requests;
}

export function collectResponses(page: Page): Response[] {
  let responses: Response[] = [];

  page.on("response", res => {
    responses.push(res);
  });

  return responses;
}
