---
title: Module Constraints
---

In order for Remix to run your app in both the server and browser environments, your application modules and third party dependencies need to be careful about **module side effects**.

- **Server-only code** - Remix will remove server-only code but it can't if you have module side effects that use server-only code.
- **Browser-only code** - Remix renders on the server so your modules can't have module side effects or first-rendering logic that call browser-only APIs

## Removing Server-Only Code in Browser Bundles

The Remix compiler can automatically remove server code from the browser bundles. Our strategy is actually pretty straightforward, but requires you to follow some rules.

1. It creates a "proxy" module in front of your route module
2. The proxy module only imports the browser specific exports

Consider a route module that exports `loader`, `meta`, and a component:

```tsx
import { useRouteData } from "remix";
import PostsView from "../PostsView";
import { prisma } from "../db";

export function loader() {
  return prisma.post.findMany();
}

export function meta() {
  return { title: "Posts" };
}

export default function Posts() {
  let posts = useRouteData();
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
import { useRouteData } from "remix";
import PostsView from "../PostsView";

export function meta() {
  return { title: "Posts" };
}

export default function Posts() {
  let posts = useRouteData();
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
import { useRouteData } from "remix";
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
  let posts = useRouteData();
  return <PostsView posts={posts} />;
}
```

That `console.log` _does something_. The module is imported and then immediately logs to the console. The compiler won't remove it because it has to run when the module is imported. It will bundle something like this:

```tsx bad lines=3,5
import { useRouteData } from "remix";
import PostsView from "../PostsView";
import { prisma } from "../db"; //😬

console.log(prisma); //🥶

export function meta() {
  return { title: "Posts" };
}

export default function Posts() {
  let posts = useRouteData();
  return <PostsView posts={posts} />;
}
```

The loader is gone but the prisma dependency stayed! Had we logged something harmless like `console.log("hello!")` it would be fine. But we logged the `prisma` module so the browser's gonna have a hard time with that.

To fix this, remove the side effect by simply moving the code _into the loader_.

```tsx [6]
import { useRouteData } from "remix";
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
  let posts = useRouteData();
  return <PostsView posts={posts} />;
}
```

This is no longer a module side effect (runs when the module is imported), but rather a side effect of the loader (runs when the loader is called). The compiler will now remove both the loader _and the prisma import_ because it isn't used anywhere else in the module.

### Higher Order Functions in Loaders

Higher order functions are an effective composition strategy. However, if you use them to _create_ a loader or action, your app can break because the creation of the function is a module side-effect. To use higher order functions within the constraints of Remix they need to be _inside_ the loader.

Here are a few really common use cases:

- Automatically getting and committing sessions
- Enforcing trailing slashes
- Requiring user authentication

<docs-info>You can use higher order functions in route modules if they are <i>inside the loader</i>, not outside in the module scope</docs-info>

```ts
export let loader = ({ request }) => {
  return requireUser(request, user => {
    return json(user);
  });
};
```

You can combine them together too:

```ts
export let loader = ({ request }) => {
  return removeTrailingSlash(request.url, () => {
    return withSession(request, session => {
      return requireUser(session, user => {
        return json(user);
      });
    });
  });
};
```

There are a lot of functional composition strategies you could implement as an alternative to the API design we chose here. We like to keep the abstraction as low as possible since functional programming can get a little wild pretty quickly 😅

<docs-error>Using a higher order function to create the loader function itself will <i>not</i> work</docs-error>

```ts bad
export let loader = removeTrailingSlash(async () => {
  let posts = await db.posts.findMany();
  return json(posts);
});
```

Can you see why?

The problem is we've called `removeTrailingSlash` _in the module scope_. It's exactly like our `console.log` except we assigned it to a variable. Either way, it's a module side effect so the compiler has to keep it around (maybe there's a `console.log` inside of `removeTrailingSlash` 😅).

Even if we tried to do magic tricks with the compiler to remove these kinds of patterns, in our experience they're much harder to write than the ones we're about to show you.

Let's implement a couple of the helpers we've been discussing:

#### `removeTrailingSlash`

```js filename=removeTrailingSlash.js
import { redirect } from "remix";

export function removeTrailingSlash(request, next) {
  let url = new URL(request.url);
  if (url.pathname.endsWith("/")) {
    return redirect(request.url.slice(0, -1), {
      status: 308
    });
  }
  return next();
}
```

You can see how this function has a chance to return a redirect or let your loader finish the request.

This type of function is a lot easier to author than the kind that don't work with Remix because they don't have to deal with transparently passing along the bag of runtime arguments that are going through the abstraction.

#### `withSession`

This helper allows loaders and actions to skip all the request/response cookie header boilerplate, and ensures the session is always committed.

