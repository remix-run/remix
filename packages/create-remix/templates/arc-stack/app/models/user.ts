import arc from "@architect/functions";
import bcrypt from "bcryptjs";

async function getUserByEmail(email: string) {
  let db = await arc.tables();
  let result = await db.people.query({
    KeyConditionExpression: "pk = :pk",
    ExpressionAttributeValues: { ":pk": `email#${email}` },
  });

  return result.Items[0];
}

async function getUserPasswordByEmail(email: string) {
  let db = await arc.tables();
  let result = await db.password.query({
    KeyConditionExpression: "pk = :pk",
    ExpressionAttributeValues: { ":pk": `email#${email}` },
  });

  return result.Items[0];
}

async function createUser(email: string, password: string) {
  let hashedPassword = await bcrypt.hash(password, 10);
  let db = await arc.tables();
  await db.password.put({
    pk: `email#${email}`,
    password: hashedPassword,
  });

  await db.people.put({
    pk: `email#${email}`,
  });

  let user = await getUserByEmail(email);

  return user;
}

async function verifyLogin(email: string, password: string) {
  let user = await getUserPasswordByEmail(email);

  if (!user) {
    return undefined;
  }

  let isValid = await bcrypt.compare(password, user.password);
  if (!isValid) {
    return undefined;
  }

  return getUserByEmail(email);
}

export { getUserByEmail, createUser, verifyLogin };
