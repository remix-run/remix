import * as bcrypt from "bcrypt";

import { prisma } from "./prisma.server";

async function login({ username, password }) {
  let passwordHash = await bcrypt.hash(password, 10);
  let user = await prisma.user.create({
    data: {
      username,
      passwordHash,
    },
  });
  return user;
}

export { login };
