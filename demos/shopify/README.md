# Shopify demo

A Remix 3 marketing site based on [Shopify’s English website](https://www.shopify.com/). It includes the homepage, 31 main-navigation pages (including pricing), and a sitemap. The demo shows how one Remix router can serve a site and render it to static files.

The homepage and Agentic Storefronts page use Shopify’s original videos and images, served from Shopify’s CDN. Agentic Storefronts has its own layout and content; pricing has US plan details reviewed in October 2026, comparison sections, and FAQs. Other product pages use edited copy and shared layouts. This is a delivery prototype, not a content-complete clone. The [performance report](https://github.com/remix-run/remix/blob/main/demos/shopify/PERFORMANCE.md) compares three pages with live Shopify after adding the original media.

## Run

From the repository root:

```sh
pnpm install
pnpm -C demos/shopify dev
```

Open [http://localhost:44100](http://localhost:44100). The development command restarts the server when source files change; refresh the browser to see updates. Use `pnpm -C demos/shopify start` to run without watching files. Set `PORT` to use another port.

## Render the static site

```sh
pnpm -C demos/shopify prerender
pnpm -C demos/shopify preview
```

The prerender script calls `router.fetch(new Request(...))` for every page. It consumes each full HTML response and writes 33 pages to `demos/shopify/dist/`, plus a `404.html` file. Nested routes use directory indexes, such as `dist/website/builder/index.html`.

The script copies the root `public/` files, fetches every stylesheet, script, font, image, and caption file the pages reference from the asset server (minified, with content-fingerprinted URLs), writes a Cloudflare `_headers` file that keeps those assets' `Content-Type` and long-lived `Cache-Control`, checks local page links, fragments, and asset references, and replaces the previous output only after rendering and validation succeed. Each successful run removes stale files from the previous export. Prerendering needs no running server, browser, or network connection. Run one export per output directory at a time.

The preview serves the exported files and negotiates the homepage format on [http://localhost:44100](http://localhost:44100). You can also deploy `dist/` to a static host that supports directory index files. Configure the host to use `404.html` for missing pages. A plain static host also needs request handling for the Markdown homepage negotiation described below. The site uses root-relative links, so serve it at the root of a domain.

Navigation, merchant panels, billing controls, carousels, and FAQ disclosures use native HTML and CSS. Every page loads the Remix component runtime (about 44 KB compressed). On the homepage and Agentic Storefronts, the `AutoplayVideo` and `PauseAnimationsButton` client entries hydrate to start visible videos once the page has loaded, pause offscreen videos and hidden tabs, and honor reduced motion. The pause button controls decorative motion. The site has no Frames or client navigation, so the browser entry uses native `import()` without the multiple-import-maps polyfill. Without JavaScript, posters and native testimonial controls remain available. Below-fold videos use native `loading="lazy"` for their posters; older browsers may load those posters sooner. Videos stream from Shopify’s CDN; images, posters, captions, and fonts are served locally.

## Agent access

The static export includes original snapshots of [llms.txt](https://www.shopify.com/llms.txt), [llms-full.txt](https://www.shopify.com/llms-full.txt), and [agents.md](https://www.shopify.com/agents.md), fetched in October 2026. Their content and official absolute destination URLs are unchanged. `agent-assets.json` records the source URLs, hashes, sizes, and capture time. The guides point to real Shopify services, including pages outside this demo.

A homepage request that prefers `text/markdown` over HTML receives the checked-in `agents.md` guide as `text/markdown; charset=utf-8`. Browser requests, bare wildcard Accept headers, and equal preferences receive HTML. Both representations include `Vary: Accept`; HEAD and conditional requests work for the selected file. This selection uses the Accept header, without user-agent detection.

```sh
curl http://localhost:44100/llms.txt
curl http://localhost:44100/llms-full.txt
curl http://localhost:44100/agents.md
curl -H 'Accept: text/markdown' http://localhost:44100/
```

Development, static preview, and Workers use the same negotiation function. Export copies the three discovery files without fetching or rendering them. Shopify’s live homepage returned HTML to the Markdown-only requests tested during this update, so the demo’s negotiated homepage is an explicit reuse of the original agent guide; it is not a captured Markdown homepage response. Other page URLs keep their HTML representations.

## Cloudflare Workers

The demo deploys the prerendered site with [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/). Cloudflare serves the prerendered HTML, discovery files, CSS, script, logo, font, and captions. Images and videos load from Shopify’s CDN. A small Worker handler runs first only for `/` to select HTML or the static Markdown guide from the `ASSETS` binding. Other assets bypass that handler. Remix renders pages during prerendering; the Worker does no server rendering and needs no asset library.

Preview it in Cloudflare’s local runtime:

```sh
pnpm -C demos/shopify dev:worker
```

Open [http://localhost:44100](http://localhost:44100). To use another port, run `pnpm -C demos/shopify dev:worker --port 44103`.

Check the deployment without publishing:

```sh
pnpm -C demos/shopify deploy:check
```

Deploy to your Cloudflare account:

```sh
pnpm -C demos/shopify exec wrangler login
pnpm -C demos/shopify deploy
```

The three commands run `pnpm prerender` before starting Wrangler. During the Worker preview, run `pnpm -C demos/shopify prerender` again to update the exported files. Use `pnpm -C demos/shopify dev` for source watching while editing. Keeping exports out of Wrangler’s file watcher avoids overlapping rebuilds.

The configuration serves nested directory indexes at URLs without a trailing slash and returns `404.html` with a 404 status for missing pages.

The Worker name is `remix-shopify-demo`; change `name` in `wrangler.jsonc` to use another name. For CI, set `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` instead of logging in. Run the deploy command from this pnpm workspace so it can resolve the local `remix` dependency.

## Code

- `app/routes.ts` defines every page URL, including the 29 marketing pages under `routes.marketing`.
- `app/data/pages.ts` summarizes each page for navigation cards, related links, and the sitemap, and lists the pages for the static export.
- `app/data/navigation.ts` owns the navigation and service links.
- `app/actions/controller.tsx` renders home, Agentic Storefronts, pricing, and the sitemap. The `home` action returns `agents.md` to requests that prefer Markdown.
- `app/actions/marketing/controller.tsx` renders each marketing page's content through the shared `product-template.tsx`.
- `app/actions/agentic-page.tsx` and `app/actions/pricing-page.tsx` own their distinct page layouts.
- `app/actions/not-found.tsx` renders the 404 page for URLs that match no route.
- `app/ui/document.tsx` provides the document, shared navigation, footer, and closing section.
- `app/data/videos.ts` maps each video file to its original URL on Shopify’s CDN.
- `app/data/images.ts` lists Shopify’s original images with their dimensions and builds responsive CDN sources for native `<img>` elements and video posters.
- `app/router.ts` installs `staticFiles()`, the trailing-slash redirect in `app/middleware/trailing-slash.ts`, and `render()`, and maps the controllers. The router answers HEAD and unsupported methods.
- `scripts/render-site.ts` writes and checks the static export.
- `app/assets.ts` configures the `remix/assets` server from `remix.json` and resolves the URLs of the stylesheets, script, font, logo, posters, and captions. Browser files live in `app/ui/public/` and `app/actions/public/`; the root `public/` directory keeps only files with fixed URLs, such as the favicon and the agent guides.
- `app/actions/public/entry.ts` starts the Remix component runtime, which hydrates the client entries.
- `app/ui/public/autoplay-video.tsx` and `app/ui/public/pause-animations-button.tsx` are the client entries for video playback; `app/ui/public/motion.ts` holds the page-wide pause, visibility, and reduced-motion state they share.
- `scripts/preview.ts` serves the output with `staticFiles()` and applies the exported `_headers` rules, as Cloudflare does.
- `app/utils/agent-response.ts` decides whether a request prefers Markdown, and negotiates the homepage for the static preview and Worker.
- `worker.ts` applies that negotiation to the Cloudflare `ASSETS` binding.
- `wrangler.jsonc` configures static assets and homepage Worker routing for Cloudflare.

To add a shared marketing page, add its route to `routes.marketing`, its summary to `app/data/pages.ts`, and its action to `app/actions/marketing/controller.tsx`. Link to it in the navigation; the sitemap and exporter read the page summaries and include it automatically. Pages with distinct layouts have their own routes and actions.

## Check

```sh
pnpm -C demos/shopify test
pnpm -C demos/shopify typecheck
pnpm -C demos/shopify prerender
```

Tests cover the discovery files, Markdown/HTML selection, Accept weights, HEAD and conditional requests, navigation coverage, complete HTML documents, missing pages, public files, nested output, stale file cleanup, broken links and media, and preserving the last good export when a page fails. Run `pnpm -C demos/shopify deploy:check` to check the Workers package without publishing.

## Reference assets

The page structure and assets were reviewed against [Shopify.com](https://www.shopify.com/) in October 2026. Images and videos link Shopify’s original files on its CDN instead of copies in the repository. `app/data/images.ts` records each image’s CDN URL and the largest size the demo displays. Shopify’s CDN resizes an image to the requested `width` and returns WebP to browsers that accept it, so each image gets 400px, 800px, and full-width sources without a build step. To add an image, add its CDN URL with that width and height.

A few files stay local. The favicon and touch icon are copied from shopify.com. The Shopify logo, the Shopify font, and the homepage and Agentic Storefronts hero posters are part of the first paint, so they load from the demo’s own origin instead of sharing the CDN connection with the rest of the page’s media. The testimonial captions are converted from Shopify’s SRT file to WebVTT, which `<track>` requires, with their text and timing preserved. `assets.json` records the source URL of each. Shopify’s names and assets belong to their owners. The document includes `noindex, nofollow` metadata to keep the demo out of search results.
