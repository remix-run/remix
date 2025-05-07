---
title: Introduction, Technical Explanation
order: 1
---

# Introduction, Technical Explanation

Built on top of [React Router][react_router], Remix is four things:

1. A compiler
2. A server-side HTTP handler
3. A server framework
4. A browser framework

## Compiler

Everything in Remix starts with the compiler: `remix vite:build`. Using [Vite], this creates a few things:

1. A server HTTP handler, usually in `build/server/index.js` (it's configurable) that includes all routes and modules together to be able to render on the server and handle any other server-side requests for resources.
2. A browser build, usually in `build/client/*`. This includes automatic code splitting by route, fingerprinted asset imports (like CSS and images), etc. Anything needed to run an application in the browser.
3. An asset manifest. Both the client and the server use this manifest to know the entire dependency graph. This is useful for preloading resources in the initial server render as well as prefetching them for client-side transitions. This is how Remix is able to eliminate the render+fetch waterfalls so common in web apps today.

With these build artifacts, an application can be deployed to any hosting service that runs JavaScript.

## HTTP Handler and Adapters

While Remix runs on the server, it is not actually a server. It's just a handler that is given to an actual JavaScript server.

It's built on the [Web Fetch API][fetch] instead of Node.js. This enables Remix to run in any Node.js server like [Vercel][vercel], [Netlify][netlify], [Architect][arc], etc. as well as non-Node.js environments like [Cloudflare Workers][cf] and [Deno Deploy][deno].

This is what Remix looks like when running in an express app:

```ts lines=[2,6-9]
const remix = require("@remix-run/express");
const express = require("express");

const app = express();

app.all(
  "*",
  remix.createRequestHandler({
    build: require("./build/server"),
  })
);
```

Express (or Node.js) is the actual server, Remix is just a handler on that server. The `"@remix-run/express"` package is called an adapter. Remix handlers are server agnostic. Adapters make them work for a specific server by converting the server's request/response API into the Fetch API on the way in, and then adapting the Fetch Response coming from Remix into the server's response API. Here's some pseudocode of what an adapter does:

```ts
export function createRequestHandler({ build }) {
  // creates a Fetch API request handler from the server build
  const handleRequest = createRemixRequestHandler(build);

  // returns an express.js specific handler for the express server
  return async (req, res) => {
    // adapts the express.req to a Fetch API request
    const request = createRemixRequest(req);

    // calls the app handler and receives a Fetch API response
    const response = await handleRequest(request);

    // adapts the Fetch API response to the express.res
    sendRemixResponse(res, response);
  };
}
```

Real adapters do a bit more than that, but that's the gist of it. Not only does this enable you to deploy Remix anywhere, but it also lets you incrementally adopt it in an existing JavaScript server since you can have routes outside of Remix that your server continues to handle before getting to Remix.

Additionally, if Remix doesn't have an adapter for your server already, you can look at the source of one of the adapters and build your own.

## Server Framework

If you're familiar with server-side MVC web frameworks like Rails and Laravel, Remix is the View and Controller, but it leaves the Model up to you. There are a lot of great databases, ORMs, mailers, etc. in the JavaScript ecosystem to fill that space. Remix also has helpers around the Fetch API for cookie and session management.

Instead of having a split between View and Controller, Remix Route modules take on both responsibilities.

Most server-side frameworks are "model focused". A controller manages _multiple URLs_ for a single model.

Remix is _UI focused_. Routes can handle an entire URL or just a segment of the URL. When a route maps to just a segment, the nested URL segments become nested layouts in the UI. In this way, each layout (view) can be its own controller and then Remix will aggregate the data and components to build the complete UI.

More often than not, a Remix route module can contain both the UI and the interactions with the models in the same file, which leads to really nice developer ergonomics and productivity.

Route modules have three primary exports: `loader`, `action`, and `default` (component).

```tsx
// Loaders only run on the server and provide data
// to your component on GET requests
export async function loader() {
  return json(await db.projects.findAll());
}

// The default export is the component that will be
// rendered when a route matches the URL. This runs
// both on the server and the client
export default function Projects() {
  const projects = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <div>
      {projects.map((project) => (
        <Link key={project.slug} to={project.slug}>
          {project.title}
        </Link>
      ))}

      <Form method="post">
        <input name="title" />
        <button type="submit">Create New Project</button>
      </Form>
      {actionData?.errors ? (
        <ErrorMessages errors={actionData.errors} />
      ) : null}

      {/* outlets render the nested child routes
          that match the URL deeper than this route,
          allowing each layout to co-locate the UI and
          controller code in the same file */}
      <Outlet />
    </div>
  );
}

// Actions only run on the server and handle POST
// PUT, PATCH, and DELETE. They can also provide data
// to the component
export async function action({
  request,
}: ActionFunctionArgs) {
  const form = await request.formData();
  const errors = validate(form);
  if (errors) {
    return json({ errors });
  }
  await createProject({ title: form.get("title") });
  return json({ ok: true });
}
```

You can actually use Remix as just a server-side framework without using any browser JavaScript at all. The route conventions for data loading with `loader`, mutations with `action` and HTML forms, and components that render at URLs, can provide the core feature set of a lot of web projects.

In this way, **Remix scales down**. Not every page in your application needs a bunch of JavaScript in the browser and not every user interaction requires any extra flair than the browser's default behaviors. In Remix, you can build it the simple way first, and then scale up without changing the fundamental model. Additionally, the majority of the app works before JavaScript loads in the browser, which makes Remix apps resilient to choppy network conditions by design.

If you're not familiar with traditional back-end web frameworks, you can think of Remix routes as React components that are already their own API route and already know how to load and submit data to themselves on the server.

## Browser Framework

Once Remix has served the document to the browser, it "hydrates" the page with the browser build's JavaScript modules. This is where we talk a lot about Remix "emulating the browser".

When the user clicks a link, instead of making a round trip to the server for the entire document and all the assets, Remix simply fetches the data for the next page and updates the UI.

Additionally, when users submit a `<Form>` to update data, instead of doing a normal HTML document request, the browser runtime will make a fetch to the server instead and automatically revalidate all data on the page and update it with React.

This has many performance benefits over making a full-document request:

1. Assets don't need to be re-downloaded (or pulled from cache)
2. Assets don't need to be parsed by the browser again
3. The data fetched is much smaller than the entire document (sometimes orders of magnitude)
4. Because Remix enhances HTML APIs (`<a>` and `<form>`), your app tends to work even before JavaScript has loaded on the page

Remix also has some built in optimizations for client-side navigation. It knows which layouts will persist between the two URLs, so it only fetches the data for the ones that are changing. A full document request would require all data to be fetched on the server, wasting resources on your back end and slowing down your app.

This approach also has UX benefits like not resetting the scroll position of a sidebar nav and allowing you to move focus to something that makes more sense than the top of the document.

Remix can also prefetch all resources for a page when the user is about to click a link. The browser framework knows about the compiler's asset manifest. It can match the URL of the link, read the manifest, and then prefetch all data, JavaScript modules, and even CSS resources for the next page. This is how Remix apps feel fast even when networks are slow.

Remix then provides client side APIs, so you can create rich user experiences without changing the fundamental model of HTML and browsers.

Taking our route module from before, here are a few small, but useful UX improvements to the form that you can only do with JavaScript in the browser:

1. Disable the button when the form is being submitted
2. Focus the input when server-side form validation fails
3. Animate in the error messages

```tsx lines=[4-6,8-12,23-26,30-32] nocopy
export default function Projects() {
  const projects = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const { state } = useNavigation();
  const busy = state === "submitting";
  const inputRef = React.useRef();

  React.useEffect(() => {
    if (actionData.errors) {
      inputRef.current.focus();
    }
  }, [actionData]);

  return (
    <div>
      {projects.map((project) => (
        <Link key={project.slug} to={project.slug}>
          {project.title}
        </Link>
      ))}

      <Form method="post">
        <input ref={inputRef} name="title" />
        <button type="submit" disabled={busy}>
          {busy ? "Creating..." : "Create New Project"}
        </button>
      </Form>

      {actionData?.errors ? (
        <FadeIn>
          <ErrorMessages errors={actionData.errors} />
        </FadeIn>
      ) : null}

      <Outlet />
    </div>
  );
}
```

What's most interesting about this code sample is that it is **only additive**. The entire interaction is still fundamentally the same thing and even works at a basic level before JavaScript loads, the only difference is the user feedback will be provided by the browser (spinning favicon, etc.) instead of the app (`useNavigation().state`).

Because Remix reaches into the controller level of the backend, it can do this seamlessly.

And while it doesn't reach as far back into the stack as server-side frameworks like Rails and Laravel, it does reach way farther up the stack into the browser to make the transition from the back end to the front end seamless.

For example. Building a plain HTML form and server-side handler in a back-end heavy web framework is just as easy to do as it is in Remix. But as soon as you want to cross over into an experience with animated validation messages, focus management, and pending UI, it requires a fundamental change in the code. Typically, people build an API route and then bring in a splash of client-side JavaScript to connect the two. With Remix, you simply add some code around the existing "server side view" without changing how it works fundamentally. The browser runtime takes over the server communication to provide an enhanced user experience beyond the default browser behaviors.

We borrowed an old term and called this Progressive Enhancement in Remix. Start small with a plain HTML form (Remix scales down) and then scale the UI up when you have the time and ambition.

[vite]: https://vitejs.dev
[cf]: https://workers.cloudflare.com/
[deno]: https://deno.com/deploy/docs
[fetch]: https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API
[vercel]: https://vercel.com
[netlify]: https://netlify.com
[arc]: https://arc.codes
[react_router]: https://reactrouter.com
