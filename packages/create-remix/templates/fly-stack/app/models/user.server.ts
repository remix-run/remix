import bcrypt from "@node-rs/bcrypt";
import type { User } from "@prisma/client";
import { prisma } from "~/db.server";

async function createUser(email: string, password: string): Promise<User> {
  const hashedPassword = await bcrypt.hash(password);
  const user = await prisma.user.create({
    data: {
      email,
      password: {
        create: {
          hash: hashedPassword
        }
      }
    }
  });

  return user;
}

async function verifyLogin(
  email: string,
  password: string
): Promise<User | undefined> {
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      password: true
    }
  });

  if (!user || !user.password) {
    return undefined;
  }

  const isValid = await bcrypt.verify(password, user.password.hash);

  if (!isValid) {
    return undefined;
  }

  const { password: _password, ...userWithoutPassword } = user;

  return userWithoutPassword;
}

export { createUser, verifyLogin };
