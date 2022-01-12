---
title: Data Loading
description: One of the primary features of Remix is simplifying interactions with the server to get data into components. This document will help you get the most out of data loading in Remix.
---

# Data Loading

One of the primary features of Remix is simplifying interactions with the server to get data into components. When you follow these conventions, Remix can automatically:

- Server render your pages
- Be resilient to network conditions when JavaScript fails to load
- Make optimizations as the user interacts with your site to make it fast by only loading data for the changing parts of the page
- Fetch data, JavaScript modules, CSS and other assets in parallel on transitions, avoiding render+fetch waterfalls that lead to choppy UI
- Ensure the data in the UI is in sync with the data on the server by revalidating after [actions][action]
- Excellent scroll restoration on back/forward clicks (even across domains)
- Handle server side errors with [error boundaries][error-boundary]
- Enable solid UX for "Not Found" and "Unauthorized" with [catch boundaries][catch-boundary]
- Help you keep the happy path of your UI happy.

## Basics

Each [route module][route-module] can export a component and a [`loader`][loader]. [`useLoaderData`][useloaderdata] will provide the loader's data to your component:

```tsx filename=app/routes/products.tsx lines=[1,2,4-6,9]
import { useLoaderData } from "remix";
import type { LoaderFunction } from "remix";

export let loader: LoaderFunction = () => {
  return [{ name: "Pants" }, { name: "Jacket" }];
};

export default function Products() {
  let products = useLoaderData();
  return (
    <div>
      <h1>Products</h1>
      {products.map(product => (
        <div>{product.name}</div>
      ))}
    </div>
  );
}
```

The component renders on the server and in the browser. The loader _only runs on the server_. That means our hard-coded products array doesn't get included in the browser bundles and it's safe to use server-only for APIs and SDKs for things like database, payment processing, content management systems, etc.

If your server side modules end up in client bundles, move the imports for those modules to a file named `{something}.server.ts` with the `.server.ts` suffix to ensure they are excluded.

## Route Params

When you name a file with `$` like `routes/users/$userId.tsx` and `routes/users/$userId/projects/$projectId.tsx` the dynamic segments (the ones starting with `$`) will be parsed from the URL and passed to your loader on a `params` object.

```tsx filename=routes/users/$userId/projects/$projectId.tsx
import type { LoaderFunction } from "remix";

export let loader: LoaderFunction = ({ params }) => {
  console.log(params.userId);
  console.log(params.projectId);
};
```

Given the following URLs, the params would be parsed as follows:

| URL                             | `params.userId` | `params.projectId` |
| ------------------------------- | --------------- | ------------------ |
| `/users/123/projects/abc`       | `"123"`         | `"abc"`            |
| `/users/aec34g/projects/22cba9` | `"aec34g"`      | `"22cba9"`         |

These params are most useful for looking up data:

```tsx filename=routes/users/$userId/projects/$projectId.tsx lines=[6,7]
import type { LoaderFunction } from "remix";

export let loader: LoaderFunction = ({ params }) => {
  return fakeDb.project.findMany({
    where: {
      userId: params.userId,
      projectId: params.projectId
    }
  });
};
```

### Param Type Safety

Because these params come from the URL and not your source code, you can't know for sure if they will be defined. That's why the types on the param's keys are `string | undefined`. It's good practice to validate before using them, especially in TypeScript to get type safety. Using `invariant` makes it easy.

```tsx filename=routes/users/$userId/projects/$projectId.tsx lines=[1,5-6]
import invariant from "tiny-invariant";
import type { LoaderFunction } from "remix";

export let loader: LoaderFunction = ({ params }) => {
  invariant(params.userId, "Expected params.userId");
  invariant(params.projectId, "Expected params.projectId");

  params.projectId; // <-- TypeScript now knows this is a string
};
```

While you may be uncomfortable throwing errors like this with `invariant` when it fails, remember that in Remix you know the user will end up in the [error boundary][error-boundary] where they can recover from the problem instead of a broken UI.

## External APIs

Remix polyfills the `fetch` API on your server so it's very easy to fetch data from existing JSON APIs. Instead of managing state, errors, race conditions, and more yourself, you can do the fetch from your loader (on the server) and let Remix handle the rest.

