import * as React from "react";
import Dialog from "@reach/dialog";
import type { ActionFunction, LinksFunction, LoaderFunction} from "remix";
import { redirect } from "remix";
import { useLoaderData } from "remix";
import { json } from "remix";
import { Form } from "remix";
import { useNavigate } from "remix";
import styles from "@reach/dialog/styles.css";

import stylesUrl from "~/styles/invoices/dialog.css";
import { getInvoices, updateInvoice } from "~/data.server";

export const links: LinksFunction = () => {
  return [
    {
      rel: "stylesheet",
      href: styles
    },
    {
      rel: "stylesheet",
      href: stylesUrl
    }
  ];
};

export const loader: LoaderFunction = ({ params }) => {
  const id = params.id;
  if (!id) return null;

  const invoice = getInvoices().find(invoice => invoice.id === parseInt(id));
  console.log(getInvoices(), params);
  return json(invoice);
};

type ActionData = {
  formError?: string;
};
const badRequest = (data: ActionData) => json(data, { status: 400 });
export const action: ActionFunction = async ({ request }) => {
  const form = await request.formData();
  const company = form.get("company");
  const description = form.get("description");
  const amount = form.get("amount");
  const date = form.get("date");

  if (
    typeof company !== "string" ||
    typeof description !== "string" ||
    typeof amount !== "string" ||
    typeof date !== "string"
  ) {
    return badRequest({
      formError: "Invalid form data"
    });
  }

  const invoice = updateInvoice({
    company,
    description,
    date: new Date(date),
    amount: parseFloat(amount)
  });

  return redirect("/invoices");
};

export default function Edit() {
  const navigate = useNavigate();
  const data = useLoaderData();

  const [formData, setFormData] = React.useState({
    company: data.company,
    description: data.description,
    amount: data.amount
  });

  function handleChange(
    event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    const { name, value } = event.currentTarget;
    setFormData({ ...formData, [name]: value });
  }

  function onDismiss() {
    navigate("/invoices");
  }

  return (
    <Dialog
      className="dialog"
      isOpen={true}
      aria-label="Add invoice"
      onDismiss={onDismiss}
    >
      <h3>Edit invoice</h3>
      <Form className="form" method="post" replace>
        <label className="label" htmlFor="company">
          Company
        </label>
        <input
          className="input"
          type="text"
          name="company"
          value={formData.company}
          onChange={handleChange}
        />

        <label className="label" htmlFor="description">
          Description
        </label>
        <textarea
          className="textarea"
          name="description"
          value={formData.description}
          onChange={handleChange}
          rows={10}
        />

        <label className="label">Amount</label>
        <input
          className="input"
          type="number"
          name="amount"
          value={formData.amount}
          onChange={handleChange}
        />

        <div className="actions">
          <button type="submit">Save</button>
          <button type="button" onClick={onDismiss}>
            Cancel
          </button>
        </div>
      </Form>
    </Dialog>
  );
}
