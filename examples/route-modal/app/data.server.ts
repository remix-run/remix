export type Invoice = {
  id?: number;
  company: string;
  description: string;
  amount: number;
  date: Date;
};

export const invoices: Invoice[] = [
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

export function getInvoices() {
  return invoices;
}

export function createInvoice(invoice: Invoice) {
  return invoice;
}

export function updateInvoice(invoice: Invoice) {
  return invoice;
}
