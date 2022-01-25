import { json, Link, Outlet, useCatch, useLoaderData, useParams } from "remix";
import type { LoaderFunction } from "remix";
import type { Client } from "~/db";
import { getClient } from "~/db";

type LoaderData = {
  client: Pick<Client, "name">;
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

  const data: LoaderData = { client: { name: client.name } };
  return json(data);
};

export default function ClientRoute() {
  const data = useLoaderData<LoaderData>();
  return (
    <div>
      <h2>{data.client.name}</h2>
      <div>
        <strong>{data.client.name} Links</strong>
        <ul>
          <li>
            <Link to=".">Home</Link>
          </li>
          <li>
            <Link to="invoices">Invoices</Link>
          </li>
        </ul>
      </div>
      <Outlet />
    </div>
  );
}

export function CatchBoundary() {
  const params = useParams();
  const caught = useCatch();

  if (caught.status === 404) {
    return (
      <div>
        Huh... Couldn't find an client with the ID of: {params.clientId}
      </div>
    );
  }

  throw new Error(`Unexpected caught response with status: ${caught.status}`);
}

export function ErrorBoundary({ error }: { error: Error }) {
  console.error(error);

  return <div>Uh oh. I did a whoopsies</div>;
}
