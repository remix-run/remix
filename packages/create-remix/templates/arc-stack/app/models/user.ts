import { arc, bcrypt } from "~/db.server";

async function getUserByEmail(email: string) {
  const db = await arc.tables();
  const result = await db.people.query({
    KeyConditionExpression: "pk = :pk",
    ExpressionAttributeValues: { ":pk": `email#${email}` }
  });

  return result.Items[0];
}

async function createUser(email: string, password: string) {
  const hashedPassword = await bcrypt.hash(String(password));
  const db = await arc.tables();
  return db.people.put({
    pk: `email#${email}`,
    password: hashedPassword
  });
}

export { getUserByEmail, createUser };
