---
title: Module Constraints
---

# Module Constraints

In order for Remix to run your app in both the server and browser environments, your application modules and third party dependencies need to be careful about **module side effects**.

- **Server-only code** - Remix will remove server-only code but it can't if you have module side effects that use server-only code.
- **Browser-only code** - Remix renders on the server so your modules can't have module side effects or first-rendering logic that call browser-only APIs

## Server Code Pruning

The Remix compiler will automatically remove server code from the browser bundles. Our strategy is actually pretty straightforward, but requires you to follow some rules.

1. It creates a "proxy" module in front of your route module
2. The proxy module only imports the browser specific exports

Consider a route module that exports `loader`, `meta`, and a component:

```tsx
import { useLoaderData } from "remix";
import PostsView from "../PostsView";
import { prisma } from "../db";

export function loader() {
  return prisma.post.findMany();
}

export function meta() {
  return { title: "Posts" };
}

export default function Posts() {
  const posts = useLoaderData();
  return <PostsView posts={posts} />;
}
```

The server needs everything in this file but the browser only needs the component and `meta`. In fact, it'll be completely broken if it includes the `prisma` module in the browser bundle. That thing is full of node-only APIs!

To remove the server code from the browser bundles, the Remix compiler creates a proxy module in front of your route and bundles that instead. The proxy for this route would look like:

```ts
export { meta, default } from "./routes/posts.tsx";
```

The compiler will now analyze the code in `routes/posts.tsx` and only keep code that's inside of `meta` and the component. The result is something like this:

```tsx
import { useLoaderData } from "remix";
import PostsView from "../PostsView";

export function meta() {
  return { title: "Posts" };
}

export default function Posts() {
  const posts = useLoaderData();
  return <PostsView posts={posts} />;
}
```

Pretty slick! This is now safe to bundle up for the browser. So what's the problem?

### No Module Side Effects

If you're unfamiliar with side effects, you're not alone! We'll help you identify them now.

Simply put, a **side effect** is any code that might _do something_. A **module side effect** is any code that might _do something when a module is loaded_.

<docs-info>A module side effect is code that executes by simply importing a module</docs-info>

Taking our code from earlier, we saw how the compiler can remove the exports and their imports that aren't used. But if we add this seemingly harmless line of code your app will break!

```tsx bad lines=5
import { useLoaderData } from "remix";
import PostsView from "../PostsView";
import { prisma } from "../db";

console.log(prisma);

export function loader() {
  return prisma.post.findMany();
}

export function meta() {
  return { title: "Posts" };
}

export default function Posts() {
  const posts = useLoaderData();
  return <PostsView posts={posts} />;
}
```

That `console.log` _does something_. The module is imported and then immediately logs to the console. The compiler won't remove it because it has to run when the module is imported. It will bundle something like this:

```tsx bad lines=3,5
import { useLoaderData } from "remix";
import PostsView from "../PostsView";
import { prisma } from "../db"; //😬

console.log(prisma); //🥶

export function meta() {
  return { title: "Posts" };
}

export default function Posts() {
  const posts = useLoaderData();
  return <PostsView posts={posts} />;
}
```

The loader is gone but the prisma dependency stayed! Had we logged something harmless like `console.log("hello!")` it would be fine. But we logged the `prisma` module so the browser's gonna have a hard time with that.

To fix this, remove the side effect by simply moving the code _into the loader_.

```tsx [6]
import { useLoaderData } from "remix";
import PostsView from "../PostsView";
import { prisma } from "../db";

export function loader() {
  console.log(prisma);
  return prisma.post.findMany();
}

export function meta() {
  return { title: "Posts" };
}

export default function Posts() {
  const posts = useLoaderData();
  return <PostsView posts={posts} />;
}
```

This is no longer a module side effect (runs when the module is imported), but rather a side effect of the loader (runs when the loader is called). The compiler will now remove both the loader _and the prisma import_ because it isn't used anywhere else in the module.

Occasionally, the build may have trouble tree-shaking code that should only run on the server. If this happens, you can use the convention of naming a file with the extension `.server` before the file type, for example `db.server.ts`. Adding `.server` to the filename is a hint to the compiler to not worry about this module or its imports when bundling for the browser.

### Higher Order Functions

Some Remix newcomers try to abstract their loaders with "higher order functions". Something like this:

```js bad filename=app/http.js
import { redirect } from "remix";

export function removeTrailingSlash(loader) {
  return function (arg) {
    const { request } = arg;
    const url = new URL(request.url);
    if (url.pathname.endsWith("/")) {
      return redirect(request.url.slice(0, -1), {
        status: 308
      });
    }
    return loader(arg);
  };
}
```

And then try to use it like this:

```js bad filename=app/root.js
import { removeTrailingSlash } from "~/http";

export const loader = removeTrailingSlash(({ request }) => {
  return { some: "data" };
});
```

You can probably now see that this is a module side effect so the compiler can't prune out the `removeTrailingSlash` code.

This type of abstraction is introduced to try to return a response early. Since you can throw a Response in a loader, we can make this simpler and remove the module side effect at the same time so that the server code can be pruned:

