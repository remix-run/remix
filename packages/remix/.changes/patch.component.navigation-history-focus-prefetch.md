Navigation, focus, and prefetching fixes in `remix/component`:

- A link click, form submission, or `navigate()` call that interrupts a navigation before its page renders now replaces that navigation's history entry, so Back returns to the page the visitor saw. Links and GET forms with `data-rmx-history="replace"` also replace the entry before their navigation commits in browsers that support it.
- Focus stays where it was when a frame navigation fails, such as a form submission whose response is a 5xx page. Previously focus moved to `<body>`.
- Viewport prefetching waits 150ms after scrolling stops, pauses while the document is hidden, and parses downloaded HTML during idle time. Links that are visible without a scroll, such as on page load, still prefetch right away.

See the [`@remix-run/component` changelog](https://github.com/remix-run/remix/blob/main/packages/component/CHANGELOG.md) for details.
