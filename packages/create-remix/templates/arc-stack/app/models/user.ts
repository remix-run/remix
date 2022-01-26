import { arc, bcrypt } from "~/db.server";

async function getUserByEmail(email: string) {
  const db = await arc.tables();
  return db.people.query({
    KeyConditionExpression: "pk = :pk",
    ExpressionAttributeValues: { ":pk": `email#${email}` }
  });
}

async function verifyUser(
  email: string,
  password: string
): Promise<[Record<string, string> | undefined, any | undefined]> {
  const result = await getUserByEmail(email);

  if (!result.Items.length) {
    return [{ email: "Email not found" }, undefined];
  }

  const user = result.Items[0];
  const authorized = await bcrypt.verify(String(password), user.password);
  if (!authorized) {
    return [{ password: "Invalid Password" }, undefined];
  }

  return [user, undefined];
}

async function createUser(email: string, password: string) {
  const hashedPassword = await bcrypt.hash(String(password));
  const db = await arc.tables();
  return db.people.put({
    pk: `email#${email}`,
    password: hashedPassword
  });
}

export { getUserByEmail, verifyUser, createUser };
