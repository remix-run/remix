import type {
  LoaderFunction} from "remix";
import {
  json,
  Link,
  LinksFunction,
  Outlet,
  useLoaderData
} from "remix";
import type { Invoice } from "~/data.server";
import { getInvoices } from "~/data.server";

export const loader: LoaderFunction = async ({ params }) => {
  return json(getInvoices());
};

export default function Invoices() {
  const data = useLoaderData();

  return (
    <>
      <Outlet />
      <Link to="/invoices/add">Add</Link>
      <table>
        <thead>
          <tr>
            <th>Id</th>
            <th>Company</th>
            <th>Description</th>
            <th>Amount</th>
            <th>Date</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {data.map((invoice: Invoice) => (
            <tr key={invoice.id}>
              <td>{invoice.id}</td>
              <td>{invoice.company}</td>
              <td>{invoice.description}</td>
              <td>{invoice.amount}</td>
              <td>{invoice.date}</td>
              <td>
                <Link to={`/invoices/${invoice.id}/edit`}>Edit</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
