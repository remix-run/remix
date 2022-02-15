import bcrypt from "@node-rs/bcrypt";
import { prisma } from "~/db.server";

async function createUser(email: string, password: string) {
  const hashedPassword = await bcrypt.hash(password);
  return prisma.user.create({
    data: {
      email,
      password: hashedPassword
    }
  });
}

async function verifyLogin(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email }
  });

  if (!user) {
    return undefined;
  }

  const isValid = await bcrypt.verify(password, user.password);

  if (!isValid) {
    return undefined;
  }

  return user;
}

export { createUser, verifyLogin };
