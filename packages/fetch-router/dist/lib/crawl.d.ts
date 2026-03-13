import type { Router } from './router.ts';
/** The result of crawling a single URL. */
export interface CrawlResult {
    /** The pathname that was crawled (e.g. `/about`, `/assets/styles.css`). */
    pathname: string;
    /** The relative file path where the response should be written (e.g. `/about/index.html`, `/assets/styles.css`). */
    filepath: string;
    /** The response from the router for this pathname. */
    response: Response;
}
/** Options for the {@link crawl} function. */
export interface CrawlOptions {
    /**
     * Initial URL paths to put in the crawl queue (defaults to `['/']`)
     */
    paths?: string[];
    /**
     * Whether to crawl links found in HTML documents (default `true`)
     */
    spider?: boolean;
    /**
     * Maximum number of concurrent requests (default 1)
     */
    concurrency?: number;
}
/**
 * Crawls a router by fetching pages and following links, yielding each result
 * as it is fetched. HTML responses are parsed for additional links and assets
 * to enqueue (disable via `spider:false`). Non-HTML responses are yielded as-is
 * with their pathname as the filepath.
 *
 * @example
 * import { crawl, createRouter } from 'remix/fetch-router'
 *
 * let router = createRouter()
 * router.get('/', homeHandler)
 * router.get('/about', aboutHandler)
 *
 * for await (let { pathname, filepath, response } of crawl(router)) {
 *   await writeResponse(filepath, response);
 *   console.log(`Crawled ${pathname} -> ${filepath}`);
 * }
 *
 * @param router A `remix/fetch-router` created with {@link createRouter}.
 * @param options Optional crawl configuration.
 * @returns An async iterable of crawl results, yielding each page as it is fetched.
 */
export declare function crawl(router: Router, options?: CrawlOptions): AsyncIterableIterator<CrawlResult>;
//# sourceMappingURL=crawl.d.ts.map