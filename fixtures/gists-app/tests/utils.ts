import type { Page, Request, Response } from "puppeteer";
import prettier from "prettier";

export function prettyHtml(source: string): string {
  return prettier.format(source, { parser: "html" });
}

export function reactIsHydrated(page: Page) {
  return page.waitForFunction("window.reactIsHydrated === true");
}

export function collectRequests(
  page: Page,
  filter?: (url: URL) => boolean
): Request[] {
  let requests: Request[] = [];

  page.on("request", req => {
    if (filter && filter(new URL(req.url()))) {
      requests.push(req);
    }
  });

  return requests;
}

export function collectResponses(
  page: Page,
  filter?: (url: URL) => boolean
): Response[] {
  let responses: Response[] = [];

  page.on("response", res => {
    if (filter && filter(new URL(res.url()))) {
      responses.push(res);
    }
  });

  return responses;
}