```tsx filename=app/routes/gists.jsx lines=[2]
export async function loader() {
  let res = await fetch("https://api.github.com/gists");
  return res.json();
}

export default function GistsRoute() {
  let gists = useLoaderData();
  return (
    <ul>
      {gists.map(gist => (
        <li>
          <a href={gist.html_url}>{gist.id}</a>
        </li>
      ))}
    </ul>
  );
}
```

This is great when you already have an API to work with and don't care or need to connect directly to your data source in your Remix app.

## Databases

Since Remix runs on your server, you can connect directly to a database in your route modules. For example, you could connect to a Postgres database with [Prisma][prisma].

```tsx filename=app/db.server.ts
import { PrismaClient } from "@prisma/client";
let db = new PrismaClient();
export { db };
```

And then your routes can import it and make queries against it:

```tsx filename=app/routes/products/$categoryId.tsx
import { useLoaderData } from "remix";
import type { LoaderFunction } from "remix";
import { db } from "~/db.server";

export let loader: LoaderFunction = async ({ params }) => {
  return db.product.findMany({
    where: {
      categoryId: params.categoryId
    }
  });
};

export default function ProductCategory() {
  let products = useLoaderData();
  return (
    <div>
      <p>{products.length} Products</p>
      {/* ... */}
    </div>
  );
}
```

## Cloudflare KV

If you picked Cloudflare Workers as you environment, [Cloudflare Key Value][cloudflare-kv] storage allows you to persist data at the edge as if it were a static resource. You'll need to [do some configuration][cloudflare-kv-setup] but then you can access the data from your loaders:

```tsx filename=app/routes/products/$productId.tsx
import { useLoaderData } from "remix";
import type { LoaderFunction } from "remix";

export let loader: LoaderFunction = async ({ params }) => {
  return PRODUCTS_KV.get(`product-${params.productId}`, {
    type: "json"
  });
};

export default function Product() {
  let product = useLoaderData();
  return (
    <div>
      <p>{} Products</p>
      {/* ... */}
    </div>
  );
}
```

## Not Found

While loading data its common for a record to be "not found". As soon as you know you can't render the component as expected, `throw` a response and Remix will stop executing code in the current loader and switch over to the nearest [catch boundary][catch-boundary].

```tsx lines=[10-13]
export let loader: LoaderFunction = async ({
  params,
  request
}) => {
  let product = await db.product.findOne({
    where: { id: params.productId }
  });

  if (!product) {
    // we know we can't render the component
    // so throw immediately to stop executing code
    // and show the not found page
    throw new Response("Not Found", { status: 404 });
  }

  let cart = await getCart(request);
  return { product, inCart: cart.includes(product.id) };
};
```

## URL Search Params

URL Search Params are the portion of the URL after a `?`. Other names for this are "query string", "search string", or "location search". You can access the values by creating a URL out of the `request.url`:

```tsx filename=routes/products.tsx lines=[1,4,5]
import type { LoaderFunction } from "remix";

export let loader: LoaderFunction = ({ request }) => {
  let url = new URL(request.url);
  let term = url.searchParams.get("term");
  return fakeProductSearch(term);
};
```

There are a few web platform types at play here:

- The [`request`][request] object has a `url` property
- [URL constructor][url] that parses the URL string into an object
- `url.searchParams` is an instance of [URLSearchParams][url-search-params], which is a parsed version of the location search string that makes it easy to read and manipulate the search string

Given the following URLs, the search params would be parsed as follows:

| URL                             | `url.searchParams.get("term")` |
| ------------------------------- | ------------------------------ |
| `/products?term=stretchy+pants` | `"stretchy pants"`             |
| `/products?term=`               | `""`                           |
| `/products`                     | `null`                         |

### Data Reloads

When multiple nested routes are rendering and the search params change, all of the routes will be reloaded (instead of just the new or changed routes). This is because search params are a cross-cutting concern and could effect any loader. If you would like to prevent some of your routes from reloading in this scenario, use [shouldReload][should-reload].

### Search Params in Components

Sometimes you need to read and change the search params from your component instead of your loaders and actions. There are handful of ways to do this depending on your use case.

**Setting Search Params**

Perhaps the most common way to set search params is letting the user control them with a form:

```tsx filename=app/routes/products/shoes.tsx lines=[8,9,16,17]
export default function ProductFilters() {
  return (
    <Form method="get">
      <label htmlFor="nike">Nike</label>
      <input
        type="checkbox"
        id="nike"
        name="brand"
        value="nike"
      />

      <label htmlFor="adidas">Adidas</label>
      <input
        type="checkbox"
        id="adidas"
        name="brand"
        value="adidas"
      />

      <button type="submit">Update</button>
    </Form>
  );
}
```

