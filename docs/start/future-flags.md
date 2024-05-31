---
title: Future Flags
order: 5
---

# Future Flags

The following future flags are stable and ready to adopt. To read more about future flags see [Development Strategy][development-strategy]

## Update to latest v2.x

First update to the latest minor version of v2.x to have the latest future flags.

👉 **Update to latest v2**

```shellscript nonumber
npm install @remix-run/{dev,react,node,etc.}@2
```

## v3_fetcherPersist

**Background**

The fetcher lifecycle is now based on when it returns to an idle state rather than when its owner component unmounts: [View the RFC][fetcherpersist-rfc] for more information.

👉 **Enable the Flag**

```ts
remix({
  future: {
    v3_fetcherPersist: true,
  },
});
```

**Update your Code**

It's unlikely to affect your app. You may want to check any usage of `useFetchers` as they may persist longer than they did before. Depending on what you're doing, you may render something longer than before.

## v3_relativeSplatPath

**Background**

Changes the relative path matching and linking for multi-segment splats paths like `dashboard/*` (vs. just `*`). [View the CHANGELOG][relativesplatpath-changelog] for more information.

👉 **Enable the Flag**

```ts
remix({
  future: {
    v3_relativeSplatPath: true,
  },
});
```

**Update your Code**

If you have any routes with a path + a splat like `dashboard.$.tsx` or `route("dashboard/*")` that have relative links like `<Link to="relative">` or `<Link to="../relative">` beneath it, you will need to update your code.

👉 **Split the route into two**

For any splat routes split it into a layout route and a child route with the splat:

```diff

└── routes
    ├── _index.tsx
+   ├── dashboard.tsx
    └── dashboard.$.tsx

// or
routes(defineRoutes) {
  return defineRoutes((route) => {
    route("/", "home/route.tsx", { index: true });
-    route("dashboard/*", "dashboard/route.tsx")
+    route("dashboard", "dashboard/layout.tsx", () => {
+      route("*", "dashboard/route.tsx");
    });
  });
},
```

👉 **Update relative links**

Update any `<Link>` elements with relative links within that route tree to include the extra `..` relative segment to continue linking to the same place:

```diff
// dashboard.$.tsx or dashboard/route.tsx
function Dashboard() {
  return (
    <div>
      <h2>Dashboard</h2>
      <nav>
-        <Link to="">Dashboard Home</Link>
-        <Link to="team">Team</Link>
-        <Link to="projects">Projects</Link>
+        <Link to="../">Dashboard Home</Link>
+        <Link to="../team">Team</Link>
+        <Link to="../projects">Projects</Link>
      </nav>
    </div>
  );
}
```

## v3_throwAbortReason

**Background**

When a server-side request is aborted, such as when a user navigates away from a page before the loader finishes, Remix will throw the `request.signal.reason` instead of an error such as `new Error("query() call aborted...")`.

👉 **Enable the Flag**

```ts
remix({
  future: {
    v3_throwAbortReason: true,
  },
});
```

**Update your Code**

You likely won't need to adjust any code, unless you had custom logic inside of `handleError` that was matching the previous error message to differentiate it from other errors.

[development-strategy]: ../guides/api-development-strategy
[fetcherpersist-rfc]: https://github.com/remix-run/remix/discussions/7698
[use-fetchers]: ../hooks/use-fetchers
[use-fetcher]: ../hooks/use-fetcher
[relativesplatpath-changelog]: https://github.com/remix-run/remix/blob/main/CHANGELOG.md#futurev3_relativesplatpath
[single-fetch]: ../guides/single-fetch
