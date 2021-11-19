import { Form, json, useActionData, useLoaderData } from "remix";

import stylesUrl from "../styles/index.css";

import { getRemixResources } from "~/data.server";

/**
 * @typedef {{
 *   resources: Array<import("~/data.server").RemixResource>
 * }} LoaderData
 */

/**
 * Loader!? What the heck is a loader?
 *
 * In Remix, data from your server comes from a `loader` function defined inside
 * of a route module. Any route can export a loader function and it will only be
 * called on the server.
 *
 * @type {import("remix").LoaderFunction}
 *
 * @see {@link [Loading Data in Remix](https://docs.remix.run/v0.21/tutorial/3-loading-data)}
 * @see {@link [Loader API](https://docs.remix.run/v0.21/api/app/#loader)}
 */
export let loader = async ({ request, params, context }) => {
  /** @type {LoaderData} */
  let loaderData = {
    resources: await getRemixResources()
  };
  return json(loaderData);
};

/**
 * In addition to actions, loaders, and links, route modules can export a `meta`
 * function. This function returns an object that is used to render HTML
 * `<meta>` tags in the route. The `title` key renders the route's `<title>`
 * element.
 *
 * @type {import("remix").MetaFunction}
 *
 * @see {@link [Meta API](https://docs.remix.run/v0.21/api/app/#meta)}
 */
export let meta = () => {
  return {
    title: "Remix Starter",
    description: "Welcome to remix!"
  };
};

/**
 * @typedef {{
 *   greeting: string
 * }} ActionData
 */

/**
 * The `actions` export is a function that is called on the server when a
 * non-GET request is made (so POST, PUT, PATCH, and DELETE requests are all
 * handled here).
 *
 * @type {import("remix").ActionFunction}
 *
 * @see {@link [Actions and Data Updates](https://docs.remix.run/v0.21/tutorial/6-actions/)}
 * @see {@link [Actions API](https://docs.remix.run/v0.21/api/app/#action)}
 */
export let action = async ({ request }) => {
  // What if we encounter an error in our action?
  let formData = await request.formData();
  let name = formData.get("name");
  let unexpectedError = formData.get("nefarious");

  if (unexpectedError === "on") {
    // If we throw from our server, this error will be available for us when we
    // render our `ErrorBoundary` component!
    throw new Error("Hello from the ErrorBoundary! 👋");
  }

  // We can also return a response from our action that route components can
  // read via `useActionData`
  /** @type {ActionData} */
  let data = {
    greeting: name
      ? `Hello ${name}, from the action! 👋`
      : "Hello from the action! 👋"
  };

  return json(data);
};

/** @type {import("remix").LinksFunction} */
export let links = () => {
  return [{ rel: "stylesheet", href: stylesUrl }];
};

export default function Index() {
  /** @type {LoaderData} */
  let loaderData = useLoaderData();
  /** @type {ActionData} */
  let actionData = useActionData();

  return (
    <div className="homepage">
      <div className="homepage__intro">
        <h2>Welcome to Remix!</h2>
        <p>We're stoked that you're here. 🥳</p>
        <p>
          Feel free to take a look around the code to see how we do things
          differently. When you're ready to dive deeper, we've got plenty of
          resources to get you up-and-running quickly.
        </p>

        {/*
          This form submission will send a post request that we handle in our
          `action` export. Any route can export an action, not just the root!

          https://docs.remix.run/v0.21/tutorial/6-actions/
          */}
        <Form method="post" className="homepage__form">
          <h3>Post an Action</h3>
          <label>
            <div>What is your name?</div>
            <input name="name" type="text" />
          </label>
          <label>
            <input name="nefarious" type="checkbox" />
            <span className="sr-only">Feeling nefarious?</span>
            <span aria-hidden>😈</span>
          </label>
          <div>
            <button>Post Request!</button>
          </div>
          {actionData ? (
            <p className="homepage__greeting">{actionData.greeting}</p>
          ) : null}
        </Form>
      </div>
      <div className="homepage__resources">
        <h2>Resources</h2>
        <ul>
          {loaderData.resources.map(resource => {
            return (
              <li key={resource.id} className="homepage__resource">
                <a href={resource.url}>{resource.name}</a>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
