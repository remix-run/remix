import bcrypt from "@node-rs/bcrypt";
import { prisma } from "~/db.server";

async function createUser(email: string, password: string) {
  const hashedPassword = await bcrypt.hash(password);
  const { password: userPassword, ...user } = await prisma.user.create({
    data: {
      email,
      password: hashedPassword
    }
  });

  return user;
}

async function verifyLogin(email: string, password: string) {
  const { password: userPassword, ...user } = await prisma.user.findUnique({
    where: { email }
  });

  if (!user) {
    return undefined;
  }

  const isValid = await bcrypt.verify(password, userPassword);

  if (!isValid) {
    return undefined;
  }

  return user;
}

export { createUser, verifyLogin };
