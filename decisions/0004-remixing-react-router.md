# Remixing React Router

Date: 2022-07-29

Status: accepted

## Context

In [Remixing React Router][remixing router], Ryan gives an overview of the work we started out to do in bringing the data APIs from Remix (loaders, actions, fetchers) over to `react-router`. We made _many_ decisions along the way that we'll document here. In some cases we decided to proceed with behavior that is different from that of Remix today, or add net-new behavior that does not currently exist uin Remix. We'll identify those cases as necessary and provide rationale for the divergence and how we plan to support backwards compatibility.

## Decisions

### Move the bulk of logic to a framework-agnostic router

Thankfully this decision was sort of already made by Ryan. Maybe a surprise to some, maybe not, the current transition manager doesn't import or reference `react` or `react-router` a single time. This is by design because the logic being handled has nothing to do with how to render the UI layer. It's all about "what route am I on?", "what route am I going to?", "how do I load data for the next route?", "how do I interrupt ongoing navigations?" etc. None of these decisions actually _care_ about how the route and it's data will eventually be rendered. Instead, the router simply needs to know whether given routes _have_ components and/or error boundaries - but it doesn't need to know about them or how to render them.

This is a huge advantage since it's a strict requirement in order to eventually support UI libraries other than React (namely Preact and Vue). So in the end, we have a `@remix-run/router` package with _zero_ dependencies 🔥.

### Inline the `history` library into the router

`react-router@6.3` currently relies on the `history@5` package. When we first started the work, we were intending to bring `history` into the `react-router` repo and create `history@6` and it would still be a standalone package and a dependency of `@remix-run/router`. However, 3 things pushed us in a different direction and caused us to just make history a single file inside of the router, and treat it more as an implementation detail.

**1. History is an implementation detail in a data-aware landscape**

