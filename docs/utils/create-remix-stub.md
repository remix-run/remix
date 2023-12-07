---
title: createRemixStub
---

# `createRemixStub`

This utility allows you to unit-test your own components that rely on Remix hooks/components by setting up a mocked set of routes:

```tsx
import { createRemixStub } from "@remix-run/testing";

test("renders loader data", async () => {
  const RemixStub = createRemixStub([
    {
      path: "/",
      meta() {
        /* ... */
      },
      links() {
        /* ... */
      },
      Component: MyComponent,
      ErrorBoundary: MyErrorBoundary,
      action() {
        /* ... */
      },
      loader() {
        /* ... */
      },
    },
  ]);

  render(<RemixStub />);

  // Assert initial render
  await waitFor(() => screen.findByText("..."));

  // Click a button and assert a UI change
  user.click(screen.getByText("button text"));
  await waitFor(() => screen.findByText("..."));
});
```

If your [`loader`][loader]s rely on the `getLoadContext` method, you can provide a stubbed context via the second parameter to `createRemixStub`:

```tsx
const RemixStub = createRemixStub(
  [
    {
      path: "/",
      Component: MyComponent,
      loader({ context }) {
        return json({ message: context.key });
      },
    },
  ],
  { key: "value" }
);
```

The `<RemixStub>` component itself takes properties similar to React Router if you need to control the initial URL, history stack, hydration data, or future flags:

```tsx
// Test the app rendered at "/2" with 2 prior history stack entries
render(
  <RemixStub
    initialEntries={["/", "/1", "/2"]}
    initialIndex={2}
  />
);

// Test the app rendered with initial loader data for the root route.  When using
// this, it's best to give your routes their own unique IDs in your route definitions
render(
  <RemixStub
    hydrationData={{
      loaderData: { root: { message: "hello" } },
    }}
  />
);

// Test the app rendered with given future flags enabled
render(<RemixStub future={{ v3_coolFeature: true }} />);
```

[loader]: ../route/loader
