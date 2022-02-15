import arc from "@architect/functions";
import bcrypt from "bcryptjs";

function cleanUser(user: any) {
  const { password, ...cleanUser } = user;
  return cleanUser;
}

async function getUserByEmail(email: string) {
  const db = await arc.tables();
  const result = await db.people.query({
    KeyConditionExpression: "pk = :pk",
    ExpressionAttributeValues: { ":pk": `email#${email}` },
  });

  const user = result.Items[0];

  if (!user) {
    return undefined;
  }

  return cleanUser(user);
}

async function createUser(email: string, password: string) {
  const hashedPassword = await bcrypt.hash(password, 10);
  const db = await arc.tables();
  const user = await db.people.put({
    pk: `email#${email}`,
    password: hashedPassword,
  });

  return cleanUser(user);
}

async function verifyLogin(email: string, password: string) {
  const user = await getUserByEmail(email);
  if (!user) {
    return undefined;
  }

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) {
    return undefined;
  }

  return cleanUser(user);
}

export { getUserByEmail, createUser, verifyLogin };
