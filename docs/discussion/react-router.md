---
title: React Router
order: 6
---

# React Router

While Remix works as a multi-page app, when JavaScript is loaded, it uses client side routing for a full Single Page App user experience, with all the speed and network efficiency that comes along with it.

Remix is built on top of [React Router][react-router] and maintained by the same team. This means that you can use all of the features of React Router in your Remix app.

This also means that the 90% of Remix is really just React Router: a very old, very stable library that is perhaps the largest dependency in the React ecosystem. Remix simply adds a server behind it.

## Importing Components and Hooks

Remix Re-exports all of the components and hooks from React Router DOM, so you don't need to install React Router yourself.

🚫 Don't do this:

```tsx bad
import { useLocation } from "react-router-dom";
```

✅ Do this:

```tsx
import { useLocation } from "@remix-run/react";
```

## Extended Behavior

Some of the components and hooks have been extended to work with Remix's server-rendering and data fetching features. For example, `Link` can prefetch data and resources in Remix, where the React Router version cannot.

🚫 Don't do this:

```tsx bad
import { Link } from "react-router-dom";

// this won't do anything
<Link prefetch="intent" />;
```

✅ Do this:

```tsx
import { Link } from "@remix-run/react";

// this will prefetch data and assets
<Link prefetch="intent" />;
```

[react-router]: https://reactrouter.com