If the user only has one selected:

- [x] Nike
- [ ] Adidas

Then the URL will be `/products/shoes?brand=nike`

If the user has both selected:

- [x] Nike
- [x] Adidas

Then the url will be: `/products/shoes?brand=nike&brand=adidas`

Note that `brand` is repeated in the URL search string since both checkboxes were named `"brand"`. In your loader you can get access to all of those values with [`searchParams.getAll`][search-params-getall]

```tsx lines=[3]
export function loader({ request }) {
  let url = new URL(request.url);
  let brands = url.searchParams.getAll("brand");
  return getProducts({ brands });
}
```

**Linking to Search Params**

As the developer, you can control the search params by linking to URLs with search strings in them. The link will replace the current search string in the URL (if there is one) with what is in the link:

```tsx
<Link to="?brand=nike">Nike (only)</Link>
```

**Reading Search Params in Components**

In addition to reading search params in loaders, you often need access to them in components, too:

```tsx lines=[1,4,5,15,24]
import { useSearchParams } from "remix";

export default function ProductFilters() {
  let [searchParams] = useSearchParams();
  let brands = searchParams.getAll("brand");

  return (
    <Form method="get">
      <label htmlFor="nike">Nike</label>
      <input
        type="checkbox"
        id="nike"
        name="brand"
        value="nike"
        defaultChecked={brands.includes("nike")}
      />

      <label htmlFor="adidas">Adidas</label>
      <input
        type="checkbox"
        id="adidas"
        name="brand"
        value="adidas"
        defaultChecked={brands.includes("nike")}
      />

      <button type="submit">Update</button>
    </Form>
  );
}
```

You might want to auto submit the form on any field change, for that there is [`useSubmit`][use-submit]:

```tsx lines=[1,4,9]
import { useSubmit, useSearchParams } from "remix";

export default function ProductFilters() {
  let submit = useSubmit();
  let [searchParams] = useSearchParams();
  let brands = searchParams.getAll("brand");

  return (
    <Form method="get" onChange={e => submit(e.currentTarget)}>
      {/* ... */}
    </Form>
  );
}
```

**Setting Search Params Imperatively**

While uncommon, you can also set searchParams imperatively at any time for any reason. The use cases here are slim, so slim we couldn't even come up with a good one, but here's a silly example:

```tsx
import { useSearchParams } from "remix";

export default function ProductFilters() {
  let [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    let id = setInterval(() => {
      setSearchParams({ now: Date.now() });
    }, 1000);
    return () => clearInterval(id);
  }, [setSearchParams]);

  // ...
}
```

### Search Params and Controlled Inputs

Often you want to keep some inputs, like checkboxes, in sync with the search params in the URL. This can get a little tricky with React's controlled component concept.

This is only needed if the search params can be set in two ways and we want the inputs to stay in sync with the search params. For example, both the `<input type="checkbox">` and the `Link` can change the brand in this component:

```tsx bad lines=[11-18]
import { useSearchParams } from "remix";

export default function ProductFilters() {
  let [searchParams] = useSearchParams();
  let brands = searchParams.getAll("brand");

  return (
    <Form method="get">
      <p>
        <label htmlFor="nike">Nike</label>
        <input
          type="checkbox"
          id="nike"
          name="brand"
          value="nike"
          defaultChecked={brands.includes("nike")}
        />
        <Link to="?brand=nike">(only)</Link>
      </p>

      <button type="submit">Update</button>
    </Form>
  );
}
```

If the user clicks the checkbox and submits the form, the URL updates and the checkbox state changes too. But if the user clicks the link _only the url will update and not the checkbox_. That's not what we want. You may be familiar with React's controlled components here and think to switch it to `checked` instead of `defaultChecked`:

```tsx bad lines=[6]
<input
  type="checkbox"
  id="adidas"
  name="brand"
  value="adidas"
  checked={brands.includes("adidas")}
/>
```

Now we have the opposite problem: clicking the link updates both the URL and the checkbox state but _the checkbox no longer works_ because React prevents the state from changing until the URL that controls it changes--and it never will because we can't change the checkbox and resubmit the form.

