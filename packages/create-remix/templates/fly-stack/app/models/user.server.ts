import bcrypt from "@node-rs/bcrypt";
import { prisma } from "~/db.server";

async function createUser(email: string, password: string) {
  const hashedPassword = await bcrypt.hash(password);
  const user = await prisma.user.create({
    select: {
      userData: true
    },
    data: {
      email,
      password: hashedPassword,
      userData: {
        create: {
          email
        }
      }
    }
  });

  return user.userData;
}

async function verifyLogin(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { userData: true }
  });

  if (!user) {
    return undefined;
  }

  const isValid = await bcrypt.verify(password, user.password);

  if (!isValid) {
    return undefined;
  }

  return user.userData;
}

export { createUser, verifyLogin };
