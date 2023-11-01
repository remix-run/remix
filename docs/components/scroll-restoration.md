---
title: ScrollRestoration
---

# `<ScrollRestoration>`

This component will emulate the browser's scroll restoration on location changes after [`loader`][loader]s have completed. This ensures the scroll position is restored to the right spot, at the right time, even across domains.

You should only render one of these, right before the [`<Scripts/>`][scripts_component] component.

```tsx lines=[3,11]
import {
  Scripts,
  ScrollRestoration,
} from "@remix-run/react";

export default function Root() {
  return (
    <html>
      <body>
        {/* ... */}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
```

## Props

### `getKey`

Optional. Defines the key used to restore scroll positions.

```tsx
<ScrollRestoration
  getKey={(location, matches) => {
    // default behavior
    return location.key;
  }}
/>
```

<details>

<summary>Discussion</summary>

Using `location.key` emulates the browser's default behavior. The user can navigate to the same URL multiple times in the stack and each entry gets its own scroll position to restore.

Some apps may want to override this behavior and restore position based on something else. Consider a social app that has four primary pages:

- "/home"
- "/messages"
- "/notifications"
- "/search"

If the user starts at "/home", scrolls down a bit, clicks "messages" in the navigation menu, then clicks "home" in the navigation menu (not the back button!) there will be three entries in the history stack:

```
1. /home
2. /messages
3. /home
```

By default, React Router (and the browser) will have two different scroll positions stored for `1` and `3` even though they have the same URL. That means as the user navigated from `2` → `3` the scroll position goes to the top instead of restoring to where it was in `1`.

A solid product decision here is to keep the users scroll position on the home feed no matter how they got there (back button or new link clicks). For this, you'd want to use the `location.pathname` as the key.

```tsx
<ScrollRestoration
  getKey={(location, matches) => {
    return location.pathname;
  }}
/>
```

Or you may want to only use the pathname for some paths, and use the normal behavior for everything else:

```tsx
<ScrollRestoration
  getKey={(location, matches) => {
    const paths = ["/home", "/notifications"];
    return paths.includes(location.pathname)
      ? // home and notifications restore by pathname
        location.pathname
      : // everything else by location like the browser
        location.key;
  }}
/>
```

</details>

### `nonce`

`<ScrollRestoration>` renders an inline [`<script>`][script_element] to prevent scroll flashing. The `nonce` prop will be passed down to the script tag to allow CSP nonce usage.

```tsx
<ScrollRestoration nonce={cspNonce} />
```

## Preventing Scroll Reset

When navigating to new locations, the scroll position is reset to the top of the page. You can prevent the "scroll to top" behavior from your links and forms:

```tsx
<Link preventScrollReset={true} />;
<Form preventScrollReset={true} />;
```

See also: [`<Form preventScrollReset>`][form_prevent_scroll_reset], [`<Link preventScrollReset>`][link_prevent_scroll_reset]

[loader]: ../route/loader
[scripts_component]: ./scripts
[script_element]: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script
[form_prevent_scroll_reset]: ../components/form#preventscrollreset
[link_prevent_scroll_reset]: ../components/link#preventscrollreset
