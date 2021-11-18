import type {
  ActionFunction,
  MetaFunction,
  LinksFunction,
  LoaderFunction
} from "remix";
import { Form, json, useActionData, useLoaderData } from "remix";

import stylesUrl from "../styles/index.css";

import { getRemixResources } from "~/data.server";
import type { RemixResource } from "~/data.server";

interface LoaderData {
  resources: Array<RemixResource>;
}

/**
 * Loader!? What the heck is a loader?
 *
 * In Remix, data from your server comes from a `loader` function defined inside
 * of a route module. Any route can export a loader function and it will only be
 * called on the server.
 *
 * @see {@link [Loading Data in Remix](https://docs.remix.run/v0.21/tutorial/3-loading-data)}
 * @see {@link [Loader API](https://docs.remix.run/v0.21/api/app/#loader)}
 */
export let loader: LoaderFunction = async ({ request, params, context }) => {
  let loaderData: LoaderData = {
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
 * @see {@link [Meta API](https://docs.remix.run/v0.21/api/app/#meta)}
 */
export let meta: MetaFunction = () => {
  return {
    title: "Remix Starter",
    description: "Welcome to remix!"
  };
};

interface ActionData {
  greeting: string;
}

/**
 * The `actions` export is a function that is called on the server when a
 * non-GET request is made (so POST, PUT, PATCH, and DELETE requests are all
 * handled here).
 *
 * @see {@link [Actions and Data Updates](https://docs.remix.run/v0.21/tutorial/6-actions/)}
 * @see {@link [Actions API](https://docs.remix.run/v0.21/api/app/#action)}
 */
export let action: ActionFunction = async ({ request }) => {
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
  let data: ActionData = {
    greeting: name
      ? `Hello ${name}, from the action! 👋`
      : "Hello from the action! 👋"
  };

  return json(data);
};

export let links: LinksFunction = () => {
  return [{ rel: "stylesheet", href: stylesUrl }];
};

export default function Index() {
  let loaderData = useLoaderData<LoaderData>();
  let actionData = useActionData<ActionData>();

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
