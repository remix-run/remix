import type { Router } from './router.ts';
/**
 * A single result yielded by {@link crawl}, representing one URL that was
 * fetched and the file path it should be written to.
 */
export interface CrawlResult {
    /** The pathname that was fetched (e.g. `/about`, `/assets/styles.css`). */
    pathname: string;
    /**
     * The relative file path where the response should be written
     * (e.g. `/about/index.html`, `/assets/styles.css`). HTML responses are
     * mapped to `index.html` files inside a directory; non-HTML responses
     * keep their original pathname.
     */
    filepath: string;
    /** The `Response` returned by the router for this pathname. */
    response: Response;
}
/** Options for the {@link crawl} function. */
export interface CrawlOptions {
    /** Initial URL paths to put in the crawl queue (defaults to `['/']`). */
    paths?: string[];
    /**
     * Whether to follow navigation-style links found in HTML responses
     * (`<a href>` and `<link rel="alternate" href>`); defaults to `true`.
     * When `false`, only the initial paths are fetched, but assets
     * referenced by those pages (CSS, scripts, images) are still queued.
     */
    spider?: boolean;
    /** Maximum number of concurrent requests (defaults to `1`). */
    concurrency?: number;
}
/**
 * Crawls a router by fetching pages and following links, yielding each result
 * as it is fetched. HTML responses are parsed for additional links and assets
 * to enqueue (disable link-following with `spider: false`); non-HTML responses
 * are yielded as-is with their pathname as the filepath.
 *
 * Throws if any response is non-2xx, which makes `crawl()` well-suited for
 * static-site generation where every reachable page must build successfully.
 *
 * @example
 * import { crawl } from 'remix/fetch-router'
 * import { router } from './router.ts'
 *
 * for await (let { pathname, filepath, response } of crawl(router)) {
 *   await writeResponse(filepath, response)
 *   console.log(`Crawled ${pathname} -> ${filepath}`)
 * }
 *
 * @param router A router created with {@link createRouter}.
 * @param options Optional crawl configuration.
 * @returns An async iterable of {@link CrawlResult} values, yielding each page as it is fetched.
 */
export declare function crawl(router: Router, options?: CrawlOptions): AsyncIterableIterator<CrawlResult>;
//# sourceMappingURL=crawl.d.ts.map