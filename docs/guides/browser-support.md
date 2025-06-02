---
title: Browser Support
---

# Browser Support

Remix only runs in browsers that support [ES Modules][esm-browsers].

Usually teams are concerned about IE11 support when asking this question. Note that [Microsoft itself has stopped supporting this browser][msie] for their web applications, and it's probably time for you, too.

However, thanks to first-class support for [Progressive Enhancement][pe], Remix apps can support browsers as old as Netscape 1.0! This works because Remix is built on the foundations of the web: HTML, HTTP, and browser behavior. By following Remix conventions, your app can work at a baseline level for IE11, while still providing a highly interactive SPA experience for modern browsers. It takes little effort on your part to achieve this, too.

Here's how it works. The Remix `<Scripts/>` component renders module script tags like this:

```html
<script type="module" src="..." />
```

Older browsers ignore it because they don't understand the `type`, so no JavaScript is loaded. Links, loaders, forms, and actions still work because they are built on the foundations of HTML, HTTP, and browser behavior. Modern browsers will load the scripts, providing enhanced SPA behavior with faster transitions and the enhanced UX of your application code.

## Does Remix implement CSRF protection?

Remix cookies are configured to `SameSite=Lax` by default which is platform built-in protection against CSRF, if you need to support old browsers (IE11 or older) that doesn't support `SameSite=Lax` you would have to implement CSRF protection yourself or use a library that implements it.

[pe]: https://en.wikipedia.org/wiki/Progressive_enhancement
[esm-browsers]: https://caniuse.com/es6-module
[msie]: https://techcommunity.microsoft.com/t5/microsoft-365-blog/microsoft-365-apps-say-farewell-to-internet-explorer-11-and/ba-p/1591666
