---
title: Cookies
---

A [cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies) is a small piece of information that your server sends someone in a HTTP response that their browser will send back on subsequent requests. This technique is a fundamental building block of many interactive websites that adds state so you can build authentication (see [sessions](../sessions)), shopping carts, user preferences, and many other features that require remembering who is "logged in".

Remix's `Cookie` interface provides a logical, reusable container for cookie metadata.

## Using cookies

In Remix, you will typically work with cookies in your `loader` and/or `action` functions (see <Link to="../mutations">mutations</Link>) since those are the places where you need to read and write data.

Let's say you have a banner on your e-commerce site that prompts users to check out the items you currently have on sale. The banner spans the top of your homepage, and includes a button on the side that allows the user to dismiss the banner so they don't see it for at least another week.

First, create a cookie:

```js
// app/cookies.js
import { createCookie } from "@remix-run/data";

export let userPrefs = createCookie("user-prefs", {
  maxAge: 604_800 // one week
});
```

Then, you can `import` the cookie and use it in your `loader` and/or `action`. The `loader` in this case just checks the value of the user preference so you can use it in your component for deciding whether or not to render the banner. When the button is clicked, the `<form>` calls the `action` on the server and reloads the page without the banner.

**Note:** We recommend (for now) that you create all the cookies your app needs in `app/cookies.js` and `import` them into your route modules. This allows the Remix compiler to correctly prune these imports out of the browser build where they are not needed. We hope to eventually remove this caveat.

```js
// app/routes/index.js
import React from "react";
import { useRouteData } from "@remix-run/react";
import { json, redirect } from "@remix-run/data";

import { userPrefs as cookie } from "../cookies";

export function loader({ request }) {
  let value = cookie.parse(request.headers.get("Cookie")) || {};
  let showBanner = "showBanner" in value ? value.showBanner : true;
  return { showBanner };
}

export async function action({ request }) {
  let value = cookie.parse(request.headers.get("Cookie")) || {};
  let bodyParams = new URLSearchParams(await request.text());

  if (bodyParams.get("bannerVisibility") === "hidden") {
    value.showBanner = false;
  }

  return redirect("/", {
    headers: {
      "Set-Cookie": cookie.serialize(value)
    }
  });
}

export default function Home() {
  let { showBanner } = useRouteData();

  return (
    <div>
      {showBanner && (
        <div>
          <span>
            <Link to="../sale">Don't miss our sale!</Link>
          </span>
          <form method="POST">
            <button name="bannerVisibility" value="hidden">
              Hide
            </button>
          </form>
        </div>
      )}
      <h1>Welcome!</h1>
    </div>
  );
}
```

## Cookie attributes

Cookies have [several attributes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie#attributes) that control when they expire, how they are accessed, and where they are sent. Any of these attributes may be specified either in `createCookie(name, options)`, or during `serialize()` when the `Set-Cookie` header is generated.

```js
let cookie = createCookie("user-prefs", {
  // These are defaults for this cookie.
  domain: "remix.run",
  path: "/",
  sameSite: "lax",
  httpOnly: true,
  secure: true,
  expires: new Date(Date.now() + 60),
  maxAge: 60
});

// You can either use the defaults:
cookie.serialize(userPrefs);

// Or override individual ones as needed:
cookie.serialize(userPrefs, { sameSite: "strict" });
```

Please read [more info about these attributes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie#attributes) to get a better understanding of what they do.

## Signing cookies

It is possible to sign a cookie to automatically verify its contents when it is received. Since it's relatively easy to spoof HTTP headers, this is a good idea for any information that you do not want someone to be able to fake, like authentication information (see [sessions](../sessions)).

To sign a cookie, provide one or more `secrets` when you first create the cookie:

```js
let cookie = createCookie("user-prefs", {
  secrets: ["s3cret1"]
});
```

Cookies that have one or more `secrets` will be stored and verified in a way that ensures the cookie's integrity.

Secrets may be rotated by adding new secrets to the front of the `secrets` array. Cookies that have been signed with old secrets will still be decoded successfully in `cookie.parse()`, and the newest secret (the first one in the array) will always be used to sign outgoing cookies created in `cookie.serialize()`.

```js
// app/cookies.js
let cookie = createCookie("user-prefs", {
  secrets: ["n3wsecr3t", "olds3cret"]
});

// in your route module...
export function loader({ request }) {
  let oldCookie = request.headers.get("Cookie");
  // oldCookie may have been signed with "olds3cret", but still parses ok
  let value = cookie.parse(oldCookie);

  new Response("...", {
    headers: {
      // Set-Cookie is signed with "n3wsecr3t"
      "Set-Cookie": cookie.serialize(value)
    }
  });
}
```

## Cookie API

### `cookie.name`

The name of the cookie, used in `Cookie` and `Set-Cookie` HTTP headers.

### `cookie.parse()`

Extracts and returns the value of this cookie in a given `Cookie` header.

```js
let value = cookie.parse(request.headers.get("Cookie"));
```

### `cookie.serialize()`

Serializes a value and combines it with this cookie's options to create a `Set-Cookie` header, suitable for use in an outgoing `Response`.

```js
new Response("...", {
  headers: {
    "Set-Cookie": cookie.serialize({ showBanner: true })
  }
});
```

### `cookie.isSigned`

Will be `true` if the cookie uses any `secrets`, `false` otherwise.

```js
let cookie = createCookie("user-prefs");
console.log(cookie.isSigned); // false

cookie = createCookie("user-prefs", { secrets: ["soopersekrit"] });
console.log(cookie.isSigned); // true
```

### `cookie.expires`

The `Date` on which this cookie expires. Note that if a cookie has both `maxAge` and `expires`, this value will the date at the current time plus the `maxAge` value since `Max-Age` takes precedence over `Expires`.

```js
let cookie = createCookie("user-prefs", {
  expires: new Date("2021-01-01")
});

console.log(cookie.expires); // "2020-01-01T00:00:00.000Z"
```
