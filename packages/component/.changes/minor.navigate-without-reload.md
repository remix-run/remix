Update the browser URL without reloading frames by passing `reload: false` to `navigate()`. The URL and history entry change without fetching or rendering, and scroll position and focus stay where they are. This suits state the page already shows, such as a selected product variant (see #12003):

```ts
await navigate(`/products/shirt?variant=${variantId}`, { history: 'replace', reload: false })
```

Unlike calling `history.replaceState()` directly, the new entry keeps Remix's navigation state, so back and forward traversal still renders it. If the update interrupts an unfinished frame navigation, Remix reloads the top frame instead so the content matches the URL. To update the URL from a component rendered by a navigation, await `navigation.settled()` first so the update doesn't interrupt that navigation. Without frame navigation, `history: 'replace'` updates replace the URL in place, and pushed updates fall back to document navigation.
