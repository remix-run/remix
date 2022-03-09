import { PrismaClient } from "@prisma/client";
import bcrypt from "@node-rs/bcrypt";

const prisma = new PrismaClient();

async function seed() {
  let hashedPassword = await bcrypt.hash("mysupergoodpassword", 10);

  let user = await prisma.user.create({
    data: {
      email: "you@example.com",
      password: hashedPassword,
    },
  });

  await prisma.note.createMany({
    data: [
      {
        title: "My first note",
        body: "Hello, world!",
        userId: user.id,
      },
      {
        title: "My second note",
        body: "Hello, world!",
        userId: user.id,
      },
    ],
  });

  console.log(`Database has been seeded. 🌱`);
}

try {
  seed();
  process.exit(0);
} catch (error: unknown) {
  console.error(error);
  process.exit(1);
}
