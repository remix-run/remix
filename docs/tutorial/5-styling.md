---
title: Styling
---

Two of the hardest parts of CSS for us have always been:

- writing styles that don't apply to unintended elements and
- knowing which styles you need for a page.

A lot of modern solutions have coupled styles to components. It's a great approach but it has a few tradeoffs we didn't want to make by default in Remix. If you'd like to read more about the motivations behind our approach, and how to use the many CSS-in-JS options out there, check out our [Styling Guide](/dashboard/docs/styling).

But for now, lets check out the default styling approach in Remix.

## Just CSS™

Remix uses plain ol' CSS with a few postcss plugins applied (so you can nest, use imports, etc.), but generally, it's just CSS.

You'll notice your project has CSS files next to routes of the same name and a top level `app/global.css`. The global css file is applied to every page, so do your resets there and anything else you want applied to every page.

## Conventional CSS

Like data loaders, if you name a stylesheet the same thing as a route, Remix will load and unload that file as the user navigates around. It sounds too simple to be as revolutionary as we've found it to be.

Because Remix has nested routes, its better than just "css for this whole page". It's "css for this route and its child routes", and then each child route can add more. When the child route is no longer on the page, it's CSS goes with it.

We've found this approach to let us keep our CSS a bit fast and loose without the mess that comes along with not adhering to strict css conventions or moving the whole workflow into JavaScript or HTML.

## Adding styles to our gists routes

Go ahead and add a `routes/team.css` and `routes/team/$member.css` and add whatever styles you want. When you're done, open the dev tools and watch the `<head>` component as you navigate around. You'll see the styles loading and unloading per route.

Since we're always using `<link/>` to add styles, we don't have a different code path for your styles in development vs. production like a lot of solutions. Your styles also always apply in the same order (order of your nested routes), so your dynamic style loading is at risk of different navigation paths.

Hope you enjoy it! If not, we will be supporting tailwind by default (we don't yet) and you can use any CSS-in-JS solution you want. Again, refer to the [Styling Guide](/dashboard/docs/styling) for details.

Bring the CSS skills you already have, we'll make sure to load and unload it when the time is right!

---

[Data Mutations](/dashboard/docs/tutorial/mutations)
