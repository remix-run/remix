import { Link, Outlet, useLoaderData } from "@remix-run/react";
import { json } from "@remix-run/node";
import type { LoaderFunction } from "@remix-run/node";
import type { Client } from "~/db";
import { getClients } from "~/db";

type LoaderData = {
  clients: Array<Pick<Client, "id" | "name">>;
};

export const loader: LoaderFunction = async () => {
  const clients = await getClients();
  const data: LoaderData = {
    clients: clients.map((c) => ({ id: c.id, name: c.name })),
  };
  return json(data);
};

export default function ClientsRoute() {
  const data = useLoaderData<LoaderData>();
  return (
    <div>
      <h1>Clients</h1>
      <ul>
        {data.clients.length
          ? data.clients.map((c) => (
              <li key={c.id}>
                <Link to={c.id}>{c.name}</Link>
              </li>
            ))
          : "You got no clients"}
      </ul>
      <Outlet />
    </div>
  );
}
