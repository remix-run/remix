export interface User {
  id: string;
  email: string;
  name: string;
}

export const users: User[] = [
  {
    id: "ef3fcb93-0623-4d10-adbf-4dd865d6688c",
    email: "Melisa_Treutel38@gmail.com",
    name: "Ava"
  },
  {
    id: "2cbad877-2da6-422d-baa6-c6a96a9e085f",
    email: "Delilah65@yahoo.com",
    name: "Jensen"
  },
  {
    id: "1dd9e502-343d-4acb-9391-2bc52d5ea904",
    email: "Dallin12@gmail.com",
    name: "Rodger"
  },
  {
    id: "32083662-aaa7-4d8e-9df9-b8280360b485",
    email: "Britney.Hudson@gmail.com",
    name: "Albin"
  },
  {
    id: "5adacdaf-87ba-40e9-9732-0138a5b76c65",
    email: "Janelle_Littel80@gmail.com",
    name: "Maryse"
  },
  {
    id: "9dbc8494-2239-4981-bd4f-243e2ef42ce1",
    email: "Katelin66@hotmail.com",
    name: "Annabelle"
  },
  {
    id: "6f604ea4-cd96-4ef1-a250-a237e2372f34",
    email: "Madge.Goyette@yahoo.com",
    name: "Margie"
  },
  {
    id: "378b9801-688b-4a78-b010-959b00a633cd",
    email: "Sammie.Ernser@gmail.com",
    name: "Kacie"
  },
  {
    id: "3182023a-1843-409f-9620-70dd56b5c8e5",
    email: "Carli.Hegmann@yahoo.com",
    name: "Carolyne"
  },
  {
    id: "41c97243-adf2-4ba8-b020-1ac1b46eaf75",
    email: "Assunta.Treutel39@yahoo.com",
    name: "Sammie"
  }
];

type WhereInput = { where: { id: { in: Readonly<string[]> } } };
/**
 * This mimics an ORM in the style of Prisma. `db.user.findMany` logs
 * "user#findMany" to demonstrate that it is only called once, for demo purposes.
 *
 * https://www.prisma.io/docs/reference/api-reference/prisma-client-reference#findmany
 */
export const db = {
  user: {
    findMany: ({ where }: WhereInput) => {
      console.log("user#findMany");
      return users.filter(user => where.id.in.includes(user.id));
    }
  }
};
