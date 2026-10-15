Update the browser URL without reloading frames by passing `reload: false` to `navigate()`. The URL and history entry change without fetching or rendering, and scroll position and focus stay where they are. This suits state the page already shows, such as a selected product variant:

```ts
await navigate(`/products/shirt?variant=${variantId}`, { history: 'replace', reload: false })
```

Remix keeps its navigation state on the new entry, so back and forward traversal reloads the top frame from that URL like any other entry. Calling `history.replaceState()` directly drops that state. If the update interrupts an unfinished frame navigation, Remix reloads the top frame instead so the content matches the URL. Browsers without frame navigation fall back to `history.replaceState()` or `history.pushState()`.
