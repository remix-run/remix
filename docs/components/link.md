---
title: Link
---

# `<Link>`

This component renders an anchor tag and is the primary way the user will navigate around your website. Anywhere you would have used `<a href="...">` you should now use `<Link to="..."/>` to get all the performance benefits of client-side routing in Remix.

It wraps React Router's Link with some extra behavior around resource prefetching.

```tsx
import { Link } from "@remix-run/react";

export default function GlobalNav() {
  return (
    <nav>
      <Link to="/dashboard">Dashboard</Link>{" "}
      <Link to="/account">Account</Link>{" "}
      <Link to="/support">Support</Link>
    </nav>
  );
}
```

In our effort to remove all loading states from your UI, `Link` can automatically prefetch all the resources the next page needs: JavaScript modules, stylesheets, and data. This prop controls if and when that happens.

```tsx
<>
  <Link /> {/* defaults to "none" */}
  <Link prefetch="none" />
  <Link prefetch="intent" />
  <Link prefetch="render" />
</>
```

- **"none"** - Default behavior. This will prevent any prefetching from happening. This is recommended when linking to pages that require a user session that the browser won't be able to prefetch anyway.
- **"intent"** - Recommended if you want to prefetch. Fetches when Remix thinks the user intends to visit the link. Right now the behavior is simple: if they hover or focus the link it will prefetch the resources. In the future we hope to make this even smarter. Links with large click areas/padding get a bit of a head start. It is worth noting that when using `prefetch="intent"`, `<link rel="prefetch">` elements will be inserted on hover/focus and removed if the `<Link>` loses hover/focus. Without proper `cache-control` headers on your loaders this could result in repeated prefetch loads if a user continually hovers on and off a link.
- **"render"** - Fetches when the link is rendered.

<docs-error>You may need to use the <code>:last-of-type</code> selector instead of <code>:last-child</code> when styling child elements inside of your links</docs-error>

Remix uses the browser's cache for prefetching with HTML `<link rel="prefetch"/>` tags, which provides a lot of subtle benefits (like respecting HTTP cache headers, doing the work in browser idle time, using a different thread than your app, etc.) but the implementation might mess with your CSS since the link tags are rendered inside of your anchor tag. This means `a *:last-child {}` style selectors won't work. You'll need to change them to `a *:last-of-type {}` and you should be good. We will eventually get rid of this limitation.
