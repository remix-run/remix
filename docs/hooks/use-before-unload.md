---
title: useBeforeUnload
toc: false
---

# `useBeforeUnload`

<docs-info>This hook is simply a re-export of [React Router's `useBeforeUnload`][rr-usebeforeunload].</docs-info>

This hook is just a helper around `window.onbeforeunload`.

When users click links to pages they haven't visited yet, Remix loads the code-split modules for that page. If you deploy in the middle of a user's session, and you or your host removes the old files from the server (many do 😭), then Remix's requests for those modules will fail. Remix recovers by automatically reloading the browser at the new URL. This should start over from the server with the latest version of your application. Most of the time this works out great, and user doesn't even know anything happened.

In this situation, you may need to save important application state on the page (to something like the browser's local storage), because the automatic page reload will lose any state you had.

Remix or not, this is a good practice. The user can change the url, accidentally close the browser window, etc.

```tsx lines=[1,7-11]
import { useBeforeUnload } from "@remix-run/react";

function SomeForm() {
  const [state, setState] = React.useState(null);

  // save it off before the automatic page reload
  useBeforeUnload(
    React.useCallback(() => {
      localStorage.stuff = state;
    }, [state])
  );

  // read it in when they return
  React.useEffect(() => {
    if (state === null && localStorage.stuff != null) {
      setState(localStorage.stuff);
    }
  }, [state]);

  return <>{/*... */}</>;
}
```

For more information and usage, please refer to the [React Router `useBeforeUnload` docs][rr-usebeforeunload].

[rr-usebeforeunload]: https://reactrouter.com/hooks/use-before-unload