React wants you to control it with some state but we want the user to control it until they submit the form, and then we want the URL to control it when it changes. So we're in this "sorta-controlled" spot.

You have two choices, and what you pick depends on the user experience you want.

**First Choice**: The simplest thing is to auto-submit the form when the user clicks the checkbox:

```tsx lines=[1,4,17]
import { useSubmit, useSearchParams } from "remix";

export default function ProductFilters() {
  let submit = useSubmit();
  let [searchParams] = useSearchParams();
  let brands = searchParams.getAll("brand");

  return (
    <Form method="get">
      <p>
        <label htmlFor="nike">Nike</label>
        <input
          type="checkbox"
          id="nike"
          name="brand"
          value="nike"
          onChange={e => submit(e.currentTarget.form)}
          checked={brands.includes("nike")}
        />
        <Link to="?brand=nike">(only)</Link>
      </p>

      {/* ... */}
    </Form>
  );
}
```

(If you are also auto submitting on the form `onChange`, make sure to `e.stopPropagation()` so the event doesn't bubble up to the form, otherwise you'll get double submissions on every click of the checkbox.)

**Second Choice**: If you want the input to be "semi controlled", where the checkbox reflects the URL state, but the user can also toggle it on and off before submitting the form and changing the URL, you'll need to wire up some state. It's a bit of work but straightforward:

- Initialize some state from the search params
- Update the state when the user clicks the checkbox so the box changes to "checked"
- Update the state when the search params change (the user submitted the form or clicked the link) to reflect what's in the url search params

```tsx lines=[8-11,13-17,28-32]
import { useSubmit, useSearchParams } from "remix";

export default function ProductFilters() {
  let submit = useSubmit();
  let [searchParams] = useSearchParams();
  let brands = searchParams.getAll("brand");

  let [nikeChecked, setNikeChecked] = React.useState(
    // initialize from the URL
    brands.includes("nike")
  );

  // Update the state when the params change
  // (form submission or link click)
  React.useEffect(() => {
    setNikeChecked(brands.includes("nike"));
  }, [searchParams]);

  return (
    <Form method="get">
      <p>
        <label htmlFor="nike">Nike</label>
        <input
          type="checkbox"
          id="nike"
          name="brand"
          value="nike"
          onChange={e => {
            // update checkbox state w/o submitting the form
            setNikeChecked(true);
          }}
          checked={nikeChecked}
        />
        <Link to="?brand=nike">(only)</Link>
      </p>

      {/* ... */}
    </Form>
  );
}
```

You might want to make an abstraction for checkboxes like this:

```tsx
<div>
  <SearchCheckbox name="brand" value="nike" />
  <SearchCheckbox name="brand" value="reebok" />
  <SearchCheckbox name="brand" value="adidas" />
</div>;

function SearchCheckbox({ name, value }) {
  let [searchParams] = useSearchParams();
  let all = searchParams.getAll(name);
  let [checked, setChecked] = React.useState(
    all.includes(value)
  );

  React.useEffect(() => {
    setChecked(all.includes(value));
  }, [searchParams]);

  return (
    <input
      type="checkbox"
      name={name}
      value={value}
      checked={checked}
      onChange={e => setChecked(e.target.checked)}
    />
  );
}
```

**Option 3**: We said there were only two options, but there is a third unholy option that might tempt you if you know React pretty well. You might want to blow away the input and remount it with `key` prop shenanigans. While clever, this will cause accessibility issues as the user will lose focus when React removes the node from the document after they click it.

<docs-error>Don't do this, it will cause accessibility issues</docs-error>

```tsx bad lines=[6,7]
<input
  type="checkbox"
  id="adidas"
  name="brand"
  value="adidas"
  key={"adidas" + brands.includes("adidas")}
  defaultChecked={brands.includes("adidas")}
/>
```

## Remix Optimizations

Remix optimizes the user experiences by only loading the data for the parts of the page that are changing on navigation. For example, consider the UI you're using right now in these docs. The navbar on the side is in a parent route that fetched the dynamically generated menu of all the docs, and the child route fetched the document you're reading right now. If you click a link in the sidebar Remix knows that the parent route will remain on the page but the child route's data will change because the url param for the document will change. With this insight, Remix _will not refetch the parent route's data_.

Without Remix the next question is "how do I reload all of the data?". This is built into Remix as well. Whenever an [action][action] is called (the user submitted a form or you, the programmer, called `submit` from `useSubmit`), Remix will automatically reload all of the routes on the page to capture any changes that might have happened.

