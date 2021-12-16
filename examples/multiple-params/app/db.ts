export type Invoice = {
  id: string;
  title: string;
  amount: number;
  currency: "EUR" | "USD" | "GBP";
};
export type Client = {
  id: string;
  name: string;
  email: string;
  invoices: Array<Invoice>;
};

export async function getClients(): Promise<Array<Client>> {
  return [
    {
      id: "ak35kd2n4ho",
      name: "John Doe",
      email: "johndoe@example.com",
      invoices: [
        {
          id: "e8obdnsoim8",
          title: "Teddy Bear",
          amount: 100,
          currency: "EUR"
        },
        {
          id: "j8u90tr3iro",
          title: "Tacos",
          amount: 123,
          currency: "USD"
        }
      ]
    },
    {
      id: "gfi5m4umrv8",
      name: "Kody Koala",
      email: "kodykoala@example.com",
      invoices: [
        {
          id: "94u1l8e9n88",
          title: "Water Bottle",
          amount: 100,
          currency: "EUR"
        },
        {
          id: "e12uehka1",
          title: "Camera",
          amount: 123,
          currency: "USD"
        }
      ]
    }
  ];
}

export async function getClient(id: string) {
  const clients = await getClients();
  return clients.find(client => client.id === id);
}
