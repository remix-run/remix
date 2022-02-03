import type { LoaderFunction } from "remix";
import { json, Link, Outlet, useLoaderData } from "remix";

export const loader: LoaderFunction = async ({ params }) => {
  const invoices = [
    {
      id: 1,
      company: "Remix",
      description: "Remix license",
      amount: 200,
      date: new Date(2021, 8, 1)
    },
    {
      id: 2,
      company: "Amazon",
      description: "AWS bill",
      amount: 340,
      date: new Date(2022, 8, 1)
    }
  ];
  return json(invoices);
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
          {data.map((invoice: any) => (
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