```js filename=withSession.js
import { Response, json, createCookieSessionStorage } from "remix";

let { getSession, commitSession, destroySession } = createCookieSessionStorage({
  cookie: { name: "__session" }
});

export async function withSession(request, next) {
  let session = await getSession(request.headers.get("Cookie"));

  // pass the session to the loader/action and let it handle the response
  let response = await next(session);

  // if they returned a plain object, turn it into a response
  if (!(response instanceof Response)) {
    response = json(response);
  }

  // commit the session automatically
  response.headers.append("Set-Cookie", await commitSession(session));

  return response;
}
```

Notice how this function actually inspects and manipulates the response returned by the `next` function. Loaders (and actions) are **pure functions**, meaning they don't _do anything_, they just return a response. This allows you to build abstractions like `withSession`.

Maybe seeing how this would be used will help:

```js filename=routes/some-route.js
export let action = async ({ request }) => {
  return withSession(request, session => {
    session.flash("message", "Functional Composition is Fun! (ctional)");
    return "/this/same/page";
  });
};

export let loader = async ({ request }) => {
  return withSession(request, session => {
    return json({ message: session.get("message") });
  });
};
```

(Just between us, `withSession` should probably be built-in to Remix 🤫)

### Types

If you're using TypeScript, you can use this to get the types right:

```ts [1, 5]
import type { LoaderFunction } from "remix";

export function withSession(
  request: Request,
  loader: () => ReturnType<LoaderFunction>
) {
  // etc.
  return response;
}
```

## Avoiding Browser-Only Code While Booting and Rendering

Unlike the browser bundles, Remix doesn't try to remove _browser only code_ from the server bundle because the route modules require every export to render on the server. This means it's your job to be mindful of code that should only execute in the browser.

<docs-error>This will break your app:</docs-error>

```js bad lines=3
import { loadStripe } from "@stripe/stripe-js";

let stripe = await loadStripe(window.ENV.stripe);

export async function redirectToStripeCheckout(sessionId) {
  return stripe.redirectToCheckout({ sessionId });
}
```

<docs-info>You need to avoid any browser-only module side effects like accessing window or initializing APIs in the module scope.</docs-info>

### Initializing Browser Only APIs

The most common scenario is intitializing a third party API when your module is imported. There are a couple ways to easily deal with this.

#### Window Guard

This ensures the library is only initialized if there is a `window`, meaning you're in the browser.

```js [3]
import firebase from "firebase/app";

if (typeof window !== "undefined") {
  firebase.initializeApp(window.ENV.firebase);
}

export { firebase };
```

#### Lazy Initialization

This strategy defers initialization until the library is actually used:

```js [4]
import { loadStripe } from "@stripe/stripe-js";

export async function redirectToStripeCheckout(sessionId) {
  let stripe = await loadStripe(window.ENV.stripe);
  return stripe.redirectToCheckout({ sessionId });
}
```

You may want to avoid initializing the library multiple times by storing it in a module-scoped variable.

```js [3-6]
import { loadStripe } from "@stripe/stripe-js";

let stripe;
async function getStripe() {
  return (stripe = stripe || (await loadStripe(window.ENV.stripe)));
}

export async function redirectToStripeCheckout(sessionId) {
  return getStripe().redirectToCheckout({ sessionId });
}
```

<docs-info>While none of these strategies remove browser modules from the server bundle, it's okay because the APIs are only called inside of event handlers and effects, which are not module side effects.</docs-info>

### Rendering with Browser Only APIs

Another common case is code that calls browser-only APIs while rendering. When server rendering in React (not just Remix), this must be avoided because the APIs don't exist on the server.

<docs-error>This will break your app because the server will try to use local storage</docs-error>

```js bad lines=2
function useLocalStorage(key) {
  let [state, setState] = useState(localStorage.getItem(key));

  let setWithLocalStorage = nextState => {
    setState(nextState);
  };

  return [state, setWithLocalStorage];
}
```

You can fix this by moving the code into `useEffect`, which only runs in the browser.

```js [2,4-6]
function useLocalStorage(key) {
  let [state, setState] = useState(null);

  useEffect(() => {
    setState(localStorage.getItem(key));
  }, []);

  let setWithLocalStorage = nextState => {
    setState(nextState);
  };

  return [state, setWithLocalStorage];
}
```

Now `localStorage` is not being accessed on the initial render, which will work for the server. In the browser, that state will fill in immediately after hydration. Hopefully it doesn't cause a big content layout shift though! If it does, maybe move that state into your database or a cookie so you can access it server side.

### TODO: `useLayoutEffect`

- when it's preferred: when state is for effects, not rendering (scroll position)
- when it's not okay: when state is used for rendering (`localStorage`)
- how to get React/eslint to shut up about it: `window` guard in `useImAnAdultLayoutEffect`

### Third-Party Module Side Effects

Some third party libraries have their own module side effects that are incompatible with React server rendering. Usually it's trying to access `window` for feature detection.

These libraries are incompatible with server rendering in React and therefore incompatible with Remix. Fortunately, very few third party libraries in the React ecosystem do this.

We recommend finding an alternative. But if you can't, we recommend using [patch-package](https://www.npmjs.com/package/patch-package) to fix it up in your app.
