---
title: Remix Philosophy
---

We've worked on a lot of different types of websites: static sites for credit card companies, social media platforms, learning management systems, content management systems, and ecommerce to name a few. We've also trained hundreds of development teams with our training company, [React Training](https://reacttraining.com). These teams build websites we all use regularly. Based on our personal development experience and our client's products, we built Remix to be able to handle the dynamic nature of both the front-end and the backend of a web project.

The Remix philosophy can be summed up in four points:

1. Embrace the server/client model, including seperation of source code from content/data.
2. Work with, not against, the foundations of the web: Browsers, HTTP, and HTML.
3. Use JavaScript to augment the user experience by emulating browser behavior
4. Don't over-abstract the underlying technologies

**Server/Client Model**

When a page has a data dependency, Remix favors fetching and processing that data on the server at request time, rather than making it a part of the build/deploy pipeline. Couple this with thoughtful HTTP caching techniques, CDNs, and built-in Browser/HTML features to achieve optimal performance, for both the users and you, the developer.

**Browsers, HTTP, and HTML**

These two technologies have been around for a long time. They're solid. Remix embraces them completely. Combining HTTP Caching, Remix's focus on URLs for assets, dynamic server rendering, and HTML features like `<link rel=prefetch>`, you have all the tools to make your app snappy. Browsers and HTML got really good in the 20+ years we've been using it.

**Augment the UX with JavaScript**

The data layer of a Remix app functions with or without JavaScript. Adding JavaScript allows Remix to speed up the user experience in two ways on a page transition:

1. Not downloading and evaluating JavaScript and CSS assets
2. Only fetching data for the parts of the layout that change

Additionally, with JavaScript on the page, Remix can provide the developer with APIs to make the UX nicer on page transitions:

1. Add nicer pending UI than the browser's spinning favicon
2. Add optimistic UI on data actions (create, read, update, delete, etc.)

The point is not so much to make the app work without JavaScript, it's more about keeping the simpler client/server model. Being able to leave JavaScript at the door is a nice side-effect.

**Don't over-abstract the underlying technologies**

This one is more for us. We've been educators for the 5 years before Remix. Our tagline is _Build Better Websites_. We also think of it with a little extra on the end: _Build Better Websites, Sometimes with Remix_. If you get good at Remix, you will accidentally get good at web development in general.

The APIs Remix provides makes it convenient to use the fundamental Browser/HTTP/JavaScript, but those technologies are not hidden from you.

For example, getting CSS on specific layouts in your app is done with a route module method named `links`, where you return an array of objects with the values of an HTML `<link>` tag. We abstract enough to optimize the performance of your app (they're objects so we can dedupe them, preload them) without hiding the underlying technology. Learn how to prefetch assets in Remix with `links` and you've learned how to prefetch assets in any website.

---

Remix is unlike anything you've used before. Now get out of here and start building better websites!
