---
title: Philosophy
---

# Philosophy

We've worked on a lot of different types of websites: static sites for credit card companies, social media platforms, learning management systems, content management systems, and ecommerce to name a few. We've also trained hundreds of development teams with our training company, [React Training](https://reacttraining.com). These teams build websites we all use regularly. Based on our personal development experience and our client's products, we built Remix to be able to handle the dynamic nature of both the front end and the back end of a web project.

The Remix philosophy can be summed up in four points:

1. Embrace the server/client model, including seperation of source code from content/data.
2. Work with, not against, the foundations of the web: Browsers, HTTP, and HTML. It’s always been good and it's gotten _really good_ in the last few years.
3. Use JavaScript to augment the user experience by emulating browser behavior
4. Don't over-abstract the underlying technologies

## Server/Client Model

You can make your server fast, but you can't control the user's network.

With today's web infrastructure you don't need static files to make your server fast. This very site has a time to first byte that's hard to beat and it's completely fresh. We leveraged distributed systems at the edge instead of static builds. We can fix a typo and the site reflects it within seconds: no rebuilds, no redeploys, not even HTTP caching.

What you can't make fast is the user's network. The only thing you can do is **decrease the amount of stuff you send over the network**. Less JavaScript, less JSON, less CSS. This is easiest when you have a server that you can move the logic to, and a framework that favors progressive enhancement.

There are a lot of ways Remix helps you send less stuff over the network and we hope to talk about all of them, but for now here's one: fetching a list of records.

Consider [the Github Gist API](https://api.github.com/gists). This payload is 75kb unpacked and 12kb over the network compressed. If you fetch it in the browser you make the user download all of it. It might look like this:

```js
export default function Gists() {
  let gists = useSomeFetchWrapper(
    "https://api.github.com/gists"
  );
  if (!gists) {
    return <Skeleton />;
  }
  return (
    <ul>
      {gists.map(gist => (
        <li>
          <a href={gist.html_url}>
            {gist.description}, {gist.owner.login}
          </a>
          <ul>
            {Object.keys(gist.files).map(key => (
              <li>{key}</li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}
```

With Remix, you can filter down the data _on the server_ before sending it to the user:

```js [1-11]
export async function loader() {
  let res = await fetch("https://api.github.com/gists");
  let json = await res.json();
  return json.map(gist => {
    return {
      url: gist.html_url,
      files: Object.keys(gist.files),
      owner: gist.owner.login
    };
  });
}

export default function Gists() {
  let gists = useLoaderData();
  return (
    <ul>
      {gists.map(gist => (
        <li>
          <a href={gist.url}>
            {gist.description}, {gist.owner}
          </a>
          <ul>
            {gist.files.map(key => (
              <li>{key}</li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}
```

This drops the payload from 12kB compressed, 75kB total to 1.8kB compressed, 3.8kB total. That's 20x smaller! We also don't need to ship all the skeleton UI because Remix fetches (and can prefetch) this data before the page is rendered. This is just one example of how embracing the server/client model helps us speed up our apps _by sending less_ over the user's network.

## Web Standards, HTTP, and HTML

These technologies have been around for a long time. They're solid. Remix embraces them completely. Combining HTTP Caching, Remix's focus on URLs for assets, dynamic server rendering, and HTML features like `<link rel=prefetch>`, you have all the tools to make your app snappy. Browsers and HTML got really good in the 20+ years we've been using it.

We try to keep the Remix API to a minimum, and instead work with web standards. For example, instead of inventing our own `req/res` API, or even using Node's API, Remix (and your Remix apps) work with the [Web Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) objects. This means as you get good at Remix, you're really just getting good at web standards like [`Request`](https://developer.mozilla.org/en-US/docs/Web/API/Request), [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response), [`URLSearchParams`](https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams) and [`URL`](https://developer.mozilla.org/en-US/docs/Web/API/URL). All of these are already in your browser, now they're on your server no matter where you deploy to.

When doing data mutations, we augmented HTML forms. When we prefetch data and assets for the next page, we use `<link rel="prefetch">` and let the browser deal with all of the complexity of caching a resource. If the browser has an API for a use case, Remix uses it.

## Augment the UX with JavaScript

While most recent frameworks only have read APIs for data, Remix has both read and write. HTML `<form>` has been the staple for data mutations since the 90s, Remix embraces and augments that API. This enables the data layer of a Remix app to function with _or without_ JavaScript on the page.

Adding JavaScript allows Remix to speed up the user experience in two ways on a page transition:

1. Not downloading and evaluating JavaScript and CSS assets
2. Only fetching data for the parts of the layout that change

Also, with JavaScript on the page, Remix can provide the developer with APIs to make the UX nicer on page transitions:

1. Add nicer pending UI than the browser's spinning favicon
2. Add optimistic UI on data actions (create, read, update, delete, etc.)

Finally, since data mutation is built into Remix, it knows when to refetch data that could have been changed after a mutation, ensuring different parts of your page don’t get out of sync.

The point is not so much to make the app work without JavaScript, it's more about keeping the simpler client/server model. Being able to leave JavaScript at the door is a nice side-effect.

## Don’t Over Abstract

This one is more for us. We've been educators for the 5 years before Remix. Our tagline is _Build Better Websites_. We also think of it with a little extra on the end: _Build Better Websites, Sometimes with Remix_. If you get good at Remix, you will accidentally get good at web development in general.

The APIs Remix provides makes it convenient to use the fundamental Browser/HTTP/JavaScript, but those technologies are not hidden from you.

For example, getting CSS on specific layouts in your app is done with a route module method named `links`, where you return an array of objects with the values of an HTML `<link>` tag. We abstract enough to optimize the performance of your app (they're objects so we can dedupe them, preload them) without hiding the underlying technology. Learn how to prefetch assets in Remix with `links` and you've learned how to prefetch assets in any website.

Get good at Remix, get good at the web.
