import { LoaderFunction, useLoaderData } from 'remix';
import { CharacterList } from '~/components/CharacterList';
import { Code } from '~/components/Code';
import { initApollo } from '~/context/apollo';
import { GetCharactersDocument, GetCharactersQueryResult } from '~/generated/hooks';

export const loader: LoaderFunction = async () => {
  const client = initApollo(false);
  const { data, error } = await client.query({
    query: GetCharactersDocument,
    variables: { page: 1 }
  });

  return { data, error };
}

/**
 * @description This route makes easy use of the Remix loader to fetch our
 * data from GraphQL. We then use the generated typing in the userLoaderData
 * to get that strong typing and IDE integration.
 */
export default function () {

  // Hooks
  const { data, error } = useLoaderData<GetCharactersQueryResult>();

  // Setup
  const characters = data?.characters?.results

  // 🔌 Short Circuit
  if (error) return <div>Error: {error.message}</div>;

  return (
    <main className="ui-main">
      <h1>Using the Remix Loader</h1>
      <p>
        This route makes easy use of the Remix loader to fetch our data from
        GraphQL. We then use the generated typing in the userLoaderData to get
       that strong typing and IDE integration.
      </p>

      <Code data={data} summary='Loader data' />
      <CharacterList data={characters} />
    </main>
  );
};