```js filename=app/http.js
import { redirect } from "remix";

export function removeTrailingSlash(url) {
  if (url.pathname.endsWith("/")) {
    throw redirect(request.url.slice(0, -1), {
      status: 308
    });
  }
}
```

And then use it like this:

```js bad filename=app/root.js
import { removeTrailingSlash } from "~/http";

export const loader = ({ request }) => {
  removeTrailingSlash(request.url);
  return { some: "data" };
};
```

It reads much nicer as well when you've got a lot of these:

```ts
// this
export const loader = ({ request }) => {
  return removeTrailingSlash(request.url, () => {
    return withSession(request, session => {
      return requireUser(session, user => {
        return json(user);
      });
    });
  });
};

// vs. this
export const loader = ({ request }) => {
  removeTrailingSlash(request.url);
  const session = await getSession(request);
  const user = await requireUser(session);
  return json(user);
};
```

If you want to do some extra-curricular reading, google around for "push vs. pull API". The ability to throw responses changes the model from a "push" to a "pull". This is the same reason folks prefer async/await over callbacks, and React hooks over higher order components and render props.

## Browser-Only Code on the Server

Unlike the browser bundles, Remix doesn't try to remove _browser only code_ from the server bundle because the route modules require every export to render on the server. This means it's your job to be mindful of code that should only execute in the browser.

<docs-error>This will break your app:</docs-error>

```js bad lines=3
import { loadStripe } from "@stripe/stripe-js";

const stripe = await loadStripe(window.ENV.stripe);

export async function redirectToStripeCheckout(sessionId) {
  return stripe.redirectToCheckout({ sessionId });
}
```

<docs-info>You need to avoid any browser-only module side effects like accessing window or initializing APIs in the module scope.</docs-info>

### Initializing Browser Only APIs

The most common scenario is intitializing a third party API when your module is imported. There are a couple ways to easily deal with this.

#### Document Guard

This ensures the library is only initialized if there is a `document`, meaning you're in the browser. We recomend `document` over `window` because server runtimes like Deno has a global `window` available.

```js [3]
import firebase from "firebase/app";

if (typeof document !== "undefined") {
  firebase.initializeApp(document.ENV.firebase);
}

export { firebase };
```

#### Lazy Initialization

This strategy defers initialization until the library is actually used:

```js [4]
import { loadStripe } from "@stripe/stripe-js";

export async function redirectToStripeCheckout(sessionId) {
  const stripe = await loadStripe(window.ENV.stripe);
  return stripe.redirectToCheckout({ sessionId });
}
```

You may want to avoid initializing the library multiple times by storing it in a module-scoped variable.

```js
import { loadStripe } from "@stripe/stripe-js";

let _stripe;
async function getStripe() {
  if (!_stripe) {
    _stripe = await loadStripe(window.ENV.stripe);
  }
  return _stripe;
}

export async function redirectToStripeCheckout(sessionId) {
  const stripe = await getStripe();
  return stripe.redirectToCheckout({ sessionId });
}
```

<docs-info>While none of these strategies remove browser modules from the server bundle, it's okay because the APIs are only called inside of event handlers and effects, which are not module side effects.</docs-info>

### Rendering with Browser Only APIs

Another common case is code that calls browser-only APIs while rendering. When server rendering in React (not just Remix), this must be avoided because the APIs don't exist on the server.

<docs-error>This will break your app because the server will try to use local storage</docs-error>

```js bad lines=2
function useLocalStorage(key) {
  const [state, setState] = useState(
    localStorage.getItem(key)
  );

  const setWithLocalStorage = nextState => {
    setState(nextState);
  };

  return [state, setWithLocalStorage];
}
```

You can fix this by moving the code into `useEffect`, which only runs in the browser.

```js [2,4-6]
function useLocalStorage(key) {
  const [state, setState] = useState(null);

  useEffect(() => {
    setState(localStorage.getItem(key));
  }, []);

  const setWithLocalStorage = nextState => {
    setState(nextState);
  };

  return [state, setWithLocalStorage];
}
```

Now `localStorage` is not being accessed on the initial render, which will work for the server. In the browser, that state will fill in immediately after hydration. Hopefully it doesn't cause a big content layout shift though! If it does, maybe move that state into your database or a cookie so you can access it server side.

### `useLayoutEffect`

If you use this hook React will warn you about using it on the server.

This hook is great when you're setting state for things like:

- The position of an element when it pops up (like a menu button)
- The scroll position in response to user interactions

The point is to perform the effect at the same time as the browser paint so that you don't see the popup show up at `0,0` and then bounce into place. Layout effects let the paint and the effect happen at the same time to avoid this kind of flashing.

It is **not** good for setting state that is rendered inside of elements. Just make sure you aren't using the state set in a `useLayoutEffect` in your elements and you can ignore React's warning.

TODO: Link to Reach UI `useIsomorphicLayoutEffect`

### Third-Party Module Side Effects

Some third party libraries have their own module side effects that are incompatible with React server rendering. Usually it's trying to access `window` for feature detection.

These libraries are incompatible with server rendering in React and therefore incompatible with Remix. Fortunately, very few third party libraries in the React ecosystem do this.

We recommend finding an alternative. But if you can't, we recommend using [patch-package](https://www.npmjs.com/package/patch-package) to fix it up in your app.
