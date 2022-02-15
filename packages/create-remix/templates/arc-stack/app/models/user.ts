import arc from "@architect/functions";
import bcrypt from "bcryptjs";

async function getUserByEmail(email: string) {
  const db = await arc.tables();
  const result = await db.people.query({
    KeyConditionExpression: "pk = :pk",
    ExpressionAttributeValues: { ":pk": `email#${email}` }
  });

  return result.Items[0];
}

async function createUser(email: string, password: string) {
  const hashedPassword = await bcrypt.hash(password, 10);
  const db = await arc.tables();
  const { password: userPassword, ...user } = await db.people.put({
    pk: `email#${email}`,
    password: hashedPassword
  });

  return user;
}

async function verifyLogin(email: string, password: string) {
  const { password: userPassword, ...user } = await getUserByEmail(email);
  if (!user) {
    return undefined;
  }

  const isValid = await bcrypt.compare(password, userPassword);
  if (!isValid) {
    return undefined;
  }

  return user;
}

export { getUserByEmail, createUser, verifyLogin };
