# Performance brief: Remix 3 demo vs. shopify.com

Measured October 14, 2026, with the demo deployed to Cloudflare Workers. This compares an **incomplete demo** with the production site. The demo has the homepage, Agentic Storefronts, pricing, and shared product pages, with Shopify's original video and images. It does not have analytics, consent, experiments, personalization, a CMS, or full content parity. The results are lab measurements, not field data, so treat them as a direction to test rather than a forecast.

## Bottom line

- **The demo passes every lab Core Web Vitals threshold on every page tested. In this sample, live shopify.com misses the mobile LCP threshold on all three pages.** Median mobile LCP is 1.2–1.6s for the demo and 4.7–8.5s for the live site, against a 2.5s threshold.
- **The difference is JavaScript, not hosting or media.** Both sites are served from a global CDN and respond in about 55–100ms. Both load the same images and video from Shopify's CDN. Live pages load 0.9–1.4 MB of script and make 150–230 requests. The demo loads at most 1 KB of script and makes 5–19 requests.
- **Interactions are fast on both sites, and 2–4× faster on the demo.** Menus, billing toggles, and FAQs respond in 16–24ms on the demo and 32–104ms live. Both are well inside the 200ms "good" threshold.
- **Part of the live site's script is business functionality the demo doesn't have yet.** That includes measurement, consent, experiments, and attribution. The open question is how much of the gap is left once those requirements come back.

## Core Web Vitals (lab)

Median of five cold-cache Lighthouse runs per row, except the homepage and Agentic Storefronts on mobile, which use fifteen. Good thresholds are LCP ≤ 2.5s, CLS ≤ 0.1, and INP ≤ 200ms.

### Mobile

| Page                | LCP demo | LCP live | CLS demo | CLS live | INP demo | INP live | TBT demo | TBT live |
| ------------------- | -------: | -------: | -------: | -------: | -------: | -------: | -------: | -------: |
| Homepage            |    1.57s |    4.71s |    0.000 |    0.024 |     24ms |    104ms |      7ms |    373ms |
| Agentic Storefronts |    1.32s |    8.52s |    0.000 |    0.000 |        — |        — |      0ms |    367ms |
| Pricing             |    1.24s |    5.18s |    0.000 |    0.000 |     16ms |     32ms |      0ms |    316ms |

### Desktop

| Page                | LCP demo | LCP live | CLS demo | CLS live | INP demo | INP live | TBT demo | TBT live |
| ------------------- | -------: | -------: | -------: | -------: | -------: | -------: | -------: | -------: |
| Homepage            |    0.38s |    0.85s |    0.000 |    0.003 |     24ms |     72ms |      0ms |      9ms |
| Agentic Storefronts |    0.40s |    1.02s |    0.000 |    0.037 |        — |        — |      0ms |      8ms |
| Pricing             |    0.34s |    1.54s |    0.000 |    0.005 |     16ms |     40ms |      0ms |      7ms |

INP comes from scripted interactions that exist on both sites:

- **Homepage:** opening the mobile menu, or the Products menu on desktop.
- **Pricing:** switching to monthly billing, then opening an FAQ.
- **During load:** a mobile menu tap before the page finished loading measured 24ms on the demo and 32ms live. Live Shopify's mobile menu is also CSS-driven, so it works before hydration.
- **Agentic Storefronts:** not exercised.

The live site is much less consistent. Mobile LCP ranged 2.76–5.37s on the homepage, 6.90–16.06s on Agentic Storefronts, and 5.04–5.20s on pricing. The demo stayed within 0.1s on Agentic Storefronts and pricing.

The demo has one outlier to investigate. On the mobile homepage, 11 of 15 runs measured 1.53–1.59s and 4 measured 4.2–4.4s. The LCP element is the same hero poster in every run, and it is served from the demo's own origin. Spot checks of 18 more runs reproduced it once. Even the slow runs are faster than the live homepage's median.

## What drives the gap

Medians per mobile page load. Desktop script weight is the same on the live site.

