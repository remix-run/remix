---
title: "@remix-run/testing"
---

# `@remix-run/testing`

This package contains utilities to help in unit testing portions of your Remix application. This is achieved by mocking the Remix route modules/assets manifest output by the compiler and generating an in-memory React Router app via [createMemoryRouter][create-memory-router].

The general usage of this is to test components/hooks that rely on Remix hooks/components which you aren't able to cleanly mock ([`useLoaderData`][use-loader-data], [`useFetcher`][use-fetcher], etc.). While it can also be used for more advanced testing such as clicking links and navigating to pages, those are better suited for End-to-End tests via something like [Cypress][cypress] or [Playwright][playwright].

## Usage

To use [`createRemixStub`][create-remix-stub], define your routes using React Router-like route objects, where you specify the `path`, `Component`, `loader`, etc. These are essentially mocking the nesting and exports of the route files in your Remix app:

```tsx
import { createRemixStub } from "@remix-run/testing";

const RemixStub = createRemixStub([
  {
    path: "/",
    Component: MyComponent,
    loader() {
      return json({ message: "hello" });
    },
  },
]);
```

Then you can render the `<RemixStub />` component and assert against it:

```tsx
render(<RemixStub />);
await screen.findByText("Some rendered text");
```

## Example

Here's a full working example testing using [`jest`][jest] and [React Testing Library][rtl]:

```tsx
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { createRemixStub } from "@remix-run/testing";
import {
  render,
  screen,
  waitFor,
} from "@testing-library/react";

test("renders loader data", async () => {
  // ⚠️ This would usually be a component you import from your app code
  function MyComponent() {
    const data = useLoaderData() as { message: string };
    return <p>Message: {data.message}</p>;
  }

  const RemixStub = createRemixStub([
    {
      path: "/",
      Component: MyComponent,
      loader() {
        return json({ message: "hello" });
      },
    },
  ]);

  render(<RemixStub />);

  await waitFor(() => screen.findByText("Message: hello"));
});
```

[create-memory-router]: https://reactrouter.com/v6/routers/create-memory-router
[use-loader-data]: ../hooks/use-loader-data
[use-fetcher]: ../hooks/use-fetcher
[cypress]: https://www.cypress.io
[playwright]: https://playwright.dev
[create-remix-stub]: ../utils/create-remix-stub
[jest]: https://jestjs.io
[rtl]: https://testing-library.com/docs/react-testing-library/intro
