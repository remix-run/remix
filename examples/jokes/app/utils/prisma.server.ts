import { PrismaClient } from "@prisma/client";

let prisma: PrismaClient;

declare global {
  var db: PrismaClient;
}

// this is needed because in development we don't want to restart
// the server with every change, but we want to make sure we don't
// create a new connection to the DB with every change either.
if (process.env.NODE_ENV === "production") {
  prisma = new PrismaClient();
  prisma.$connect();
} else {
  if (!global.db) {
    global.db = new PrismaClient();
    global.db.$connect();
  }
  prisma = global.db;
}

export { prisma };
