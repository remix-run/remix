Load a named frame in place with `data-rmx-history="none"`, or `history: 'none'` in `navigate()` and `link()`. A link or form with a `data-rmx-target` loads its destination into that frame without changing the URL or history, resetting scroll or focus, or reloading the rest of the page. The frame still dispatches `reloadStart` and `reloadComplete`, and forms dispatch `rmx:form-submit-start`, so pending and optimistic UI work the same way. The frame's `src` follows a redirect, so its next reload fetches what it shows. Navigations without a target ignore `none`, and unmatched targets still fall back to document navigation.

```tsx
<form method="post" action="/cart/update" data-rmx-target="cart" data-rmx-history="none">
  <input type="hidden" name="bookId" value={bookId} />
  <button type="submit">Remove</button>
</form>
```