| Page                | Transfer demo | Transfer live | Requests demo | Requests live | Script demo | Script live | Video demo | Video live |
| ------------------- | ------------: | ------------: | ------------: | ------------: | ----------: | ----------: | ---------: | ---------: |
| Homepage            |       698 KiB |      2446 KiB |            19 |           151 |       1 KiB |    1147 KiB |    302 KiB |    302 KiB |
| Agentic Storefronts |       574 KiB |      2461 KiB |            19 |           230 |       1 KiB |    1447 KiB |    228 KiB |    257 KiB |
| Pricing             |        74 KiB |      1591 KiB |             5 |           153 |       0 KiB |     931 KiB |          0 |          0 |

- **Script:** the demo renders every page to HTML ahead of time and has no client router or hydration bundle. Menus use the Popover API. Merchant tabs, billing, and carousels use radio inputs and CSS. FAQs use `<details>`. The only script is a 1 KB (compressed) file that plays and pauses video, and only the homepage and Agentic Storefronts load it.
- **Main-thread time:** live pages block the main thread for about 320–370ms on a throttled mobile CPU. That is the main reason live FCP and LCP slip, and why its LCP varies so much between runs.
- **Hosting:** server response is not the difference. The demo's median time to first byte was 54–65ms from Cloudflare, and the live site's was 90–97ms.
- **Media:** both sites load the same images and video files from Shopify's CDN. The demo serves only its logo, font, and two hero posters itself, so the largest paint doesn't wait behind other media on the CDN connection. It also starts video after the page loads.

## Trade-offs

| The demo gives up                                                                                                       | What it would cost to restore                                                                                                                                  |
| ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Analytics, consent, experiments, attribution                                                                            | Each tag adds script and requests. This is where much of the live site's weight is likely to return. Load them after LCP and measure each one.                 |
| Request-time rendering. Pages are built ahead of time, so a content change means a rebuild and deploy of a few seconds. | Geo pricing, personalization, and logged-in states need edge logic in the Worker or a server-rendered route. Remix can render the same routes at request time. |
| Custom motion, such as live card flips and timed carousels                                                              | Can be added as small scripts for specific pieces of the page, not as a site-wide app bundle.                                                                  |
| Full content and locales                                                                                                | Content volume doesn't affect the per-page cost of a static page. Locales multiply build output, not runtime cost.                                             |

## Limits of this comparison

- **Lab only.** There is no field data for the demo. Shopify.com's CrUX field data was not retrieved for this brief: the PageSpeed Insights API was over quota. Field data is the number that matters.
- **One location.** All runs came from one machine in California, against each site's nearest CDN edge.
- **Different features, not a framework benchmark.** These numbers show what a static-first Remix architecture enables. They do not show what Remix would do with the live site's full set of requirements.

## Recommended next steps

1. Add Shopify's required measurement and consent tags to one page and measure what they cost.
2. Find the cause of the intermittent mobile homepage outlier.
3. Run a controlled field test of one page family. Compare p75 LCP, INP, and CLS from CrUX or RUM, plus signup conversion.

## Method

- **Lighthouse runs:** Lighthouse 13.5.0 and Chrome for Testing 148 (headless shell) on an Apple M5 Pro.
  - 100 runs: 3 pages × 2 profiles × 2 sites × 5 cold-cache repeats, alternating demo and live for each page, plus 10 more pairs each for the homepage and Agentic Storefronts on mobile.
  - Mobile uses Lighthouse's default simulated throttling: 150ms RTT, 1.6 Mbps, 4× CPU slowdown. Desktop uses the desktop preset.
- **INP:** measured with the `web-vitals` 4 attribution build in Playwright Chromium, with 4× CPU throttling.
  - Five loads per scenario. Interactions run 3s after load unless marked "during load".
- **Targets:** the demo is the static export (`pnpm prerender`) deployed to Cloudflare Workers with `wrangler deploy`, on a `workers.dev` URL. The live site is `https://www.shopify.com` at the matching paths.

Per-run values are in [performance-results.json](https://github.com/remix-run/remix/blob/main/demos/shopify/performance-results.json).
