import { Link, LoaderFunction, useLoaderData } from 'remix';
import { ApolloError } from 'apollo-server-errors';
import { Code } from '~/components/Code';
import { fetchFromGraphQL } from '~/utils/index';
import { Character } from '~/generated/types';

type LoaderData = {
  data: { character: Character; },
  errors?: ApolloError[];
};

export const loader: LoaderFunction = async (_args) => {
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

  // ⚠️ Force an error using an invalid ID
  const invalidId = 8675309;

  const res = await fetchFromGraphQL('query', getCharacterQuery, { id: invalidId });
  return res.json()
}

/**
 * @description This route triggers an error of type "ApolloError" which is
 * an array of errors coming back from the GraphQL API.
 */
export default function () {
  const loader = useLoaderData<LoaderData>();

  return (
    <main className="ui-main">
      <h1>Ex: GraphQL Error</h1>
      <Code data={loader} summary="Loader Data" />
      <p>
        Uh oh, we've intentionally triggered an error, expand the details
        above to see what's going on.
      </p>
      <hr style={{ margin: "40px auto" }} />
      <Link to="/" style={{ display: 'block', marginTop: 40 }}>
        View all characters
      </Link>
    </main>
  );
};