Now that the router is data-aware, it has to manage _both_ route data loading/mutations and the URL (or in-memory location state but for simplicity let's just talk in terms of browser-routers here). In `react-router@6.3`/`history@5` the router was purely _reactive_. It listened for `history` changes and rendered the proper UI. So if a user clicked a link, it updated `history` _and then_ informed the router "hey you should render this new location".

This is no longer the case in a data-aware landscape. Now, when a user clicks a link, we need to first tell the router "hey the user _intends_ to go to this location." In response to that the router can initiate some data fetches but during these fetches we're still on the old page! The user is still looking at the old content, and the URL should reflect that. This fits with the "browser emulator" concept as well. If you had a non-JS landscape and a user clicked a link from `/a -> /b` and the server took 5 seconds to send back a response for `/b` - during that time the browser URL bar shows the URL and title for `/a` and a little spinner in the tab. This is exactly how we built the router, it first loads data, then it updates state and tells history to update the URL.

There's one caveat here when it comes to back/forward button usage. When the users navigates back/forward in the history stack we get a `popstate` event _but the URL has already been updated_. So the best we can do there is react to the new URL. This is _not_ what the browser would do in a non-JS world but we really have no choice.

All this being said - history is no longer a simple process of "update the URL then tell the router to re-render". History and routing are far more intertwined and behave slightly differently for PUSH/REPLACE than they do for POP navigations. For PUSH/REPLACE we go `router.navigate -> load data -> update state -> update history`, but for POP we `update history -> router.navigate -> load data -> update state`. So in PUSH, the router informs history. But in POP, history informs the router. These nuances made make sense to keep the router as the public API and make history more of an internal implementation detail.

**2. History is being superseded via the Navigation API**

With the pending [Navigation API][navigation api] in the works, there's potentially a not-too-distant future where we aren't using `window.history` at all or in the same way, so by moving our own `history` abstraction to an implementation detail we keep ourselves better poised to adopt the Navigation API in a non-breaking manner.

**3. Initial implementations required it**

In the first implementations we actually didn't touch the internals of `BrowserRouter` and it's non-data-aware counterparts. And due to the changes we made in `history` to not notify listeners on PUSH/REPLACE wouldn't work. So for a very short period, we actually had both history v5 and this new internal history so we _couldn't_ publish it as history v6 since you can't have multiple dependent versions. Eventually, this went away as we added a `v5Compat` flag to the new history so it could behave like v5 used to when needed.

### `fetcher.load()` participates in revalidations

In Remix, if you have data on a page from a `fetcher.load()` and you submit a mutation - those fetchers don't revalidate so the data may now be stale if the mutation impacted it. We've changed this in `@remix-run/router` such that revalidation updates _all_ active loaded data including route loaders as well as active `fetcher.load()` calls. These can be opted out of using the normal `shouldRevalidate()` method

**Backwards Compatibility**

We categorize this as a bug fix since fetchers get stale in current Remix apps

### `useTransition` renamed to `useNavigation`

This was done for two reasons:

- Avoid confusion with the `useTransition` hook in React 18
- It's more semantically correct because a "navigation" is what you trigger as a result of `router.navigate()` or `useNavigate()`

**Backwards Compatibility**

We plan to export `useNavigation` in Remix and encourage folks to switch, but we will continue to include `useTransition` in a deprecated fashion

### Navigations/Fetchers state structure changes

**`useTransition().type` is removed**

In Remix, the `useTransition` hook returned a Transition object which had a `state` property of `"idle" | "loading" | "submitting"`. It also had a `type` property which represented sort of "sub-states" such as `"normalLoad" | "actionReload" | "loaderRedirect"` etc. In React Router we chose to get rid of the `type` field for 2 reasons:

1. In practice we found that the _vast_ majority of the time al you needed to reference was the `state`
2. For scenarios in which you really do need to distinguish, we are pretty sure that in all cases, you can deduce the `type` from `state`, current location (`useLocation`), next location (`useNavigation().location`), and submission info (`useNavigation().formData`).

**`useTransition().submission` is flattened**

Another area that changes is the `useTransition().submission` property was removed. We found that in practice folks never really needed the submission as a standalone thing, and instead always just cared about the `formMethod` or `formData`. So we flattened them onto the navigation, so `useNavigation()` will return an object of the format:

```
{
  state: "idle" | "loading" | "submitting";
  location: Location;
  formMethod?: FormMethod;
  formAction?: string;
  formEncType?: FormEncType;
  formData?: FormData;
}
```

**Backwards Compatibility**

We plan to remain backwards compatible here in Remix. Very likely we'll expose the `useNavigation` hook and encourage users to move to that. And then `useTransition` will remain in a deprecated state and it will cal `useNavigation` and then backfill the `type` and `submission` properties.

### `<Form method="get">` is no longer a "submission"

Functionally, these two bits of code are identical, with the only difference being that in the `<form>` case you let the user determine the query value.

```jsx
<a href="/search?query=matt">Search</a>

<form action="/search">
  <input name="query" value="matt" />
  <button type="submit">Search</button>
</form>
```

But, in Remix we were considering the latter a "submission" such that `useTransition().state === "submitting"`. In order to ensure our "navigations" reflect the browser behavior we have changed this in the router such that GET Form submissions result in `useNavigation().state === "loading"`.

**Backwards Compatibility**

This will be handled in the deprecated `useTransition` hook along with the backfill of `type` and `submission` properties

### `unstable_shouldReload` stabilized as `shouldRevalidate`

We stabilized the API for when a given route loader should re-run, and changed the name to align with the "revalidation" nomenclature and the `useRevalidator` hook. We also leave more control in the hands of the user here. In Remix there were some cases in which you _could not_ opt out of revalidation and if your method did run you had full control and couldn't necessarily handle one edge case and then say "do what you otherwise would have done".

Now, if you provide a `shouldRevalidate` method we will call it during all revalidations and provide you a `defaultShouldRevalidate` boolean value. This allows you to opt out of any revalidation, and also code your own logic to fallback on our default choice:

```js
function shouldRevalidate({ defaultShouldRevalidate }) {
  // Don't revalidate for this case
  if (someEdgeCase()) {
    return false;
  }

  // Otherwise, do what we would have done by default
  return defaultShouldRevalidate;
}
```

### `<ScrollRestoration getKey>` prop

In Remix, the `<ScrollRestoration>` component made an assumption that we would always restore scroll position based on `location.key`. If the key was the same as a prior location we knew the scroll position for, then we knew you had been there before and we should restore. This works great for back/forward navigations but it's a bit overly restrictive. You cannot choose tgo restore scroll based on anything other than `key`. Twitter has a great implementation of this as you click around in their left nav bar - your tweet feed is always at the same place when you click back to it - even though its a _new_ location in the history stack. This is because they're restoring by pathname here instead of `location.key`. Or maybe you want to maintain scroll position for all routes under a given pathname and you thus want to use a portion of the pathname as the scroll restoration key.

In React Router we now accept an optional `<ScrollRestoration getKey>` prop where you provide a function that returns the key to use for scroll restoration:

```js
function getKey(location: Location, matches: DataRouteMatch[]) {
  // Restore by pathname on /tweets
  if (location.pathname === "/tweets") {
    return location.pathname;
  }
  // Otherwise use the key
  return location.key;
}
```

**Backwards Compatibility**

We're ok here since the new prop is optional and defaults to using `location.key`

### `<Link resetScroll="false">` prop

In addition to `<ScrollRestoration>` handling "restoring" scroll position on previously visited routes. It also handles "resetting" scroll position back to the top on _new_ routes. This is not always desireable if you're clicking around inside a tabbed view or something, so we've introduced a new `<Link resetScroll>` prop that lets you disable the scroll reset behavior _for a given navigation_. Note that this "resetting" logic happens if and only if we cannot restore scroll to a previously known location for that scroll restoration key.

### `useRevalidator()` hook

This has been a long time coming - see https://github.com/remix-run/remix/discussions/1996 🙂

### No distinction between Error and Catch boundaries

TODO: Ryan to fill in some more details here.

The differentiation between error and catch prove to be a bit vague over time and a source of confusion for developers. We chose to go with just a single `errorElement` in the router for simplicity. If you throw anything, it ends up in the error boundary and propagates accordingly.

**Backwards Compatibility**

We will handle this in Remix where it's `errorElement` will decide if it should render via the `ErrorBoundary` or `CatchBoundary`.

### `Request.signal` instead of `signal` param

We dropped the `signal` parameter to loaders and actions because an incoming `Request` already has it's own signal!

**Backwards Compatibility**

We'll need to re-expose the `request.signal` as a standalone `signal` in Remix

[remixing router]: https://remix.run/blog/remixing-react-router
[navigation api]: https://developer.chrome.com/docs/web-platform/navigation-api/
