import { ApolloError } from 'apollo-server-errors';
import { LoaderFunction, useLoaderData } from 'remix';
import { CharacterList } from '~/components/CharacterList';
import { Code } from '~/components/Code';
import { fetchFromGraphQL } from '~/utils/index';
import { Character } from '~/generated/types';

type LoaderData = {
  data: {
    characters: {
      results: Character[];
    }
  },
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

  const res = await fetchFromGraphQL('query', getCharactersQuery, { page: 1 });
  return res.json()
}

/**
 * @description tbd...
 */
export default function () {
  const loader = useLoaderData<LoaderData>();
  const { data } = loader;

  return (
    <main className="ui-main">
      <h1>Ex: GraphQL API</h1>
      <Code data={data} summary="Loader Data" />
      <p>
        Awesome, you've successfully queried a GraphQL API. Expand the details
        above to see what the Remix loader returned.
      </p>
      <hr style={{ margin: "40px auto" }} />
      <CharacterList data={data.characters.results ?? []} />
    </main>
  );
};
