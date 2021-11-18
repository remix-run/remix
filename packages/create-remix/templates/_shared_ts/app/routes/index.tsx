import { useLoaderData, json } from "remix";
import type { MetaFunction, LinksFunction, LoaderFunction } from "remix";

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

export let links: LinksFunction = () => {
  return [{ rel: "stylesheet", href: stylesUrl }];
};

export default function Index() {
  let data = useLoaderData<LoaderData>();

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
      </div>
      <div className="homepage__resources">
        <h2>Resources</h2>
        <ul>
          {data.resources.map(resource => {
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
