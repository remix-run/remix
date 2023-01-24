---
"@remix-run/dev": patch
---

- Fix route ranking bug with pathless layout route next to a sibling index route
  - Under the hood this is done by removing the trailing slash from all generated `path` values since the number of slash-delimited segments counts towards route ranking so the trailing slash incorrectly increases the score for routes

- Support sibling pathless layout routes by removing pathless layout routes from the unique route path checks in conventional route generation since they inherently trigger duplicate paths