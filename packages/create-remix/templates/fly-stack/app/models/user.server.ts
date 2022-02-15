import bcrypt from "@node-rs/bcrypt";
import type { User } from "@prisma/client";
import { prisma } from "~/db.server";

function cleanUser(user: User) {
  const { password, ...cleanUser } = user;
  return cleanUser;
}

async function createUser(email: string, password: string) {
  const hashedPassword = await bcrypt.hash(password);
  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword
    }
  });

  return cleanUser(user);
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

  return cleanUser(user);
}

export { createUser, verifyLogin };
