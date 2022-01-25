import { json, useLoaderData } from "remix";
import type { LoaderFunction } from "remix";
import type { Client } from "~/db";
import { getClient } from "~/db";

type LoaderData = {
  client: Pick<Client, "id" | "name" | "email">;
};

export const loader: LoaderFunction = async ({ params }) => {
  if (!params.clientId) {
    throw new Response(`No client ID provided`, {
      status: 404
    });
  }
  const client = await getClient(params.clientId);
  if (!client) {
    throw new Response(`No client found by ID ${params.clientId}`, {
      status: 404
    });
  }

  const data: LoaderData = {
    client: {
      id: client.id,
      email: client.email,
      name: client.name
    }
  };
  return json(data);
};

export default function ClientIndexRoute() {
  const data = useLoaderData<LoaderData>();
  return (
    <div>
      <strong>{data.client.name} Information</strong>
      <ul>
        <li>
          <strong>ID:</strong> {data.client.id}
        </li>
        <li>
          <strong>Email:</strong> {data.client.email}
        </li>
      </ul>
    </div>
  );
}

export function ErrorBoundary({ error }: { error: Error }) {
  console.error(error);

  return <div>Uh oh. I did a whoopsies</div>;
}
