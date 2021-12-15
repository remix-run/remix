import type { LoaderFunction } from "remix";
import { Link, useLoaderData } from "remix";
import { json, Outlet } from "remix";
import type { Invoice } from "~/db";
import { getClient } from "~/db";

type LoaderData = { invoices: Array<Pick<Invoice, "id" | "title">> };

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
    invoices: client.invoices.map(i => ({ id: i.id, title: i.title }))
  };
  return json(data);
};

export default function ClientRoute() {
  const data = useLoaderData<LoaderData>();
  return (
    <div>
      <h3>Invoices</h3>
      <ul>
        {data.invoices.map(invoice => (
          <li key={invoice.id}>
            <Link to={invoice.id}>{invoice.title}</Link>
          </li>
        ))}
      </ul>
      <Outlet />
    </div>
  );
}

export function ErrorBoundary({ error }: { error: Error }) {
  console.error(error);

  return <div>Uh oh. I did a whoopsies</div>;
}
