import * as bcrypt from "bcrypt";
import { z } from "zod";

import { prisma } from "./prisma.server";

let LoginForm = z.object({
  // loginType: z.enum(["login", "register"]),
  username: z.string().min(3),
  password: z.string().min(5).max(100),
});

type LoginForm = z.infer<typeof LoginForm>;

async function login({ username, password }: LoginForm) {
  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: { isAdmin: false, username, passwordHash },
  });

  return user;
}

export { login, LoginForm };
