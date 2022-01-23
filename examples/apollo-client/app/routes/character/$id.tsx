import { useParams } from 'react-router-dom';
import { CharacterDetail } from '~/components/CharacterDetail';
import { Code } from '~/components/Code';
import { useGetCharacterQuery } from '~/generated/hooks';

/**
 * @description Simple example of fetching data using Apollo / GraphQL via
 * the hooks generated from our ".graphql" files.
 */
export default function () {
  // Hooks
  const { id } = useParams();
  const { data, loading, error } = useGetCharacterQuery({
    variables: { id: String(id) }
  });

  // 🔌 Short Circuit
  if (error) return <div>Error: {error.message}</div>;

  return (
    <main className="ui-main">
      <h1>Using React Hooks</h1>
      <p>
        Simple example of fetching data using Apollo / GraphQL via the hooks
        generated from our ".graphql" files.
      </p>
      <Code data={data} summary='Apollo Hooks' />
      {loading ? <div>Loading...</div> : <CharacterDetail data={data?.character} />}
    </main>
  );
};
