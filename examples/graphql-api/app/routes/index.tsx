import { Link, useLoaderData } from "@remix-run/react";

import { Code } from "~/components/Code";
import type { LoaderData } from "~/routes/api/characters";

/**
 * @description Here we simply re-export the loader used in our resource route
 * which allows this route to fetch from the GraphQL API directly
 */
export { loader } from "~/routes/api/characters";

/**
 * @description This route demonstrates fetching a list of characters from
 * a GraphQL API.
 */
export default function Index() {
  const loader = useLoaderData<LoaderData>();
  const { data } = loader;

  const characters = data.characters.results ?? [];

  return (
    <main className="ui-main">
      <h1>Ex: GraphQL API</h1>
      <Code data={data} summary="Loader Data" />
      <p>
        Awesome, you've successfully queried a GraphQL API. Expand the details
        above to see what the Remix loader returned.
      </p>
      <hr style={{ margin: "40px auto" }} />
      {characters.map((character) => {
        if (!character) return null;

        const { image } = character;
        const to = `/character/${character.id}`;

        return (
          <Link key={character.id} style={{ display: "flex", gap: 16 }} to={to}>
            {image && <img alt="" height={40} src={image} width={40} />}
            <h2>{character.name}</h2>
          </Link>
        );
      })}
    </main>
  );
}
