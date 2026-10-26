`context.render(node, { nonce })` now applies a per-response CSP nonce to generated import maps, module preloads, and CSS mixin styles. The middleware carries that nonce through internal frame requests and redirects, including nested blocking frames, so their styles can apply before hydration (see #11926).

```tsx
router.get('/', (context) => {
  let nonce = crypto.getRandomValues(new Uint8Array(16)).toBase64()
  return context.render(<App />, {
    nonce,
    headers: {
      'Content-Security-Policy': `script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'`,
    },
  })
})
```

Internal frame renders use the enclosing nonce even if a child handler supplies a different value. Independently requested frames use their own render options. The exported `RenderResponseInit` type extends `ResponseInit` with `nonce`, preserving existing status and header options.
