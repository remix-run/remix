import bcrypt from "@node-rs/bcrypt";
import type { User } from "@prisma/client";

import { prisma } from "~/db.server";

async function createUser(email: string, password: string): Promise<User> {
  let hashedPassword = await bcrypt.hash(password);
  let user = await prisma.user.create({
    data: {
      email,
      password: {
        create: {
          hash: hashedPassword,
        },
      },
    },
  });

  return user;
}

async function verifyLogin(
  email: string,
  password: string
): Promise<User | undefined> {
  let user = await prisma.user.findUnique({
    where: { email },
    include: {
      password: true,
    },
  });

  if (!user || !user.password) {
    return undefined;
  }

  let isValid = await bcrypt.verify(password, user.password.hash);

  if (!isValid) {
    return undefined;
  }

  let { password: _password, ...userWithoutPassword } = user;

  return userWithoutPassword;
}

export { createUser, verifyLogin };
