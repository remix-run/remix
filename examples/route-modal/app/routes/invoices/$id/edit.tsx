import * as React from "react";
import Dialog from "@reach/dialog";
import type { ActionFunction, LinksFunction, LoaderFunction } from "remix";
import { redirect } from "remix";
import { useLoaderData } from "remix";
import { json } from "remix";
import { Form } from "remix";
import { useNavigate } from "remix";
import styles from "@reach/dialog/styles.css";

export const links: LinksFunction = () => {
  return [
    {
      rel: "stylesheet",
      href: styles
    }
  ];
};

export const loader: LoaderFunction = async ({ params }) => {
  const id = params.id;
  if (!id) return null;

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

  const invoice = invoices.find(invoice => invoice.id === parseInt(id));
  return json(invoice);
};

export const action: ActionFunction = async ({ request }) => {
  // Here we can update our dabatase with the updated invoice

  // Redirect back to invoice list
  return redirect("/invoices");
};

export default function Edit() {
  const navigate = useNavigate();
  const data = useLoaderData();

  const [formData, setFormData] = React.useState({
    company: data.company,
    description: data.description,
    amount: data.amount,
    date: data.date
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
      aria-label="Edit invoice"
      onDismiss={onDismiss}
    >
      <h3>Edit invoice</h3>
      <Form
        method="post"
        replace
        style={{ display: "flex", flexDirection: "column" }}
      >
        <label htmlFor="company">Company</label>
        <input
          type="text"
          name="company"
          id="company"
          value={formData.company}
          onChange={handleChange}
        />

        <label htmlFor="description">Description</label>
        <textarea
          name="description"
          id="description"
          value={formData.description}
          onChange={handleChange}
          rows={10}
        />

        <label htmlFor="amount">Amount</label>
        <input
          type="number"
          name="amount"
          id="amount"
          value={formData.amount}
          onChange={handleChange}
        />
        <label htmlFor="date">Date</label>
        <input defaultValue={formData.date} type="date" name="date" id="date" />
        <div>
          <button type="submit">Save</button>
          <button type="button" onClick={onDismiss}>
            Cancel
          </button>
        </div>
      </Form>
    </Dialog>
  );
}
