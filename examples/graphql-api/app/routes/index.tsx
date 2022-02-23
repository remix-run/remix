import { Link, useLoaderData } from "remix";
import type { ApolloError } from "apollo-server-errors";
import type { LoaderFunction } from "remix";

import { Code } from "~/components/Code";
import { fetchFromGraphQL } from "~/utils/index";
import type { Characters } from "~/generated/types";

type LoaderData = {
  data: { characters: Characters };
  errors?: ApolloError[];
};

export const loader: LoaderFunction = async () => {
  const getCharactersQuery = `
    fragment CharacterFields on Character {
      gender
      id
      image
      name
      origin {
        dimension
        name
        type
      }
      species
      status
      type
    }

    fragment GetCharactersFields on Characters {
      results {
        ...CharacterFields
      }
    }

    query getCharacters($page: Int) {
      characters(page: $page) {
        ...GetCharactersFields
      }
    }
  `;

  const res = await fetchFromGraphQL(getCharactersQuery, { page: 1 });

  return res.json();
};

/**
 * @description This route demonstrates fetching a list of characters from
 * a GraphQL API.
 */
export default function () {
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
      {characters.map(character => {
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
