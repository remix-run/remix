import type { LoaderFunction } from "remix";
import { useParams, useCatch } from "remix";
import { useLoaderData } from "remix";
import { json } from "remix";
import type { Invoice } from "~/db";
import { getClient } from "~/db";

type LoaderData = { invoice: Invoice };

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
  if (!params.invoiceId) {
    throw new Response(`No invoice ID provided`, {
      status: 404
    });
  }
  const invoice = client.invoices.find(i => i.id === params.invoiceId);
  if (!invoice) {
    throw new Response(`No invoice found by ID ${params.invoiceId}`, {
      status: 404
    });
  }

  const data: LoaderData = { invoice };
  return json(data);
};

export default function ClientRoute() {
  const data = useLoaderData<LoaderData>();
  return (
    <div>
      <h3>Invoice</h3>
      <ul>
        <li>
          <strong>ID:</strong> {data.invoice.id}
        </li>
        <li>
          <strong>Title:</strong> {data.invoice.title}
        </li>
        <li>
          <strong>Amount:</strong> {data.invoice.amount}
        </li>
        <li>
          <strong>Currency:</strong> {data.invoice.currency}
        </li>
      </ul>
    </div>
  );
}

export function CatchBoundary() {
  const params = useParams();
  const caught = useCatch();

  if (caught.status === 404) {
    return (
      <div>
        Huh... Couldn't find an invoice with the ID of: {params.invoiceId}
      </div>
    );
  }

  throw new Error(`Unexpected caught response with status: ${caught.status}`);
}

export function ErrorBoundary({ error }: { error: Error }) {
  console.error(error);

  return <div>Uh oh. I did a whoopsies</div>;
}
