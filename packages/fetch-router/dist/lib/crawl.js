import { parse } from "./html-parser.js";
const BASE_URL = 'http://localhost';
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
export async function* crawl(router, options = {}) {
    let { paths = ['/'], spider = true, concurrency = 1 } = options;
    // Array queue (vs Set) so concurrent fetches can push discovered paths to the
    // tail while the dispatch loop reads from the head
    let queue = [];
    let visited = new Set();
    let results = [];
    let active = 0;
    let error;
    // Resettable gate — lets the generator sleep until a fetch completes
    let notify = () => { };
    let gate = new Promise((r) => (notify = r));
    function bump() {
        let n = notify;
        gate = new Promise((r) => (notify = r));
        n();
    }
    enqueue(paths);
    while (true) {
        // Dispatch up to concurrency limit
        while (active < concurrency && queue.length > 0) {
            fetchOne(queue.shift());
        }
        if (error)
            throw error;
        if (results.length > 0) {
            yield results.shift();
            continue;
        }
        if (active === 0 && queue.length === 0)
            break;
        await gate;
    }
    function enqueue(pathnames) {
        pathnames.forEach((p) => {
            if (!visited.has(p)) {
                visited.add(p);
                queue.push(p);
            }
        });
    }
    async function fetchOne(pathname) {
        active++;
        try {
            let response = await router.fetch(new Request(`${BASE_URL}${pathname}`));
            if (!response.ok) {
                throw new Error(`Crawl failed: ${response.status} ${response.statusText} (${pathname})`);
            }
            let isHtml = response.headers.get('Content-Type')?.includes('text/html');
            if (isHtml) {
                let cloned = response.clone();
                results.push({
                    pathname,
                    // / -> /index.html, /about -> /about/index.html, /about/ -> /about/index.html
                    // Always put `index.html` files into directories - this leads to the best
                    // support with and without trailing slashes on github pages:
                    // https://github.com/slorber/trailing-slash-guide?tab=readme-ov-file#summary
                    filepath: pathname.replace(/\/?$/, '/index.html'),
                    response,
                });
                let elements = parse(await cloned.text());
                // Always queue referenced assets (CSS, JS, images)
                enqueue(extractAssetPaths(elements, pathname));
                // Only follow navigation links when spider mode is enabled
                if (spider) {
                    enqueue(extractLinkPaths(elements, pathname));
                }
            }
            else {
                results.push({ pathname, filepath: pathname, response });
            }
        }
        catch (e) {
            error = e;
        }
        finally {
            active--;
            bump();
        }
    }
}
function extractAssetPaths(elements, baseUrl) {
    let linkAttrs = elements
        .filter((el) => el.name === 'link' &&
        !rel(el).includes('preload') &&
        !rel(el).includes('prefetch') &&
        !rel(el).includes('modulepreload'))
        .map((el) => el.getAttribute('href'));
    let srcAttrs = elements
        .filter((el) => (el.name === 'script' || el.name === 'img') && el.getAttribute('src'))
        .map((el) => el.getAttribute('src'));
    return [...linkAttrs, ...srcAttrs]
        .filter((href) => href != null)
        .filter((href) => !isNonNavigable(href))
        .filter(isRelativeUrl)
        .map((href) => resolveHref(href, baseUrl))
        .filter((href) => href != null);
}
function extractLinkPaths(elements, baseUrl) {
    return elements
        .filter((el) => el.name === 'a' && !rel(el).includes('nofollow'))
        .map((el) => el.getAttribute('href'))
        .filter((href) => href != null)
        .filter((href) => !isNonNavigable(href))
        .filter(isRelativeUrl)
        .map((href) => resolveHref(href, baseUrl))
        .filter((href) => href != null);
}
function rel(el) {
    return el.getAttribute('rel')?.split(/\s+/) || [];
}
function isNonNavigable(href) {
    return (href.startsWith('#') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:') ||
        href.startsWith('javascript:') ||
        href.startsWith('data:'));
}
function isRelativeUrl(href) {
    return !href.startsWith('http://') && !href.startsWith('https://') && !href.startsWith('//');
}
function resolveHref(href, baseUrl) {
    // Absolute URL — extract pathname
    if (/^https?:\/\//.test(href) || href.startsWith('//')) {
        try {
            return new URL(href).pathname;
        }
        catch {
            return null;
        }
    }
    // Relative URL — resolve against the current page's path
    try {
        return new URL(href, `${BASE_URL}${baseUrl}`).pathname;
    }
    catch {
        return null;
    }
}
