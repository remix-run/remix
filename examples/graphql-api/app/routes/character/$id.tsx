import { ApolloError } from 'apollo-server-errors';
import { Link, LoaderFunction, useLoaderData } from 'remix';
import { CharacterDetail } from '~/components/CharacterDetail';
import { Code } from '~/components/Code';
import { fetchFromGraphQL } from '~/utils/index';
import { Character } from '~/generated/types';

type LoaderData = {
  data: { character: Character; },
  errors?: ApolloError[];
};

export const loader: LoaderFunction = async (args) => {
  const { params } = args;

  const getCharacterQuery = `
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

      query getCharacter($id: ID!) {
        character(id: $id) {
          ...CharacterFields
        }
      }
    `;

  const res = await fetchFromGraphQL(getCharacterQuery, { id: params.id });
  return res.json()
}

/**
 * @description This route fetches the details of a single character using
 * the Remix loader & route params.
 */
export default function () {
  const loader = useLoaderData<LoaderData>();
  const { data } = loader;

  return (
    <main className="ui-main">
      <h1>Ex: GraphQL fetch with params</h1>
      <Code data={loader} summary="Loader Data" />
      <p>
        Awesome, you've successfully queried a GraphQL API. Expand the details
        above to see what the Remix loader returned.
      </p>
      <hr style={{ margin: "40px auto" }} />
      {data?.character && <CharacterDetail data={data.character} />}
      <div className="links" style={{ marginTop: 40 }}>
        <Link to="/" >
          View all characters
        </Link>
        <Link to="/character/error">
          Trigger an error
        </Link>
      </div>
    </main>
  );
};
