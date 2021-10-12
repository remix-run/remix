---
title: Routing
description: In Remix, routes are more than just the page. When routes are nested we're able to know a little more about your app than just a single page, and do a lot more because of it.
---

Let's talk about a concept in Remix that is critical to understand to get the most out of it: Nested Routes.

We consider nested routes our (not so) secret weapon. This feature of React Router allows Remix to know what you're going to render before you even render it. This lets us fetch data, stylesheets, and modules for the next page, or just the changed part of the page.

## What are nested routes?

Let's consider a UI to help us out. Imagine you're building invoicing software and the UI looks something like this:

TODO: ADD THE SVG WITHOUT ANIMATION

Just looking at the boxes it's pretty easy to indentify which pieces of the URL match which parts of the UI. As the user clicks between "Invoices | Projects | Customers", the top nav persists while the screen below changes. Down one level, as the user clicks between invoices the top nav and the invoice nav persist, while the invoice screen swaps out new data. And finally, as the user clicks between "Details | Activity", the details or activity screen will swap out for each other, but the rest of the UI remains unchanged.

It's a nested layout tree. In Remix, we call every one of these layouts a "route". You might be used to routes that have a 1:1 component-to-url mapping. In Remix, a single URL can match multiple, nested routes.

## Defining nested routes

Nested folders create nested URLs. So if you put something in `app/routes/invoices/$id.js` that creates a URL like "/invoices/123". The URL maps identically to the file system. But there's more--nested routes in the file system create nested layouts in the UI. Let's check it out in our example app.

TODO: ADD THE ANIMATED EXAMPLE

The root layout of this UI is "App.js" and it matches up with the domain name in the URL. This isn't a route yet, this is just the layout, it renders all the time, wrapping the entire UI. It holds the top nav with the links to "Invoices | Projects | Customers".

The next segment of the URL, and our next layout, is a file in `app/routes/invoices.js`. This controls the invoices on the left and wraps the details/activity views. This is our first layout route that matched the URL.

The nesting gets deeper as we look at the `app/routes/invoices/$id.js` component. This is another layout route that renders the Invoice number and links to the "Details | Activity" pages.

And finally, our final route, `app/routes/invoices/$id/activity.js`. Sometime we call these routes that aren't layouts "leaf routes".

## What it means

Because we know all of your routes up front, and we can match them before we render anything--we now know the most important components that are about to render before we render. This gives us fine-grained control over style, data, and module loading that you just can't get without nested routes.

In fact, when the user clicks on "Details" and "Activity", the only data we fetch is the data for changed portion of the app, rather than for every parent layout above it. It also gives us powerful control over which stylesheets to load and unload, which is a whole new set of tradeoffs for css that we find to be excellent.

For years we've been trying to move all of this kind of thing to the components, but that gets difficult because you don't know what you're going to render until you render it! How can you preload data? How can you know which styles to apply, or which modules to start loading? Nested routes mapping to nested layouts gives us a cheat code. We mostly know what is about to be rendered, so we coupled your async requirements there. When the location changes, we can fetch the modules, styles, and data in parallel before the update (and before the server render, gotta get those data-driven meta tags!).

## Index Routes

An Index Route is the route that renders when the layout's path is matched exactly. Again, from our example, our routes folder would look something like this:

```
├── invoices
│   └── $id.js
└── invoices.js
```

So what renders at `https://example.com/invoices`? At the moment, nothing, it would look like this:

## TODO: `<ExampleApp hideInvoice step={0} />`

If we add the file `invoices/index.js`, then that new index route will render at the path `/invoices` inside of the `invoices.js` component.

```
├── invoices
│   ├── $id.js
│   └── index.js
└── invoices.js
```

The component tree would be:

```tsx
<App>
  <Invoices>
    <InvoicesIndex />
  </Invoices>
</App>
```

## Nested URLs without nesting layouts

If you want to add slashes to the URL, but not create a layout hierarchy, use `.` in the file name instead of putting the file into folders. For example, if you wanted the URL `/invoices/new` but didn't want it to be wrapped in the `app/routes/invoices.js` layout, don't put it in the `app/routes/invoices/new.js`, make a file named `app/routes/invoices.new.js`. The `.` will be changed to a `/` in the url.

If we created the file `app/routes/invoices.new.js` the component tree looks like this:

```tsx
<App>
  <InvoicesNew />
</App>
```

If we created the file `app/routes/invoices/new.js`, the component tree looks like this:

```tsx
<App>
  <Invoices>
    <New />
  </Invoices>
</App>
```

Nested files = nested urls + nested layouts.

Flat files = nested urls + no layouts.

You can introduce nesting or non-nesting at any level of your routes, like `app/routes/invoices/$id.edit.js`, which matches the URL `/invoices/123/edit` but does not create nesting inside of `$id.js`.

## Review

Assuming the following `app/routes/` directory:

```
├── 404.js
├── contact.js
├── invoices
│   ├── $id.edit.js
│   ├── $id.js
│   └── late.js
├── invoices.js
└── invoices.new.js
```

Let's look at a few URLs and what the component tree looks like.

| URL                | Component Heirarchy                                         |
| ------------------ | ----------------------------------------------------------- |
| /                  | `App.js > routes/index.js`                                  |
| /invoices          | `App.js > routes/invoices.js > routes/invoices/index.js`    |
| /invoices/late     | `App.js > routes/invoices.js > routes/invoices/late.js`     |
| /invoices/123      | `App.js > routes/invoices.js > routes/invoices/$id.js`      |
| /invoices/123/edit | `App.js > routes/invoices.js > routes/invoices/$id.edit.js` |
| /invoices/no/match | `App.js > routes/404.js`                                    |
| /invoices/new      | `App.js > routes/invoices.new.js`                           |
| /contact           | `App.js > routes/contact.js`                                |

Nested files are nested layouts. Flat files are flat layouts.