You don't have to worry about expiring caches or avoid overfetching data as the user interacts with your app, it's all automatic.

There are three cases where Remix will reload all of your routes:

- After an action (forms, `useSubmit`, [`fetcher.submit`][fetcher-submit])
- If the url search params change (any loader could use them)
- The user clicks a link to the exact same URL they are already at (this will also replace the current entry in the history stack)

All of these behaviors emulate the browser's default behavior. In these cases, Remix doesn't know enough about your code to optimize the data loading, but you can optimize it yourself with [unstable_shouldReload][should-reload].

## Data Libraries

Thanks to Remix's data conventions and nested routes, you'll usually find you don't need to reach for client side data libraries like React Query, SWR, Apollo, Relay, urql and others. If you're using global state management libraries like redux, primarily for interacting with data on the server, it's also unlikely you'll need those.

Of course, Remix doesn't prevent you from using them (unless they require bundler integration). You can bring whatever React data libraries you like and use them wherever you think they'll serve your UI better than the Remix APIs. In some cases you can use Remix for the initial server render and then switch over to your favorite library for the interactions afterward.

That said, if you bring an external data library and sidestep Remix's own data conventions, Remix can no longer automatically

- Server render your pages
- Be resilient to network conditions when JavaScript fails to load
- Make optimizations as the user interacts with your site to make it fast by only loading data for the changing parts of the page
- Fetch data, JavaScript modules, CSS and other assets in parallel on transitions, avoiding render+fetch waterfalls that lead to choppy UI
- Ensure the data in the UI is in sync with the data on the server by revalidating after actions
- Excellent scroll restoration on back/forward clicks (even across domains)
- Handle server side errors with [error boundaries][error-boundary]
- Enable solid UX for "Not Found" and "Unauthorized" with [catch boundaries][catch-boundary]
- Help you keep the happy path of your UI happy.

Instead you'll need to do extra work to provide a good user experience.

Remix is designed to meet any user experience you can design. While it's unexpected that you _need_ an external data library, you might still _want_ one and that's fine!

As you learn Remix, you'll find you shift from thinking in client state to thinking in URLs, and you'll get a bunch of stuff for free when you do.

## Gotchas

Loaders are only called on the server, via `fetch` from the browser, so your data is serialized with `JSON.stringify` and sent over the network before it makes it to your component. This means your data needs to be serializable. For example:

<docs-error>This won't work!</docs-error>

```tsx bad nocopy lines=[3-6]
export function loader() {
  return {
    date: new Date(),
    someMethod() {
      return "hello!";
    }
  };
}

export default function RouteComp() {
  let data = useLoaderData();
  console.log(data);
  // '{"date":"2021-11-27T23:54:26.384Z"}'
}
```

Not everything makes it! Loaders are for _data_, and data needs to be serializable.

Some databases (like [FaunaDB][fauna]) return objects with methods that you'll want to be careful to serialize before returning from your loader. Usually this isn't a problem, but it's good to understand that your data is traveling over the network.

Additionally, Remix will call your loaders for you, in no case should you ever try to call your loader directly:

<docs-error>This will not work</docs-error>

```tsx bad nocopy
export let loader = async () => {
  return fakeDb.products.findMany();
};

export default function RouteComp() {
  let data = loader();
  // ...
}
```

[action]: ../api/conventions#action
[catch-boundary]: ../api/conventions#catchboundary
[cloudflare-kv-setup]: https://developers.cloudflare.com/workers/cli-wrangler/commands#kv
[cloudflare-kv]: https://developers.cloudflare.com/workers/learning/how-kv-works
[error-boundary]: ../api/conventions#errorboundary
[fauna]: https://fauna.com
[fetcher-submit]: ../api/remix#fetchersubmit
[loader]: ../api/conventions#loader
[prisma]: https://prisma.io
[request]: https://developer.mozilla.org/en-US/docs/Web/API/Request
[route-module]: ../api/conventions#route-module-api
[search-params-getall]: https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams/getAll
[should-reload]: ../api/conventions#unstable_shouldreload
[url-search-params]: https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams
[url]: https://developer.mozilla.org/en-US/docs/Web/API/URL
[use-submit]: ../api/remix#usesubmit
[useloaderdata]: ../api/remix#userloaderdata
