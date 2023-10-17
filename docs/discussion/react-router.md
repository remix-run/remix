---
title: React Router
order: 6
---

# React Router

While Remix works as a multipage app, when JavaScript is loaded, it uses client side routing for a full Single Page App user experience, with all the speed and network efficiency that comes along with it.

Remix is built on top of [React Router][react_router] and maintained by the same team. This means that you can use all the features of React Router in your Remix app.

This also means that the 90% of Remix is really just React Router: a very old, very stable library that is perhaps the largest dependency in the React ecosystem. Remix simply adds a server behind it.

## Importing Components and Hooks

Remix re-exports all the components and hooks from React Router DOM, so you don't need to install React Router yourself.

🚫 Don't do this:

```tsx bad
import { useLocation } from "react-router-dom";
```

✅ Do this:

```tsx good
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

```tsx good
import { Link } from "@remix-run/react";

// this will prefetch data and assets
<Link prefetch="intent" />;
```

[react_router]: https://reactrouter.com
